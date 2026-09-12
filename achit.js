(function (global) {
  "use strict";

  // Obfuskasyon Motoru - Rastgele Değişken İsmi Oluşturucu
  function _generateUUID() {
    return 'v_' + 'x' + 'xxxxxxxx_xxxx_4xxx_yxxx_xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }).replace(/_/g, '');
  }

  // Runtime Scope Obfuskasyonu
  function _obfuscateScope(internalState) {
    var obfuscatedMap = {};
    for (var key in internalState) {
      if (internalState.hasOwnProperty(key)) {
        var randomVarName = _generateUUID();
        obfuscatedMap[randomVarName] = internalState[key];
      }
    }
    return obfuscatedMap;
  }

  var ACHIT = function () {
    // Statik değişken isimlerini dinamik haritaya bağlama (Obfuscated Runtime)
    this._state = _obfuscateScope({
      mouseLog: [],
      startTime: Date.now(),
      isHuman: false,
      token: null,
      webglSig: null,
      cookieScore: 0
    });

    this.container = document.getElementById("achit");
    if (!this.container) {
      console.error("A-CHIT: 'achit' ID'li div bulunamadı.");
      return;
    }

    this._initUI();
    this._bindEvents();
    this._runWebGLTest();
    this._analyzeCookieContext();
  };

  ACHIT.prototype._initUI = function () {
    this.container.innerHTML = `
      <style>
        .achit-box {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: #f9f9f9;
          border: 1px solid #d3d3d3;
          border-radius: 6px;
          padding: 12px 16px;
          font-family: system-ui, -apple-system, sans-serif;
          user-select: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .achit-checkbox {
          width: 22px;
          height: 22px;
          border: 2px solid #c1c1c1;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.2s, background 0.2s;
        }
        .achit-checkbox.checked {
          background: #22c55e;
          border-color: #16a34a;
        }
        .achit-checkbox.checked::after {
          content: '✓';
          color: white;
          font-size: 14px;
          font-weight: bold;
        }
        .achit-label {
          font-size: 14px;
          color: #333;
          font-weight: 500;
        }
        .achit-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #ccc;
          border-top-color: #333;
          border-radius: 50%;
          animation: achit-spin 0.6s linear infinite;
          display: none;
        }
        @keyframes achit-spin { to { transform: rotate(360deg); } }
      </style>
      <div class="achit-box">
        <div class="achit-checkbox" id="achit-cb"></div>
        <div class="achit-spinner" id="achit-sp"></div>
        <span class="achit-label">Ben robot değilim</span>
      </div>
    `;
  };

  ACHIT.prototype._bindEvents = function () {
    var self = this;
    var mouseTracker = function (e) {
      // Dinamik runtime haritasına fare verisini kaydet
      var logKey = Object.keys(self._state)[0]; // mouseLog temsilcisi
      self._state[logKey].push({
        x: e.clientX,
        y: e.clientY,
        t: Date.now()
      });
    };

    window.addEventListener("mousemove", mouseTracker);

    var cb = document.getElementById("achit-cb");
    cb.addEventListener("click", function () {
      window.removeEventListener("mousemove", mouseTracker);
      self._verify();
    });
  };

  // WebGL Render & GPU Fingerprint Analizi
  ACHIT.prototype._runWebGLTest = function () {
    try {
      var canvas = document.createElement("canvas");
      var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) {
        this._state[Object.keys(this._state)[4]] = "no_webgl";
        return;
      }

      var debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      var vendor = gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
      var renderer = gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER);

      // Basit 2D Render Çıktısı Hashleme
      gl.clearColor(0.2, 0.4, 0.6, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      this._state[Object.keys(this._state)[4]] = btoa(vendor + "::" + renderer).substring(0, 32);
    } catch (e) {
      this._state[Object.keys(this._state)[4]] = "err_webgl";
    }
  };

  // Cookie ve Oturum Kalıcılık İncelemesi
  ACHIT.prototype._analyzeCookieContext = function () {
    var score = 0;
    if (navigator.cookieEnabled) score += 40;
    if (document.cookie && document.cookie.length > 0) score += 30;
    
    // LocalStorage yetki analizi
    try {
      localStorage.setItem("__achit_test", "1");
      localStorage.removeItem("__achit_test");
      score += 30;
    } catch (e) {}

    this._state[Object.keys(this._state)[5]] = score;
  };

  // İnsan / Bot Karar Mekanizması (Eğrilik ve Hız Analizi)
  ACHIT.prototype._verify = function () {
    var cb = document.getElementById("achit-cb");
    var sp = document.getElementById("achit-sp");
    cb.style.display = "none";
    sp.style.display = "block";

    var logs = this._state[Object.keys(this._state)[0]];
    var isHuman = false;

    if (logs.length > 5) {
      var totalCurvature = 0;
      var velocityVariations = [];

      for (var i = 2; i < logs.length; i++) {
        var p1 = logs[i - 2], p2 = logs[i - 1], p3 = logs[i];
        
        // Açısal Değişim (Eğim / Curvature)
        var angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        var angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        totalCurvature += Math.abs(angle2 - angle1);

        // Hız Değişimi
        var dist = Math.hypot(p3.x - p2.x, p3.y - p2.y);
        var dt = (p3.t - p2.t) || 1;
        velocityVariations.push(dist / dt);
      }

      // İnsan farenin yönünü değiştirir (kavis çizer) ve hızı sabit değildir.
      var avgCurvature = totalCurvature / logs.length;
      var isLinear = avgCurvature < 0.05; // Tam doğru çizgide giden botlar
      
      if (!isLinear && velocityVariations.length > 0) {
        isHuman = true;
      }
    }

    // WebGL ve Cookie skor durumunu ekle
    var cookieScore = this._state[Object.keys(this._state)[5]];
    var webglSig = this._state[Object.keys(this._state)[4]];

    if (cookieScore < 40 || !webglSig) {
      isHuman = false;
    }

    setTimeout(() => {
      sp.style.display = "none";
      cb.style.display = "flex";

      if (isHuman) {
        cb.classList.add("checked");
        var token = "ACHIT_TOKEN_" + _generateUUID() + "." + btoa(JSON.stringify({
          webgl: webglSig,
          cs: cookieScore,
          ts: Date.now()
        }));
        this._state[Object.keys(this._state)[3]] = token;
        
        // Başarılı doğrulama olayı fırlat
        window.dispatchEvent(new CustomEvent("achit:success", { detail: { token: token } }));
      } else {
        alert("Bot şüphesi tespit edildi. Doğrulama başarısız.");
        window.dispatchEvent(new CustomEvent("achit:fail"));
      }
    }, 600);
  };

  global.ACHIT = ACHIT;
})(window);
