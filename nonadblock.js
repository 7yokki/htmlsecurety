class NonAdBlockEngineV5 {
  constructor(options = {}) {
    this.options = Object.assign({
      timeoutLimit: 4000,
      strictMode: true,
      onDetected: null
    }, options);

    // Network panelinde bizzat görünecek test script'leri
    this.targetScripts = [
      { id: 'googlesyndication', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', check: () => !!window.adsbygoogle },
      { id: 'doubleclick', url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', check: () => !!window.googletag },
      { id: 'amazon_ads', url: 'https://c.amazon-adsystem.com/aax2/amzn_ads.js', check: () => !!window.amznads },
      { id: 'criteo', url: 'https://static.criteo.net/js/ld/ld.js', check: () => !!window.criteo_q }
    ];

    this.blockedCount = 0;
    this.completedCount = 0;
    this.isTriggered = false;
  }

  startInspectionEngine() {
    // DOM'un hazır olmasını bekle ve script'leri enjekte et
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectAllTargets());
    } else {
      this.injectAllTargets();
    }
  }

  injectAllTargets() {
    this.targetScripts.forEach(item => {
      this.injectSingleScript(item);
    });
  }

  injectSingleScript(item) {
    const script = document.createElement('script');
    // Cache'i kırıp Network sekmesine zorla düşürmek için timestamp ekliyoruz
    script.src = item.url + '?_adtest=' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    script.async = true;
    script.id = 'ad-check-' + item.id;

    let isResolved = false;

    const finalize = (isBlocked, reason) => {
      if (isResolved) return;
      isResolved = true;

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      if (isBlocked) {
        this.blockedCount++;
        console.warn(`[NonAdBlockEngine] ENGEL TESPİT EDİLDİ: ${item.id} (${reason})`);
      } else {
        console.log(`[NonAdBlockEngine] İSTEK BAŞARILI: ${item.id}`);
      }

      this.checkCompletionStatus();
    };

    // 1. Ağ Düzeyinde Engelleme (uBlock/AdGuard isteği tamamen yuttuysa)
    script.onerror = () => {
      finalize(true, 'Ağ İsteği Engellendi / onerror');
    };

    // 2. Yanıt Geldi Ama Surrogate / Fake mi Kontrolü
    script.onload = () => {
      // AdBlocker'lar 200 OK verip boş script basabileceği için 150ms bekle ve objeyi tara
      setTimeout(() => {
        const isRealScriptWorking = item.check();
        if (!isRealScriptWorking) {
          finalize(true, '200 OK Dündü Ancak Obje Manipüle Edildi (Mock Script)');
        } else {
          finalize(false, 'Script Orijinal');
        }
      }, 150);
    };

    // 3. Zaman Aşımı Kontrolü
    setTimeout(() => {
      if (!isResolved) {
        finalize(true, 'Zaman Aşımı (Timeout)');
      }
    }, this.options.timeoutLimit);

    // Doğrudan document.head içine basarak Network panelinde görünmesini garantiliyoruz
    (document.head || document.documentElement).appendChild(script);
  }

  checkCompletionStatus() {
    this.completedCount++;
    
    // Tüm script'ler tarandığında karara var
    if (this.completedCount >= this.targetScripts.length) {
      if (this.blockedCount > 0) {
        this.triggerProtection();
      } else {
        console.log('[NonAdBlockEngine] Tüm testler temiz. Reklam engelleyici aktif değil.');
      }
    }
  }

  triggerProtection() {
    if (this.isTriggered) return;
    this.isTriggered = true;

    if (typeof this.options.onDetected === 'function') {
      this.options.onDetected(this.blockedCount);
    } else {
      this.executeProtectionUI();
    }
  }

  executeProtectionUI() {
    if (this.options.strictMode) {
      document.body.innerHTML = '';
    }

    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100vw !important; height: 100vh !important; background: #0b0e14 !important;
      z-index: 2147483647 !important; display: flex !important; align-items: center !important;
      justify-content: center !important; font-family: system-ui, sans-serif !important;
    `;

    overlay.innerHTML = `
      <div style="background: #161b22; border: 1px solid #30363d; padding: 32px; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
        <h2 style="color: #f85149; margin: 0 0 12px 0; font-size: 20px;">Reklam Engelleme Tespit Edildi</h2>
        <p style="color: #8b949e; font-size: 13px; line-height: 1.5; margin: 0 0 20px 0;">
          Ağ paneli taramasında reklam kodlarının engellendiği saptandı. Lütfen bu site için eklentinizi devre dışı bırakın.
        </p>
        <button onclick="window.location.reload()" style="background: #238636; color: #fff; border: none; padding: 10px 20px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; width: 100%;">Sayfayı Yenile</button>
      </div>
    `;

    document.documentElement.appendChild(overlay);
  }
}
