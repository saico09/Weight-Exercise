import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { apiOrigin, contentSecurityPolicy, injectSecurityPolicy, productionSecurityPolicy } from '../../scripts/security-policy';
import capacitorConfig from '../../capacitor.config';

const rootFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const directives = (policy: string) => new Map(policy.split('; ').map(value => {
  const [name, ...sources] = value.split(' '); return [name, sources];
}));

describe('production content security policy', () => {
  it('allows only local scripts, styles, images and explicitly configured HTTPS APIs', () => {
    const policy = directives(contentSecurityPolicy({ VITE_API_URL: 'https://cloud.example.test/api', VITE_FEEDBACK_API_URL: 'https://feedback.example.test:8443/api' }));
    expect(policy.get('script-src')).toEqual(["'self'"]);
    expect(policy.get('connect-src')).toEqual(["'self'", 'https://cloud.example.test', 'https://feedback.example.test:8443']);
    expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(policy.get('style-src')).toContain("'unsafe-inline'");
    for (const name of ['object-src', 'base-uri', 'form-action', 'frame-src']) expect(policy.get(name)).toEqual(["'none'"]);
  });
  it('does not expand the allowlist with malformed URLs, non-HTTPS, credentials, fragments or queries', () => {
    for (const value of [undefined, '', '/api', 'http://host.test/api', 'data:text/plain,test', 'javascript:alert(1)', 'https://user:pass@host.test/api', 'https://host.test/api?secret=1', 'https://host.test/api#part', 'https://host.test;script-src=unsafe-inline', "https://bad'host.test/api", 'https://bad<host.test/api']) {
      expect(apiOrigin(value)).toBeUndefined();
      expect(directives(contentSecurityPolicy({ VITE_API_URL: value })).get('connect-src')).toEqual(["'self'"]);
    }
  });
  it('normalizes origins, removes API paths and does not repeat the same endpoint', () => {
    expect(apiOrigin(' HTTPS://API.EXAMPLE.TEST:443/api/ ')).toBe('https://api.example.test');
    expect(directives(contentSecurityPolicy({ VITE_API_URL: 'https://api.example.test/api', VITE_FEEDBACK_API_URL: 'https://api.example.test/feedback' })).get('connect-src')).toEqual(["'self'", 'https://api.example.test']);
  });
  it('places the policy after charset and before app scripts and links without inline script permissions', () => {
    const result = injectSecurityPolicy(rootFile('index.html'), {});
    expect(result.indexOf('charset')).toBeLessThan(result.indexOf('Content-Security-Policy'));
    expect(result.indexOf('Content-Security-Policy')).toBeLessThan(result.indexOf('<link'));
    expect(result.indexOf('Content-Security-Policy')).toBeLessThan(result.indexOf('<script'));
    expect(result).toContain('name="referrer" content="no-referrer"');
    expect(() => injectSecurityPolicy(result, {})).toThrow('already defines');
    expect(() => injectSecurityPolicy('<head></head>', {})).toThrow('charset');
  });
  it('does not break local Vite development with a policy intended for packaged assets', () => {
    expect(productionSecurityPolicy().apply).toBe('build');
  });
});

describe('Android private-data boundaries', () => {
  it('shares only dedicated export folders, never all cache, external storage, or migration inboxes', () => {
    const xml = rootFile('android/app/src/main/res/xml/file_paths.xml');
    expect(xml).not.toMatch(/<(?:external-path|root-path|files-path|external-files-path|external-cache-path)\b/);
    const paths = [...xml.matchAll(/<cache-path\b[^>]*\bpath="([^"]+)"/g)].map(match => match[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(['exports/', 'reports/']).toContain(path);
    expect(paths).not.toContain('.');
    expect(paths).not.toContain('basic-to-pro/');
    expect(paths).not.toContain('basic-migration-inbox/');
  });
  it('keeps HTTP and mixed content disabled, and private providers non-exported', () => {
    const manifest = rootFile('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(capacitorConfig.android?.allowMixedContent).toBe(false);
    expect(capacitorConfig.server?.allowNavigation ?? []).toEqual([]);
    const providers = [...manifest.matchAll(/<provider\b[\s\S]*?>/g)].map(match => match[0]);
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) expect(provider).toContain('android:exported="false"');
  });
  it('excludes health records and settings from both Android cloud backup and device transfer', () => {
    expect(rootFile('android/app/src/main/AndroidManifest.xml')).toContain('android:allowBackup="false"');
    const domains = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];
    const legacy = rootFile('android/app/src/main/res/xml/backup_rules.xml');
    const current = rootFile('android/app/src/main/res/xml/data_extraction_rules.xml');
    for (const domain of domains) {
      expect(legacy).toContain(`<exclude domain="${domain}" path="." />`);
      for (const section of ['cloud-backup', 'device-transfer']) {
        const body = current.split(`<${section}>`)[1]?.split(`</${section}>`)[0];
        expect(body).toContain(`<exclude domain="${domain}" path="." />`);
      }
    }
  });
});
