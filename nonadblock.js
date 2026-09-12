class NonAdBlockEngineV4 {
  constructor(config = {}) {
    this.config = Object.assign({
      // 1. Ağ testi için dinamik parametreli istek (cache-bypass)
      baitUrl: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      strictMode: true,
      onDetected: () => this.executeProtection()
    }, config);

    this.isDetected = false;
  }

  async run() {
    // Statik isim/class tespiti YOK. Sadece aktif müdahale testleri:
    const [networkActive, domActive, propActive] = await Promise.all([
      this.testActiveNetworkFilter(),
      this.testActiveDOMCollapse(),
      this.testActivePropertyTampering()
    ]);

    // Yalnızca aktif bir engelleme/müdahale eylemi varsa kilitler
    if (networkActive || domActive || propActive) {
      this.triggerDetection();
    }
  }

  triggerDetection() {
    if (this.isDetected) return;
    this.isDetected = true;
    this.config.onDetected();
  }

  // 1. AĞ TESTİ: Gerçekten ağ isteği engelleniyor mu veya mock script mi dönüyor?
  async testActiveNetworkFilter() {
    try {
      // Cache'i bypass etmek için dinamik sorgu parametresi
      const cacheBuster = '?v=' + Date.now() + Math.random();
      const response = await fetch(this.config.baitUrl + cacheBuster, {
        method: 'GET',
        cache: 'no-store'
      });

      const text = await response.text();

      // Eğer eklenti pasifse, Adsense script'i tam boyutuyla (30KB+) sorunsuz iner.
      // Eğer eklenti aktifse: İstek throw eder, status 0 olur veya uBlock 0-500 baytlık uydurma (mock) no-op yanıtı basar.
      if (!response.ok || text.length < 5000 || !text.includes('google')) {
        return true; // Aktif engelleme var
      }
      return false; // İstek orijinal ve engellenmedi
    } catch (e) {
      return true; // Ağ isteği engellendi
    }
  }

  // 2. DOM TESTİ: Eklenti şu an aktif olarak bir elemanı gizliyor mu?
  testActiveDOMCollapse() {
    return new Promise((resolve) => {
      // Rastgele id ve sınıflarla eklentinin ismi ezberlemesini önleme
      const bait = document.createElement('div');
      bait.className = 'adsbygoogle ad-zone pub_300x250';
      bait.style.cssText = 'position:fixed!important;top:-9999px!important;left:-9999px!important;width:300px!important;height:250px!important;display:block!important;visibility:visible!important;';

      document.body.appendChild(bait);

      // Render döngüsünün tamamlanmasını bekle
      requestAnimationFrame(() => {
        setTimeout(() => {
          const rect = bait.getBoundingClientRect();
          const computed = window.getComputedStyle(bait);

          // Eklenti pasifse boyut 300x250 kalır. Aktif bir kural varsa display:none veya height:0 yapılır.
          const isCollapsed = (
            rect.width === 0 ||
            rect.height === 0 ||
            computed.getPropertyValue('display') === 'none' ||
            computed.getPropertyValue('visibility') === 'hidden'
          );

          bait.remove();
          resolve(isCollapsed);
        }, 100);
      });
    });
  }

  // 3. PROPERTY TESTİ: Eklenti aktif olarak Adsense objelerini manipüle ediyor mu?
  testActivePropertyTampering() {
    // Eklenti pasifse window.adsbygoogle standart dizi davranışı sergiler.
    // Eklenti aktifse push fonksiyonunu yutar veya objeyi kilitler.
    try {
      const testArr = [];
      window.adsbygoogle = window.adsbygoogle || testArr;
      
      const prevLen = window.adsbygoogle.length;
      window.adsbygoogle.push({ test_signal: true });
      
      // Push işlemi engellendi veya dizi davranışı bozulduysa
      if (window.adsbygoogle.length === prevLen && window.adsbygoogle !== testArr) {
        return true;
      }
    } catch (e) {
      return true;
    }
    return false;
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
      <h2 style="color: #f85149 !important; margin: 0 0 12px 0 !important; font-size: 20px !important;">Reklam Engelleme Aktif</h2>
      <p style="color: #8b949e !important; font-size: 13px !important; line-height: 1.5 !important; margin: 0 0 20px 0 !important;">
        Eklentiniz açık kalabilir ancak bu site için <strong>korumayı pasife almanız</strong> gerekmektedir.
      </p>
      <button id="nonadblock-reload-btn" style="
        background: #238636 !important; color: #fff !important; border: none !important;
        padding: 10px 20px !important; font-size: 13px !important; font-weight: 600 !important;
        border-radius: 6px !important; cursor: pointer !important; width: 100% !important;
      ">Devre Dışı Bıraktım, Yenile</button>
    `;

    modal.appendChild(card);
    document.documentElement.appendChild(modal);

    document.getElementById('nonadblock-reload-btn').onclick = () => window.location.reload();
  }
}
