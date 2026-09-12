class NonAdBlockEngineV5 {
  constructor(options = {}) {
    this.options = Object.assign({
      timeoutLimit: 4000,
      minValidScriptLength: 2500,
      strictMode: true,
      onDetected: () => this.executeProtection()
    }, options);

    // Test edilecek popüler reklam ve takip script matrisi
    this.scriptTargets = [
      { name: 'Google AdSense', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' },
      { name: 'Criteo Main', url: 'https://static.criteo.net/js/ld/ld.js' },
      { name: 'Amazon Ads', url: 'https://c.amazon-adsystem.com/aax2/amzn_ads.js' },
      { name: 'Taboola Loader', url: 'https://cdn.taboola.com/libtrc/unip/1/tfa.js' },
      { name: 'Outbrain Widget', url: 'https://widgets.outbrain.com/outbrain.js' },
      { name: 'Google DoubleClick', url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js' },
      { name: 'ScorecardResearch', url: 'https://sb.scorecardresearch.com/beacon.js' },
      { name: 'PopAds Engine', url: 'https://serve.popads.net/c.js' }
    ];

    // Eklentilerin no-op/surrogate script basarken arkada bıraktığı şüpheli terimler
    this.suspiciousPatterns = [
      /adblock/i,
      /ublock/i,
      /uBlockOrigin/i,
      /adguard/i,
      /noop\.js/i,
      /surrogate/i,
      /blocked_by_extension/i,
      /net::ERR_BLOCKED_BY_CLIENT/i,
      /abort_current_inline_script/i,
      /google_ad_status\s*=\s*3/i,
      /window\.canRunAds\s*=\s*false/i,
      /this_is_a_mock/i,
      /fake_ad/i
    ];

    this.inspectionResults = [];
    this.isTriggered = false;
  }

  async startInspectionEngine() {
    const fetchPromises = this.scriptTargets.map((target) => this.inspectSingleScript(target));
    
    // Tüm taramaları paralel çalıştır
    this.inspectionResults = await Promise.all(fetchPromises);

    // Bütünsel analiz ve skorlama
    const detectionVerdict = this.evaluateScriptAnalyticResults();

    if (detectionVerdict.isAdBlockActive) {
      this.triggerProtectionMechanism(detectionVerdict.reason);
    }
  }

  inspectSingleScript(target) {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutLimit);
      const cacheBustUrl = target.url + '?_v=' + Date.now() + '_' + Math.floor(Math.random() * 10000);

      fetch(cacheBustUrl, { method: 'GET', mode: 'cors', cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          clearTimeout(timeoutId);

          const scriptText = await response.text();
          const contentLength = scriptText.length;
          const status = response.status;

          // Dönen JS Kodu üzerinde Derin Analiz Yap
          const patternAnalysis = this.analyzeSourceCodeForSignatures(scriptText);
          const domAttributesAnalysis = this.checkElementAdBlockAttributes();

          resolve({
            name: target.name,
            url: target.url,
            success: true,
            status: status,
            length: contentLength,
            sourceCode: scriptText,
            hasSuspiciousSignature: patternAnalysis.hasSignature,
            detectedSignature: patternAnalysis.matchedPattern,
            hasAdBlockAttribute: domAttributesAnalysis
          });
        })
        .catch((error) => {
          clearTimeout(timeoutId);

          // Ağ Düzeyinde Engellenme (net::ERR_BLOCKED_BY_CLIENT)
          resolve({
            name: target.name,
            url: target.url,
            success: false,
            status: 0,
            length: 0,
            error: error.message || 'Network Filter Blocked Request',
            hasSuspiciousSignature: true,
            detectedSignature: 'NETWORK_LEVEL_ABORT',
            hasAdBlockAttribute: false
          });
        });
    });
  }

  // Dönen Kod Metninin İçeriğini ve Sözdizimini İnceleme
  analyzeSourceCodeForSignatures(codeText) {
    if (!codeText || codeText.trim().length === 0) {
      return { hasSignature: true, matchedPattern: 'EMPTY_MOCK_PAYLOAD' };
    }

    // 1. Şüpheli Anahtar Kelime Taraması
    for (let pattern of this.suspiciousPatterns) {
      if (pattern.test(codeText)) {
        return { hasSignature: true, matchedPattern: pattern.toString() };
      }
    }

    // 2. Boyut ve Içerik Tutarlılık Taraması
    // Orijinal reklam script'leri binlerce karakterdir; uBlock surrogate script'leri genelde < 1KB'dir.
    if (codeText.length < this.options.minValidScriptLength) {
      return { hasSignature: true, matchedPattern: `SMALL_SURROGATE_PAYLOAD_${codeText.length}_BYTES` };
    }

    return { hasSignature: false, matchedPattern: null };
  }

  // DOM Üzerindeki Eklenti veya Script Etiket Özelliklerini (Attributes) İnceleme
  checkElementAdBlockAttributes() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      
      // Bazı eklentilerin müdahale ettiği etiketlere eklediği öznitelikler
      if (
        script.hasAttribute('data-adblockkey') ||
        script.hasAttribute('data-ublock-intercepted') ||
        script.getAttribute('type') === 'text/plain' && script.className.includes('adblock')
      ) {
        return true;
      }
    }
    return false;
  }

  // Elde Edilen Tüm Script Analiz Verilerini Değerlendirme
  evaluateScriptAnalyticResults() {
    let blockedCount = 0;
    let totalTargetCount = this.inspectionResults.length;
    let detectedReasons = [];

    for (let result of this.inspectionResults) {
      if (!result.success) {
        blockedCount++;
        detectedReasons.push(`${result.name}: Ağ İsteği Engellendi (${result.error})`);
        continue;
      }

      if (result.hasSuspiciousSignature) {
        blockedCount++;
        detectedReasons.push(`${result.name}: Sahte/Mock Kod Algılandı -> İmza: [${result.detectedSignature}]`);
      }

      if (result.hasAdBlockAttribute) {
        blockedCount++;
        detectedReasons.push(`${result.name}: DOM Script Öznitelik Müdahalesi Saptandı`);
      }
    }

    // Eğer script dizisinin %40'ından fazlası engellendiyse veya sahte yanıt döndüyse engelleme aktiftir
    const isAdBlockActive = (blockedCount / totalTargetCount) >= 0.4;

    return {
      isAdBlockActive: isAdBlockActive,
      blockedRatio: `${blockedCount}/${totalTargetCount}`,
      reason: detectedReasons.join(' | ')
    };
  }

  triggerProtectionMechanism(reason) {
    if (this.isTriggered) return;
    this.isTriggered = true;

    if (this.options.strictMode) {
      this.clearDOMContent();
    }

    this.options.onDetected(reason);
  }

  clearDOMContent() {
    try {
      document.body.innerHTML = '';
      document.head.innerHTML = '';
    } catch (e) {
      // DOM Silme başarısız olursa ezme stilini zorla
    }
  }

  executeProtection() {
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('pointer-events', 'none', 'important');

    const overlay = document.createElement('div');
    overlay.id = 'nonadblock-protection-screen';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background-color: #080a0f !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      pointer-events: auto !important;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      background-color: #12161f !important;
      border: 1px solid #232a3b !important;
      padding: 40px !important;
      border-radius: 12px !important;
      max-width: 480px !important;
      text-align: center !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9) !important;
    `;

    const title = document.createElement('h2');
    title.innerText = 'Aktif Reklam Engelleme Saptandı';
    title.style.cssText = 'color: #ff4757 !important; margin: 0 0 16px 0 !important; font-size: 22px !important; font-weight: 700 !important;';

    const description = document.createElement('p');
    description.innerText = 'Tarayıcınızdaki AdBlock / uBlock eklentisi, sunucularımızdan yüklenen reklam ve doğrulama kodlarını doğrudan engelledi ya da sahte kod ile değiştirdi. Lütfen bu alan adı için engellemeyi durdurun.';
    description.style.cssText = 'color: #9a9ea8 !important; font-size: 14px !important; line-height: 1.6 !important; margin: 0 0 24px 0 !important;';

    const actionButton = document.createElement('button');
    actionButton.innerText = 'Eklentiyi Kapatıp Sayfayı Yenile';
    actionButton.style.cssText = `
      background-color: #2ed573 !important;
      color: #080a0f !important;
      border: none !important;
      padding: 14px 28px !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      width: 100% !important;
      transition: background-color 0.2s !important;
    `;
    actionButton.onclick = () => window.location.reload();

    container.appendChild(title);
    container.appendChild(description);
    container.appendChild(actionButton);
    overlay.appendChild(container);

    document.documentElement.appendChild(overlay);

    // Bypassa karşı modal varlığını periyodik kontrol et
    setInterval(() => {
      if (!document.getElementById('nonadblock-protection-screen')) {
        document.documentElement.appendChild(overlay);
      }
    }, 250);
  }
}
