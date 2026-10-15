import { useEffect, useRef, type ReactNode } from 'react';
import { X, Check, ArrowUpRight, Globe2 } from 'lucide-react';
import type { HeightUnit, Language, WeightUnit } from '../lib/model';
import { useI18n } from '../lib/i18n';
import './identity-settings.css';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand weight-exercise-brand ${compact ? 'compact' : ''}`} aria-label="Weight&Exercise"><span className="brand-mark"><svg viewBox="0 0 46 34" aria-hidden="true"><path d="M2 7h5l1 13 6-13h5l1 13 6-13h5L22 28h-7l-1-11-5 11H3Z M33 7h12l-2 5h-7l-1 3h7l-2 5h-7l-1 3h8l-2 5H26Z" fill="currentColor" /></svg></span>{!compact && <span className="brand-wordmark"><span>Weight<span className="brand-ampersand">&</span></span><span>Exercise</span></span>}</div>;
}
export function LanguageSwitch({ value, onChange }: { value: Language; onChange: (value: Language) => void }) {
  const { t } = useI18n();
  return <div className="language-control"><Globe2 size={16} aria-hidden="true" /><div className="language-switch" role="group" aria-label={t('Idioma')}>{([['es', 'Español'], ['en', 'English']] as const).map(([language, label]) => <button type="button" key={language} lang={language} className={value === language ? 'active' : ''} aria-pressed={value === language} onClick={() => { if (value !== language) onChange(language); }}>{label}</button>)}</div></div>;
}
export function UnitSwitch({ value, onChange }: { value: WeightUnit; onChange: (unit: WeightUnit) => void }) { const { t } = useI18n(); return <div className="unit-switch" aria-label={t('Unidad de peso')}>{(['kg', 'lb'] as const).map(unit => <button key={unit} type="button" aria-pressed={value === unit} className={value === unit ? 'active' : ''} onClick={() => { if (unit !== value) onChange(unit); }}>{unit}</button>)}</div>; }
export function HeightSwitch({ value, onChange }: { value: HeightUnit; onChange: (unit: HeightUnit) => void }) { const { t } = useI18n(); return <div className="unit-switch" aria-label={t('Unidad de altura')}>{(['cm', 'ft'] as const).map(unit => <button key={unit} type="button" aria-pressed={value === unit} className={value === unit ? 'active' : ''} onClick={() => { if (unit !== value) onChange(unit); }}>{unit === 'ft' ? t('pies') : unit}</button>)}</div>; }
export function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; const previous = document.activeElement as HTMLElement | null; el?.showModal(); return () => { el?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.stopPropagation(); e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) { e.stopPropagation(); onClose(); } }}><div className="modal-inner"><div className="modal-heading"><div><span className="eyebrow">{t('UN MOMENTO PARA TI')}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label={t('Cerrar')}><X size={20} /></button></div>{children}</div></dialog>;
}
export function HabitChoice({ question, hint, value, onChange, yes = 'Sí, lo hice', no = 'Hoy descansé', icon }: { question: string; hint?: string; value: boolean | null; onChange: (value: boolean) => void; yes?: string; no?: string; icon: ReactNode }) { const { t } = useI18n(); return <fieldset className="habit-choice"><legend>{icon}<span>{t(question)}</span></legend>{hint && <p>{t(hint)}</p>}<div><button type="button" className={value === true ? 'selected' : ''} aria-pressed={value === true} onClick={() => onChange(true)}><span>{t(yes)}</span>{value === true && <Check size={16} />}</button><button type="button" className={value === false ? 'selected muted-choice' : ''} aria-pressed={value === false} onClick={() => onChange(false)}><span>{t(no)}</span>{value === false && <Check size={16} />}</button></div></fieldset>; }
export function SectionHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: ReactNode }) { const { t } = useI18n(); return <div className="section-heading"><div><span className="eyebrow">{t(eyebrow)}</span><h1>{t(title)}</h1>{text && <p>{t(text)}</p>}</div>{action}</div>; }
export function SmallLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-link" onClick={onClick}>{children}<ArrowUpRight size={16} /></button>; }
