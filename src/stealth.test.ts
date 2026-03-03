import { describe, it, expect } from 'vitest';
import { buildStealthScripts, getStealthArgs } from './stealth.js';

describe('stealth', () => {
  describe('getStealthArgs', () => {
    it('should return non-empty array', () => {
      const args = getStealthArgs();
      expect(args.length).toBeGreaterThan(0);
    });

    it('should include --disable-blink-features=AutomationControlled', () => {
      const args = getStealthArgs();
      expect(args).toContain('--disable-blink-features=AutomationControlled');
    });
  });

  describe('buildStealthScripts', () => {
    it('should return non-empty array of scripts', () => {
      const scripts = buildStealthScripts();
      expect(scripts.length).toBeGreaterThan(0);
    });

    it('each script should be a valid IIFE', () => {
      const scripts = buildStealthScripts();
      for (const script of scripts) {
        expect(script.trimStart()).toMatch(/^\(function\(\)/);
        expect(script.trimEnd()).toMatch(/\}\)\(\);$/);
      }
    });

    it('should contain navigator.webdriver evasion', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('navigator');
      expect(combined).toContain('webdriver');
    });

    it('should contain chrome.runtime mock', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('chrome');
      expect(combined).toContain('runtime');
    });

    it('should contain plugins mock', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('plugins');
      expect(combined).toContain('Chrome PDF Plugin');
    });

    it('should contain HeadlessChrome UA fix', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('HeadlessChrome');
      expect(combined).toContain('userAgent');
    });

    it('should contain WebGL vendor override', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('UNMASKED_VENDOR_WEBGL');
      expect(combined).toContain('UNMASKED_RENDERER_WEBGL');
    });

    it('should contain permissions API fix', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('Permissions');
      expect(combined).toContain('notifications');
    });

    it('should contain userAgentData brands fix', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('userAgentData');
      expect(combined).toContain('brands');
    });

    it('should contain iframe contentWindow fix', () => {
      const scripts = buildStealthScripts();
      const combined = scripts.join('\n');
      expect(combined).toContain('HTMLIFrameElement');
      expect(combined).toContain('contentWindow');
    });
  });
});
