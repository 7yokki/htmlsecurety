# NonAdBlockEngineV6 Dokümantasyonu

**NonAdBlockEngineV6**, tarayıcı tabanlı reklam engelleyicileri (uBlock Origin, AdGuard, Brave Shield vb.) tespit etmek amacıyla geliştirilmiş, **sezgisel ağ analizi**, **surrogate (sahte yanıt) doğrulaması** ve **skor tabanlı karar mekanizmasına** sahip modüler bir JavaScript kütüphanesidir.

---

## 1. Çalışma Mantığı ve Mimarisi

Geleneksel reklam engelleyici tespit sistemleri yalnızca basit DOM elemanlarının gizlenip gizlenmediğini (`display: none`) kontrol eder. Gelişmiş engelleyiciler bu yöntemleri kolayca geçebildiği için `NonAdBlockEngineV6` şu multi-layer tespit mantığına dayanır:

* **Gerçek DOM Script Enjeksiyonu:** Test edilmek istenen popüler reklam ağlarına ait betikler `<script>` elementi olarak doğrudan `document.head` içerisine enjekte edilir. Bu sayede tarayıcının DevTools **Network (Ağ)** panelinde gerçek ağ istekleri tetiklenir.
* **Sahte 200 OK (Surrogate) Tespiti:** Modern eklentiler ağ isteğini tamamen engellemek yerine tarayıcıya boş/işlevsiz bir `200 OK` yanıtı döner. Engine, `onload` tetiklense bile global window nesnelerini (`window.adsbygoogle`, `window.googletag` vb.) kontrol ederek betiğin işlevsel olup olmadığını doğrular.
* **Skor Tabanlı Tolerans Sistemi:** Tek bir sunucu hatası veya ağ kopukluğunun yanlış pozitif (false-positive) üreterek kullanıcıyı engellemesini önler. Sistem iki aşamalı doğrulamaya sahiptir:
1. `minBlockedThreshold`: Minimum engellenen kaynak sayısı.
2. `thresholdRatio`: Toplam kaynaklara göre engellenme oranı.


* **Olay Tabanlı Günlükleme (Logging):** Tüm işlemler zaman damgalı ve seviyelendirilmiş (`DEBUG`, `INFO`, `WARN`, `ERROR`) biçimde kayıt altına alınır.

---

## 2. Parametreler ve Konfigürasyon (`options`)

Sınıfı başlatırken `new NonAdBlockEngineV6(options)` içerisine aktarılabilecek varsayılan parametreler:

| Parametre | Tip | Varsayılan | Açıklama |
| --- | --- | --- | --- |
| `timeoutLimit` | `number` | `4000` | Bir script yanıtı için milisaniye cinsinden maksimum bekleme süresi. |
| `strictMode` | `boolean` | `true` | Engelleme tespit edildiğinde `document.body` içeriğini tamamen siler. |
| `enableConsoleLog` | `boolean` | `true` | Konsola renkli ve yapılandırılmış log basılıp basılmayacağı. |
| `thresholdRatio` | `number` | `0.5` | Toplam scriptlerin engellenme oranı sınırı (Örn: 0.5 = %50 ve üzeri). |
| `minBlockedThreshold` | `number` | `2` | Engelleyici kabul edilmesi için gereken en az engellenen script sayısı. |
| `onDetected` | `function` | `null` | Engelleme kesinleştiğinde çalışacak özel callback: `(blockedCount, logs) => {}`. |
| `onLog` | `function` | `null` | Üretilen her log nesnesini yakalayan callback: `(logObject) => {}`. |

---

## 3. Kullanım Örnekleri

### Temel Kullanım (Varsayılan Arayüz İle)

```html
<script src="nonadblock.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const engine = new NonAdBlockEngineV6({
      timeoutLimit: 3000,
      strictMode: true,
      minBlockedThreshold: 2,
      thresholdRatio: 0.4
    });

    engine.startInspectionEngine();
  });
</script>

```

### Özel Callback ve Analitik Entegrasyonu

Tespit durumunda sayfa içeriğini silmek yerine kendi modal yapınızı veya analitik servisinizi (Google Analytics, Sentry vb.) bağlayabilirsiniz:

```javascript
const engine = new NonAdBlockEngineV6({
  enableConsoleLog: true,
  minBlockedThreshold: 2,
  onDetected: (blockedCount, logs) => {
    console.warn(`Sistemde ${blockedCount} adet kaynak engellendi!`);
    
    // Logları analitik sunucusuna aktarma
    fetch('/api/analytics/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'ADBLOCK_DETECTED', details: logs })
    });

    // Özel modal gösterme
    document.getElementById('custom-adblock-modal').style.display = 'block';
  },
  onLog: (logEntry) => {
    // Anlık log takibi
    if (logEntry.level === 'ERROR') {
      console.error('Kritik Olay:', logEntry.event);
    }
  }
});

engine.startInspectionEngine();

```

---

## 4. Metodlar

* **`startInspectionEngine()`**: Taramayı başlatır. DOM yüklenmediyse `DOMContentLoaded` olayını bekler.
* **`getLogs()`**: O an birikmiş olan tüm log geçmişini dizi (`Array`) formatında döner.
* **`exportLogsAsJSON()`**: Log geçmişini biçimlendirilmiş `JSON` metni olarak döner (Hata raporlama için uygundur).
