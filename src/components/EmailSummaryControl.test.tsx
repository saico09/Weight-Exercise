import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { defaultData } from '../lib/model';
import { EmailSummaryControl } from './EmailSummaryControl';
import ReportExport from './ReportExport';

const accountState = vi.hoisted(() => ({
  user: null as { id: string; email: string; username: string } | null,
  loading: false, unavailable: false, localDevelopment: true, mailMode: 'real', refresh: vi.fn(),
}));
vi.mock('./CloudAccount', () => ({ useCloudAccount: () => accountState }));

beforeEach(() => {
  accountState.user = null;
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No network allowed in this regression test.'); }));
});
afterEach(() => vi.unstubAllGlobals());

function expectAvailableEntry(html: string, label = 'Configurar resumen por correo') {
  const button = html.match(/<button[^>]*class="email-summary-toggle[^"]*"[^>]*>/)?.[0];
  expect(button).toBeDefined();
  expect(button).toContain(`aria-label="${label}"`);
  expect(button).toContain('aria-haspopup="dialog"');
  expect(button).not.toMatch(/\bdisabled(?:=|\s|>)/);
}

describe('email summary entry in the Pro demo', () => {
  it('exposes recurring Excel delivery as the same account-bound entry without enabling it', () => {
    const html = renderToStaticMarkup(<EmailSummaryControl workbook demo />);
    expectAvailableEntry(html, 'Configurar envío periódico de Excel');
    expect(html).toContain('Envío periódico');
    expect(html).not.toContain('email-summary-switch enabled');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the entry available without an account so it can explain how to sign in', () => {
    expectAvailableEntry(renderToStaticMarkup(<EmailSummaryControl demo />));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the entry available with a real account and never enables delivery during render', () => {
    accountState.user = { id: 'user-a', email: 'user@example.test', username: 'User' };
    expectAvailableEntry(renderToStaticMarkup(<EmailSummaryControl demo />));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not reintroduce the demo lock through the report launcher', () => {
    const html = renderToStaticMarkup(<ReportExport data={defaultData()} demo />);
    expectAvailableEntry(html);
    expect(html).toContain('Crear informe PDF');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the entry translated and available outside the demo', () => {
    expectAvailableEntry(renderToStaticMarkup(<I18nProvider language="en"><EmailSummaryControl /></I18nProvider>), 'Configure email summaries');
  });
});
