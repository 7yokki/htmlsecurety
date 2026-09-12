class NonAdBlockEngineV6 {
  constructor(options = {}) {
    this.options = Object.assign({
      timeoutLimit: 4000,
      strictMode: true,
      enableConsoleLog: true,
      thresholdRatio: 0.5,
      minBlockedThreshold: 2,
      onDetected: null,
      onLog: null
    }, options);

    this.targetScripts = [
      {
        id: 'googlesyndication',
        url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
        check: () => !!window.adsbygoogle
      },
      {
        id: 'doubleclick_gpt',
        url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
        check: () => !!window.googletag
      },
      {
        id: 'amazon_ads',
        url: 'https://c.amazon-adsystem.com/aax2/amzn_ads.js',
        check: () => !!window.amznads
      },
      {
        id: 'criteo',
        url: 'https://static.criteo.net/js/ld/ld.js',
        check: () => !!window.criteo_q
      },
      {
        id: 'taboola',
        url: 'https://cdn.taboola.com/libtrc/unsupported-browser/tfa.js',
        check: () => !!window._taboola
      },
      {
        id: 'openx_topics',
        url: 'https://pa.openx.net/topics_frame.html',
        check: () => !!window.OX
      },
      {
        id: 'pubmatic_topics',
        url: 'https://ads.pubmatic.com/AdServer/js/topics/topics_frame.html',
        check: () => !!window.PWT
      },
      {
        id: 'sharethrough',
        url: 'https://native.sharethrough.com/assets/sfp.js',
        check: () => !!window.SFP
      },
      {
        id: 'teads',
        url: 'https://a.teads.tv/page/media/v3/tag.js',
        check: () => !!window.teads
      }
    ];

    this.blockedCount = 0;
    this.completedCount = 0;
    this.isTriggered = false;
    this.logs = [];
  }

  log(level, event, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
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

    script.onerror = () => {
      finalize(true, 'Network request blocked (onerror triggered)', 'WARN');
    };

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
      const total = this.targetScripts.length;
      const blockRatio = this.blockedCount / total;
      
      const isAdBlockerConfirmed = this.blockedCount >= this.options.minBlockedThreshold && blockRatio >= this.options.thresholdRatio;

      this.log('INFO', 'INSPECTION_COMPLETE', { 
        totalBlocked: this.blockedCount, 
        totalScripts: total,
        blockRatio: blockRatio,
        isAdBlockerConfirmed: isAdBlockerConfirmed
      });

      if (isAdBlockerConfirmed) {
        this.triggerProtection();
      } else {
        this.log('INFO', 'SYSTEM_CLEAN', { 
          message: 'AdBlocker not confirmed. Failures treated as network issues.',
          blockedCount: this.blockedCount,
          minRequired: this.options.minBlockedThreshold
        });
      }
    }
  }

  triggerProtection() {
    if (this.isTriggered) return;
    this.isTriggered = true;

    this.log('ERROR', 'PROTECTION_TRIGGERED', { 
      blockedCount: this.blockedCount,
      totalCount: this.targetScripts.length
    });

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
          Ağ taramasında birden fazla reklam kaynağının engellendiği doğrulandı. Lütfen eklentinizi bu site için devre dışı bırakın.
        </p>
        <button onclick="window.location.reload()" style="background: #238636; color: #fff; border: none; padding: 10px 20px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; width: 100%;">Sayfayı Yenile</button>
      </div>
    `;

    document.documentElement.appendChild(overlay);
  }
}
