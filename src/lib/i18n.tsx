import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Language } from './model';
import { english } from './translations';

export type TranslationParams = Record<string, string | number>;
export function translate(source: string, language: Language = 'es', params?: TranslationParams): string {
  const template = language === 'en' ? (english[source] ?? source) : source;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => params?.[key] === undefined ? match : String(params[key]));
}

const I18nContext = createContext({ language: 'es' as Language, locale: 'es-CL', t: (source: string, params?: TranslationParams) => translate(source, 'es', params) });

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  const value = useMemo(() => ({ language, locale: language === 'en' ? 'en-US' : 'es-CL', t: (source: string, params?: TranslationParams) => translate(source, language, params) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
