class NonAdBlockEngine {
  constructor(config = {}) {
    this.config = Object.assign({
      baitScriptUrl: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      baitClasses: ['adsbygoogle', 'ad-zone', 'ad-space', 'pub_300x250', 'sponsor-ad'],
      detectionThreshold: 2,
      strictMode: true,
      onDetected: () => this.executeProtection()
    }, config);

    this.score = 0;
    this.isLocked = false;
  }

  async run() {
    const tests = [
      this.testNetworkBait(),
      this.testDOMInterference(),
      this.testGlobalVariables(),
      this.testBaitElementMetrics()
    ];

    const results = await Promise.all(tests);
    this.score = results.filter(Boolean).length;

    if (this.score >= this.config.detectionThreshold) {
      this.isLocked = true;
      this.config.onDetected();
    }
  }

  testNetworkBait() {
    return new Promise((resolve) => {
      const request = new Request(this.config.baitScriptUrl, { method: 'HEAD', mode: 'no-cors' });
      fetch(request)
        .then(() => resolve(false))
        .catch(() => resolve(true));
    });
  }

  testDOMInterference() {
    return new Promise((resolve) => {
      const bait = document.createElement('div');
      bait.className = this.config.baitClasses.join(' ');
      bait.id = 'ad-wrapper-test';
      bait.style.cssText = 'position:absolute!important;top:-9999px!important;left:-9999px!important;width:300px!important;height:250px!important;';

      document.body.appendChild(bait);

      requestAnimationFrame(() => {
        setTimeout(() => {
          const styles = window.getComputedStyle(bait);
          const isBlocked = bait.offsetParent === null ||
                            bait.offsetHeight === 0 ||
                            bait.offsetWidth === 0 ||
                            styles.getPropertyValue('display') === 'none' ||
                            styles.getPropertyValue('visibility') === 'hidden';

          bait.remove();
          resolve(isBlocked);
        }, 50);
      });
    });
  }

  testGlobalVariables() {
    return new Promise((resolve) => {
      const hasAdBlockGlobal = !!(
        window.google_ad_status ||
        window.__adblocker ||
        window.canRunAds === false ||
        window.uBlockOrigin
      );
      resolve(hasAdBlockGlobal);
    });
  }

  testBaitElementMetrics() {
    return new Promise((resolve) => {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.cssText = 'display:block!important;width:100px!important;height:100px!important;';
      document.body.appendChild(ins);

      setTimeout(() => {
        const rect = ins.getBoundingClientRect();
        const isCollapsed = rect.width === 0 || rect.height === 0;
        ins.remove();
        resolve(isCollapsed);
      }, 50);
    });
  }

  executeProtection() {
    if (this.config.strictMode) {
      document.body.innerHTML = '';
      document.head.innerHTML = '';
    }

    document.body.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('pointer-events', 'none', 'important');

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: #0d0f12 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      pointer-events: auto !important;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #161b22 !important;
      border: 1px solid #30363d !important;
      padding: 40px !important;
      border-radius: 12px !important;
      max-width: 440px !important;
      text-align: center !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6) !important;
    `;

    const title = document.createElement('h2');
    title.innerText = 'Erişim Engellendi';
    title.style.cssText = 'color: #f85149 !important; margin: 0 0 16px 0 !important; font-size: 22px !important;';

    const text = document.createElement('p');
    text.innerText = 'Sistemimiz aktif bir reklam engelleyici (AdBlock) tespit etti. Devam etmek için tarayıcı eklentinizi bu alan adı için devre dışı bırakmalısınız.';
    text.style.cssText = 'color: #8b949e !important; font-size: 14px !important; line-height: 1.6 !important; margin: 0 0 24px 0 !important;';

    const btn = document.createElement('button');
    btn.innerText = 'Sistemi Yeniden Taramaya Çalış';
    btn.style.cssText = `
      background: #238636 !important;
      color: #ffffff !important;
      border: none !important;
      padding: 12px 24px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      width: 100% !important;
    `;
    btn.onclick = () => window.location.reload();

    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(btn);
    modal.appendChild(card);

    document.documentElement.appendChild(modal);

    setInterval(() => {
      if (!document.documentElement.contains(modal)) {
        document.documentElement.appendChild(modal);
      }
    }, 250);
  }
}
