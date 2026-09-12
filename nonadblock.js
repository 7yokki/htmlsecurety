class NonAdBlockEngineV3 {
  constructor(config = {}) {
    this.config = Object.assign({
      baitUrls: [
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
        'https://static.criteo.net/js/ld/ld.js'
      ],
      baitClasses: ['adsbygoogle', 'ad-zone', 'ad-space', 'pub_300x250', 'sponsor-ad'],
      heuristicKeywords: [/adblock/i, /ublock/i, /adguard/i, /ad-blocker/i, /block-ads/i],
      minMockSize: 2000,
      scoreThreshold: 3,
      strictMode: true,
      onDetected: () => this.executeProtection()
    }, config);

    this.blockScore = 0;
    this.isDetected = false;
  }

  async run() {
    this.scanDOMHeuristics();
    this.checkGlobalProperties();

    const [mockDetected, domBlocked] = await Promise.all([
      this.checkMockPayloads(),
      this.checkDOMBait()
    ]);

    if (mockDetected) this.blockScore += 3;
    if (domBlocked) this.blockScore += 2;

    if (this.blockScore >= this.config.scoreThreshold) {
      this.triggerDetection();
    }
  }

  triggerDetection() {
    if (this.isDetected) return;
    this.isDetected = true;
    this.config.onDetected();
  }

  // 1. Mock Data / 200 OK Yanıt Analizi
  async checkMockPayloads() {
    for (let url of this.config.baitUrls) {
      try {
        const response = await fetch(url, { method: 'GET', cache: 'no-store' });
        const text = await response.text();

        // 200 OK dönse bile içerik boşsa, çok küçükse veya no-op yorumu içeriyorsa
        if (
          text.length < this.config.minMockSize ||
          text.includes('noop') ||
          text.includes('google_ad_status') === false
        ) {
          return true;
        }
      } catch (e) {
        return true;
      }
    }
    return false;
  }

  // 2. Sezgisel (Heuristic) DOM ve Eklenti İzi Taraması
  scanDOMHeuristics() {
    const elements = document.querySelectorAll('script, style, link, div, iframe');

    elements.forEach((el) => {
      const attributes = [el.id, el.className, el.src, el.href].filter(Boolean).join(' ');

      this.config.heuristicKeywords.forEach((regex) => {
        if (regex.test(attributes)) {
          this.blockScore += 1;
        }
      });

      if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') {
        const content = el.innerHTML || '';
        if (/display\s*:\s*none\s*!important/i.test(content) && /ad/i.test(content)) {
          this.blockScore += 2;
        }
      }
    });
  }

  // 3. Global Obje Sabitleme / Tampering Tespiti
  checkGlobalProperties() {
    if (window.adsbygoogle && Array.isArray(window.adsbygoogle) && window.adsbygoogle.length === 0) {
      try {
        window.adsbygoogle.push({});
        if (window.adsbygoogle.length === 0) {
          this.blockScore += 2;
        }
      } catch (e) {
        this.blockScore += 2;
      }
    }

    if (window.canRunAds === false || window.isAdBlockActive === true) {
      this.blockScore += 3;
    }
  }

  // 4. Reflow & Layout Bounding Box Testi
  checkDOMBait() {
    return new Promise((resolve) => {
      const bait = document.createElement('div');
      bait.className = this.config.baitClasses.join(' ');
      bait.style.cssText = 'position:absolute!important;top:-9999px!important;left:-9999px!important;width:300px!important;height:250px!important;display:block!important;';

      document.body.appendChild(bait);

      requestAnimationFrame(() => {
        setTimeout(() => {
          const rect = bait.getBoundingClientRect();
          const styles = window.getComputedStyle(bait);

          const isBlocked = (
            rect.width === 0 ||
            rect.height === 0 ||
            styles.getPropertyValue('display') === 'none' ||
            styles.getPropertyValue('visibility') === 'hidden'
          );

          bait.remove();
          resolve(isBlocked);
        }, 60);
      });
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
      <h2 style="color: #f85149 !important; margin: 0 0 12px 0 !important; font-size: 20px !important;">Sistem Kilitlendi</h2>
      <p style="color: #8b949e !important; font-size: 13px !important; line-height: 1.5 !important; margin: 0 0 20px 0 !important;">
        Gelişmiş bir reklam engelleyici veya gizlilik eklentisi tespit edildi. Lütfen bu alan adı için eklentinizi tamamen kapatın.
      </p>
      <button id="nonadblock-reload-btn" style="
        background: #238636 !important; color: #fff !important; border: none !important;
        padding: 10px 20px !important; font-size: 13px !important; font-weight: 600 !important;
        border-radius: 6px !important; cursor: pointer !important; width: 100% !important;
      ">Yeniden Tara ve Aç</button>
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
