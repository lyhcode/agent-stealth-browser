import type { BrowserContext } from 'playwright-core';

/**
 * Returns Chromium launch args that disable automation detection flags.
 */
export function getStealthArgs(): string[] {
  return ['--disable-blink-features=AutomationControlled'];
}

/**
 * Returns an array of ES5 IIFE scripts that patch browser APIs to evade
 * common anti-bot detection checks. Each script is self-contained and
 * targets a specific detection vector.
 */
export function buildStealthScripts(): string[] {
  return [
    // 1. Hide navigator.webdriver
    `(function() {
  Object.defineProperty(navigator, 'webdriver', { get: function() { return undefined; } });
})();`,

    // 2. Mock window.chrome.runtime
    `(function() {
  if (!window.chrome) { window.chrome = {}; }
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {} }; },
      sendMessage: function(msg, cb) { if (cb) cb(); },
      onMessage: { addListener: function() {}, removeListener: function() {} }
    };
  }
})();`,

    // 3. Mock navigator.plugins (3 default Chrome plugins)
    `(function() {
  var mockPlugins = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 }
  ];
  var pluginArray = Object.create(PluginArray.prototype);
  for (var i = 0; i < mockPlugins.length; i++) {
    var p = Object.create(Plugin.prototype);
    Object.defineProperties(p, {
      name: { value: mockPlugins[i].name, enumerable: true },
      filename: { value: mockPlugins[i].filename, enumerable: true },
      description: { value: mockPlugins[i].description, enumerable: true },
      length: { value: mockPlugins[i].length, enumerable: true }
    });
    Object.defineProperty(pluginArray, i, { value: p, enumerable: true });
  }
  Object.defineProperty(pluginArray, 'length', { value: mockPlugins.length, enumerable: true });
  pluginArray.item = function(idx) { return this[idx] || null; };
  pluginArray.namedItem = function(name) {
    for (var j = 0; j < this.length; j++) { if (this[j].name === name) return this[j]; }
    return null;
  };
  pluginArray.refresh = function() {};
  Object.defineProperty(navigator, 'plugins', { get: function() { return pluginArray; } });
})();`,

    // 4. Fix navigator.languages if empty
    `(function() {
  if (!navigator.languages || navigator.languages.length === 0) {
    Object.defineProperty(navigator, 'languages', { get: function() { return ['en-US', 'en']; } });
  }
})();`,

    // 5. Fix Permissions API for notifications
    `(function() {
  if (typeof Permissions !== 'undefined' && Permissions.prototype.query) {
    var origQuery = Permissions.prototype.query;
    Permissions.prototype.query = function(params) {
      if (params && params.name === 'notifications') {
        return Promise.resolve({ state: 'default', onchange: null });
      }
      return origQuery.call(this, params);
    };
  }
})();`,

    // 6. WebGL vendor/renderer override to hide SwiftShader
    `(function() {
  if (typeof WebGLRenderingContext !== 'undefined') {
    var origGetParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      var ext = this.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        if (param === ext.UNMASKED_VENDOR_WEBGL) return 'Intel Inc.';
        if (param === ext.UNMASKED_RENDERER_WEBGL) return 'Intel Iris OpenGL Engine';
      }
      return origGetParam.call(this, param);
    };
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    var origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      var ext = this.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        if (param === ext.UNMASKED_VENDOR_WEBGL) return 'Intel Inc.';
        if (param === ext.UNMASKED_RENDERER_WEBGL) return 'Intel Iris OpenGL Engine';
      }
      return origGetParam2.call(this, param);
    };
  }
})();`,

    // 7. Strip HeadlessChrome from User-Agent
    `(function() {
  var ua = navigator.userAgent;
  if (ua.indexOf('HeadlessChrome') !== -1) {
    var fixed = ua.replace(/HeadlessChrome/g, 'Chrome');
    Object.defineProperty(navigator, 'userAgent', { get: function() { return fixed; } });
    Object.defineProperty(navigator, 'appVersion', {
      get: function() { return fixed.replace(/^Mozilla\\//, ''); }
    });
  }
})();`,

    // 8. Fix navigator.userAgentData brands to remove HeadlessChrome
    `(function() {
  if (navigator.userAgentData && navigator.userAgentData.brands) {
    var brands = navigator.userAgentData.brands;
    var filtered = [];
    for (var i = 0; i < brands.length; i++) {
      if (brands[i].brand.indexOf('HeadlessChrome') === -1) {
        filtered.push(brands[i]);
      }
    }
    Object.defineProperty(navigator, 'userAgentData', {
      get: function() {
        return {
          brands: filtered,
          mobile: false,
          platform: navigator.userAgentData ? navigator.userAgentData.platform : 'macOS',
          getHighEntropyValues: navigator.userAgentData
            ? navigator.userAgentData.getHighEntropyValues.bind(navigator.userAgentData)
            : function() { return Promise.resolve({}); }
        };
      }
    });
  }
})();`,

    // 9. Ensure iframe contentWindow has chrome property
    `(function() {
  var origDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
  if (origDescriptor && origDescriptor.get) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get: function() {
        var win = origDescriptor.get.call(this);
        if (win && !win.chrome) {
          try { win.chrome = window.chrome; } catch(e) {}
        }
        return win;
      }
    });
  }
})();`,
  ];
}

/**
 * Install all stealth evasion scripts on a browser context via addInitScript.
 * Scripts run before any page script on every navigation.
 */
export async function installStealth(context: BrowserContext): Promise<void> {
  const scripts = buildStealthScripts();
  for (const script of scripts) {
    await context.addInitScript(script);
  }
}
