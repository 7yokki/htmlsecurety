class NonAdBlockEngineV6 {
  constructor(options = {}) {
    this.options = Object.assign({
      timeoutLimit: 4000,
      strictMode: true,
      enableConsoleLog: true, // Konsola renkli log basma aktif/pasif
      onDetected: null,
      onLog: null // Özel log dinleyici callback: (logObject) => {}
    }, options);

    this.targetScripts = [
      { id: 'googlesyndication', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', check: () => !!window.adsbygoogle },
      { id: 'doubleclick', url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', check: () => !!window.googletag },
      { id: 'amazon_ads', url: 'https://c.amazon-adsystem.com/aax2/amzn_ads.js', check: () => !!window.amznads },
      { id: 'criteo', url: 'https://static.criteo.net/js/ld/ld.js', check: () => !!window.criteo_q }
    ];

    this.blockedCount = 0;
    this.completedCount = 0;
    this.isTriggered = false;
    this.logs = []; // Tüm sistem loglarını tutan bellek
  }

  // --- LOGGING SİSTEMİ ---
  log(level, event, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(), // DEBUG, INFO, WARN, ERROR
      event: event,
      details: details
    };

    this.logs.push(entry);

    if (this.options.enableConsoleLog) {
      const styles = {
        DEBUG: 'color: #8b949e; font-weight: bold;',
        INFO: 'color: #58a6ff; font-weight: bold;',
        WARN: 'color: #d29922; font-weight: bold;',
        ERROR: 'color: #f85149; font-weight: bold;'
      };
      console.log(
        `%c[NonAdBlockEngine][${entry.level}] %c${entry.event}`,
        styles[entry.level] || '',
        'color: inherit;',
        Object.keys(details).length ? details : ''
      );
    }

    if (typeof this.options.onLog === 'function') {
      this.options.onLog(entry);
    }
  }

  getLogs() {
    return this.logs;
  }

  exportLogsAsJSON() {
    return JSON.stringify(this.logs, null, 2);
  }

  // --- CORE ENGINE ---
  startInspectionEngine() {
    this.log('INFO', 'ENGINE_START', { targetCount: this.targetScripts.length, config: this.options });

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
    const cacheBuster = Date.now() + '_' + Math.floor(Math.random() * 1000);
    const targetUrl = item.url + '?_adtest=' + cacheBuster;

    const script = document.createElement('script');
    script.src = targetUrl;
    script.async = true;
    script.id = 'ad-check-' + item.id;

    let isResolved = false;

    this.log('DEBUG', 'SCRIPT_INJECTED', { id: item.id, url: targetUrl });

    const finalize = (isBlocked, reason, level = 'WARN') => {
      if (isResolved) return;
      isResolved = true;

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      if (isBlocked) {
        this.blockedCount++;
        this.log(level, 'SCRIPT_BLOCKED', { id: item.id, reason: reason });
      } else {
        this.log('INFO', 'SCRIPT_PASSED', { id: item.id, reason: reason });
      }

      this.checkCompletionStatus();
    };

    // 1. Ağ Engeli (onerror)
    script.onerror = () => {
      finalize(true, 'Network request blocked (onerror triggered)', 'WARN');
    };

    // 2. Yanıt ve Surrogate Kontrolü (onload)
    script.onload = () => {
      setTimeout(() => {
        const isRealScriptWorking = item.check();
        if (!isRealScriptWorking) {
          finalize(true, '200 OK returned but global object is missing/manipulated (Surrogate response)', 'ERROR');
        } else {
          finalize(false, 'Script loaded and verified successfully', 'INFO');
        }
      }, 150);
    };

    // 3. Timeout Kontrolü
    setTimeout(() => {
      if (!isResolved) {
        finalize(true, `Request timed out after ${this.options.timeoutLimit}ms`, 'WARN');
      }
    }, this.options.timeoutLimit);

    (document.head || document.documentElement).appendChild(script);
  }

  checkCompletionStatus() {
    this.completedCount++;
    
    this.log('DEBUG', 'PROGRESS_UPDATE', { 
      completed: this.completedCount, 
      total: this.targetScripts.length, 
      blockedSoFar: this.blockedCount 
    });

    if (this.completedCount >= this.targetScripts.length) {
      this.log('INFO', 'INSPECTION_COMPLETE', { 
        totalBlocked: this.blockedCount, 
        isClean: this.blockedCount === 0 
      });

      if (this.blockedCount > 0) {
        this.triggerProtection();
      } else {
        this.log('INFO', 'SYSTEM_CLEAN', { message: 'No adblocker detected.' });
      }
    }
  }

  triggerProtection() {
    if (this.isTriggered) return;
    this.isTriggered = true;

    this.log('ERROR', 'PROTECTION_TRIGGERED', { blockedCount: this.blockedCount });

    if (typeof this.options.onDetected === 'function') {
      this.options.onDetected(this.blockedCount, this.getLogs());
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
