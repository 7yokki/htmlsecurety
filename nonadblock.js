class NonAdBlockEngineV5 {
  constructor(options = {}) {
    this.options = Object.assign({
      timeoutLimit: 3000,
      strictMode: true,
      onDetected: null
    }, options);

    // Ağ panelinde (Network) GERÇEK ISTEK atacak script listesi
    // Not: Bu URL'ler popüler reklam ağlarının doğrudan script adresleridir.
    this.targetScripts = [
      { id: 'google_ads', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', check: () => window.adsbygoogle },
      { id: 'adroll', url: 'https://s.adroll.com/j/roundtrip.js', check: () => window.__adroll_loaded },
      { id: 'taboola', url: 'https://cdn.taboola.com/libtrc/unsupported-browser/tfa.js', check: () => window._taboola },
      { id: 'outbrain', url: 'https://widgets.outbrain.com/outbrain.js', check: () => window.OBR }
    ];

    this.blockedCount = 0;
    this.completedCount = 0;
  }

  startInspectionEngine() {
    console.log('[NonAdBlockEngine] Gerçek DOM script istekleri başlatılıyor...');

    this.targetScripts.forEach(item => {
      this.injectScriptAndVerify(item);
    });
  }

  injectScriptAndVerify(item) {
    // Network panelinde çıkması için gerçek <script> elementi oluşturuyoruz
    const script = document.createElement('script');
    script.src = item.url + '?_nc=' + Date.now(); // Cache önlemek için timestamp
    script.async = true;
    script.id = 'chk-' + item.id;

    let resolved = false;

    const cleanup = () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    // 1. Durum: Ağ seviyesinde tamamen engellendi (uBlock/AdGuard URL'i kesti)
    script.onerror = () => {
      if (resolved) return;
      resolved = true;
      console.warn(`[NonAdBlockEngine] AĞ ENGELİ: ${item.id} (onerror tetiklendi)`);
      this.blockedCount++;
      this.checkCompletion();
      cleanup();
    };

    // 2. Durum: Script yüklendi (Ama surrogate/fake mi yoksa gerçek mi?)
    script.onload = () => {
      if (resolved) return;
      resolved = true;

      // AdBlocker'lar bazen 200 OK verip içi boş (surrogate) script döndürür.
      // Bu yüzden script yüklenmiş olsa bile global nesneyi/fonksiyonu kontrol ediyoruz:
      setTimeout(() => {
        const isRealScriptWorking = item.check();

        if (!isRealScriptWorking && this.options.strictMode) {
          console.warn(`[NonAdBlockEngine] FAKE/SURROGATE YANIT: ${item.id} 200 OK döndü ancak nesne tanımlanmadı!`);
          this.blockedCount++;
        } else {
          console.log(`[NonAdBlockEngine] BAŞARILI: ${item.id} yüklendi ve doğrulandı.`);
        }

        this.checkCompletion();
        cleanup();
      }, 200);
    };

    // 3. Durum: Zaman aşımı (Yanıt vermeyen veya sessizce yutulan istekler)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`[NonAdBlockEngine] ZAMAN AŞIMI: ${item.id} isteğine yanıt alınamadı.`);
        this.blockedCount++;
        this.checkCompletion();
        cleanup();
      }
    }, this.options.timeoutLimit);

    // Elementi HEAD içine ekleyerek indirmeyi başlatıyoruz (Network panelinde görünür)
    (document.head || document.documentElement).appendChild(script);
  }

  checkCompletion() {
    this.completedCount++;
    if (this.completedCount >= this.targetScripts.length) {
      if (this.blockedCount > 0) {
        if (typeof this.options.onDetected === 'function') {
          this.options.onDetected(`Toplam ${this.blockedCount} reklam kaynağı engellendi veya manipüle edildi.`);
        } else {
          this.executeProtection();
        }
      } else {
        console.log('[NonAdBlockEngine] Temiz. Reklam engelleyici tespit edilmedi.');
      }
    }
  }

  executeProtection() {
    document.body.innerHTML = '';
    alert('Reklam engelleyici tespit edildi. Lütfen eklentinizi kapatıp sayfayı yenileyin.');
    window.location.reload();
  }
}
