class NonAdBlockEngineV2 {
  constructor(config = {}) {
    this.config = Object.assign({
      baitUrls: [
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
        'https://googleads.g.doubleclick.net/pagead/id',
        'https://static.criteo.net/js/ld/ld.js'
      ],
      baitClasses: [
        'adsbygoogle', 'ad-banner', 'ad-zone', 'ad-space',
        'pub_300x250', 'sponsor-ad', 'text-ad-links'
      ],
      strictMode: true,
      onDetected: () => this.executeProtection()
    }, config);

    this.isDetected = false;
  }

  async run() {
    // 1. Hızlı Senkron Kontroller
    if (this.checkInjectedStyles() || this.checkGlobalProxies()) {
      return this.triggerDetection();
    }

    // 2. Derin Asenkron Kontroller (Ağ & DOM)
    const [networkBlocked, domBlocked, metricBlocked] = await Promise.all([
      this.checkNetworkPayloads(),
      this.checkDOMBait(),
      this.checkReflowMetrics()
    ]);

    if (networkBlocked || domBlocked || metricBlocked) {
      return this.triggerDetection();
    }

    // 3. Late-Injection Taraması (AdBlock eklentilerinin gecikmeli müdahalesine karşı)
    setTimeout(async () => {
      const lateDomCheck = await this.checkDOMBait();
      if (lateDomCheck && !this.isDetected) {
        this.triggerDetection();
      }
    }, 450);
  }

  triggerDetection() {
    if (this.isDetected) return;
    this.isDetected = true;
    this.config.onDetected();
  }

  // Modern eklentilerin sayfaya gömdüğü gizli kural stili taraması
  checkInjectedStyles() {
    const headStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
    for (let style of headStyles) {
      const content = style.innerHTML || '';
      if (content.includes('adsbygoogle') && (content.includes('display:none') || content.includes('important'))) {
        return true;
      }
    }
    return false;
  }

  // Eklentilerin iz bıraktığı global objeleri kontrol etme
  checkGlobalProxies() {
    return !!(
      window.__adblocker ||
      window.uBlockOrigin ||
      window.canRunAds === false ||
      (window.google_ad_status && window.google_ad_status === 3)
    );
  }

  // Dönen yanıtın boş (0 byte / dummy response) olup olmadığını kontrol eder
  async checkNetworkPayloads() {
    for (let url of this.config.baitUrls) {
      try {
        const response = await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
        // no-cors modunda response.type 'opaque' döner. Eğer ablock isteği tamamen yuttuysa throw eder veya status 0 kalır.
        if (!response) return true;
      } catch (e) {
        return true;
      }
    }
    return false;
  }

  // Reflow zorlaması ile DOM tespiti
  checkDOMBait() {
    return new Promise((resolve) => {
      const bait = document.createElement('div');
      bait.className = this.config.baitClasses.join(' ');
      bait.id = 'ad-wrapper-v2-test';
      bait.setAttribute('data-ad-client', 'ca-pub-0000000000000000');
      bait.style.cssText = 'position:absolute!important;top:-9999px!important;left:-9999px!important;width:300px!important;height:250px!important;display:block!important;visibility:visible!important;';

      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.cssText = 'display:block!important;width:100%!important;height:100%!important;';
      bait.appendChild(ins);

      document.body.appendChild(bait);

      requestAnimationFrame(() => {
        setTimeout(() => {
          const rect = bait.getBoundingClientRect();
          const clientRects = bait.getClientRects();
          const styles = window.getComputedStyle(bait);

          const isBlocked = (
            rect.width === 0 ||
            rect.height === 0 ||
            clientRects.length === 0 ||
            styles.getPropertyValue('display') === 'none' ||
            styles.getPropertyValue('visibility') === 'hidden' ||
            bait.offsetParent === null
          );

          bait.remove();
          resolve(isBlocked);
        }, 80);
      });
    });
  }

  // Reklam alanının zorla boyutlandırılmasını sınama
  checkReflowMetrics() {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      container.className = 'pub_300x250 text-ad-links';
      container.style.cssText = 'width:1px;height:1px;position:absolute;left:-999px;';
      document.body.appendChild(container);

      setTimeout(() => {
        const blocked = container.offsetHeight === 0 || container.offsetWidth === 0;
        container.remove();
        resolve(blocked);
      }, 50);
    });
  }

  executeProtection() {
    if (this.config.strictMode) {
      document.body.innerHTML = '';
    }

    document.body.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('pointer-events', 'none', 'important');

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100vw !important; height: 100vh !important; background: #0b0e14 !important;
      z-index: 2147483647 !important; display: flex !important; align-items: center !important;
      justify-content: center !important; font-family: system-ui, sans-serif !important;
      pointer-events: auto !important;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #161b22 !important; border: 1px solid #30363d !important;
      padding: 32px !important; border-radius: 8px !important; max-width: 400px !important;
      text-align: center !important; box-shadow: 0 10px 30px rgba(0,0,0,0.8) !important;
    `;

    card.innerHTML = `
      <h2 style="color: #f85149 !important; margin: 0 0 12px 0 !important; font-size: 20px !important;">Reklam Engelleyici Saptandı</h2>
      <p style="color: #8b949e !important; font-size: 13px !important; line-height: 1.5 !important; margin: 0 0 20px 0 !important;">
        Sayfadaki içeriklerin yüklenebilmesi için tarayıcınızdaki AdBlock uzantısını kapatmanız veya bu alan adını istisnalara eklemeniz gerekmektedir.
      </p>
      <button id="nonadblock-reload-btn" style="
        background: #238636 !important; color: #fff !important; border: none !important;
        padding: 10px 20px !important; font-size: 13px !important; font-weight: 600 !important;
        border-radius: 6px !important; cursor: pointer !important; width: 100% !important;
      ">Engelleyiciyi Kapattım, Yenile</button>
    `;

    modal.appendChild(card);
    document.documentElement.appendChild(modal);

    document.getElementById('nonadblock-reload-btn').onclick = () => window.location.reload();

    setInterval(() => {
      if (!document.documentElement.contains(modal)) {
        document.documentElement.appendChild(modal);
      }
    }, 200);
  }
}
