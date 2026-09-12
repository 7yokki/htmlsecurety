---

A-CHIT (Automated Code and Human Identification Test), sunucu yükünü hafifleten, istemci tarafında (client-side) çalışan gelişmiş bir bot tespit kütüphanesidir. Geleneksel görsel bulmacalar (görsel seçme, metin yazma) yerine kullanıcı davranışlarını ve donanım parmak izini arka planda analiz eder.

---

### A-CHIT Neye Dayanır? (Çalışma Prensibi)

A-CHIT, bot tespiti yaparken tek bir veriye bağımlı kalmaz. 4 ana güvenlik katmanını birleştirerek skor üretir:

1. **Mouse Kinematics (Eğim ve İvme Analizi):**
* Otomatik botlar ve headless tarayıcılar (Selenium, Puppeteer) fareyi genellikle ($A \rightarrow B$) dümdüz bir hat üzerinde veya sabit hızla hareket ettirir.
* A-CHIT, tıklama anına kadarki imleç koordinatlarından açısal sapmaları ($\theta$) ve hız değişimlerini ($dx/dt$) hesaplar. Kavisli ve ivmeli hareket insan; lineer/mükemmel hareket bot olarak işaretlenir.


2. **WebGL & GPU Fingerprinting:**
* Gizli bir canvas üzerinde donanım seviyesinde rendering testi gerçekleştirir.
* Ekran kartı sürücüsü (Vendor/Renderer) ve donanımsal WebGL desteği olmayan ortamlardan gelen istekleri tespit eder.


3. **Behavioral Persistence (Cookie & Storage Test):**
* Tarayıcının çerez (cookie) yönetimi, `localStorage` erişim izinleri ve oturum kalıcılığını sınar. Sandboxed veya izole bot ortamlarını ayırt eder.


4. **Runtime Polymorphism & SCRIPTDE Obfuscation:**
* Statik kod analizi ve reverse-engineering işlemlerini zorlaştırmak için dinamik `UUID` değişken haritalaması ve `SCRIPTDE` XOR runtime yorumlayıcısı kullanır. Kod her yüklendiğinde bellek nesne isimleri değişir.



---

### Entegrasyon Kılavuzu

Kütüphaneyi projenize dahil etmek son derece basittir. HTML kodunuza scripti ekleyip hedef div'i tanımlamanız yeterlidir.

**1. Kütüphaneyi ve HTML Elementini Ekleme:**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>A-CHIT Korumalı Form</title>
</head>
<body>

  <form id="loginForm">
    <input type="text" placeholder="Kullanıcı Adı" required /><br><br>
    
    <!-- A-CHIT Çerçevesinin Basılacağı Boş DIV -->
    <div id="achit"></div>
    <br>
    
    <button type="submit" id="submitBtn" disabled>Giriş Yap</button>
  </form>

  <!-- A-CHIT CDN / Remote Script -->
  <script src="https://7yokki.github.io/htmlsecurety/achit.js"></script>
  
  <script>
    // 2. A-CHIT Sistemini Tetikleme
    const achitInstance = new ACHIT();

    const submitBtn = document.getElementById("submitBtn");

    // 3. Başarılı Doğrulama Olayını Dinleme
    window.addEventListener("achit:success", function (e) {
      console.log("İnsan doğrulaması başarılı. Token:", e.detail.token);
      submitBtn.disabled = false; // Form gönderimini aktifleştir
    });

    // 4. Başarısız Doğrulama (Bot Şüphesi) Olayını Dinleme
    window.addEventListener("achit:fail", function () {
      console.warn("Bot şüphesi tespit edildi!");
      submitBtn.disabled = true;
    });
  </script>
</body>
</html>

```

---

### Olaylar (Events) ve Çıktı Yapısı

| Event Adı | Açıklama | Detail Çıktısı |
| --- | --- | --- |
| `achit:success` | Kullanıcı insan kriterlerini karşıladığında tetiklenir. | `{ detail: { token: "ACHIT_v_..." } }` |
| `achit:fail` | Lineer fare hareketi veya WebGL/Cookie eksikliğinde tetiklenir. | Bulunmuyor. |
