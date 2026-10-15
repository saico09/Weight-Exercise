import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Minus, Plus, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { Language, Profile, Settings, Theme } from '../lib/model';
import { ageFromBirthDate, dateKey, fromKg, toKg } from '../lib/model';
import { useI18n } from '../lib/i18n';
import { Brand, HeightSwitch, LanguageSwitch, UnitSwitch } from './UI';
import RulerPicker from './RulerPicker';
import BirthDatePicker, { defaultBirthDate } from './BirthDatePicker';
import AccentPicker from './AccentPicker';
import { IS_PRO } from '../lib/edition';
import './onboarding-controls.css';

type OnboardingProps = {
  settings: Settings;
  onTheme: (theme: Theme) => void;
  onLanguage: (language: Language) => void;
  onAccentColor: (color: string | null) => void;
  onFinish: (profile: Profile, settings: Settings) => void;
  onDemo: () => void;
};

export default function Onboarding({ settings, onTheme, onLanguage, onAccentColor, onFinish, onDemo }: OnboardingProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<Theme | null>(null);
  const [config, setConfig] = useState(settings);
  // Canonical measurements survive changing display units without rounding drift.
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(75);
  const [goalKg, setGoalKg] = useState(70);
  const [raw, setRaw] = useState('170');
  const [birthDate, setBirthDate] = useState(defaultBirthDate);
  const [error, setError] = useState('');
  const theme = chosen || settings.theme;
  const value = step === 1 ? config.heightUnit === 'cm' ? heightCm : heightCm / 30.48 : fromKg(step === 2 ? weightKg : goalKg, config.weightUnit);
  const increment = step === 1 && config.heightUnit === 'ft' ? .01 : .1;
  const precision = increment < .1 ? 2 : 1;
  const unit = step === 1 ? config.heightUnit === 'cm' ? 'cm' : t('pies') : config.weightUnit;
  const minimum = step === 1 ? config.heightUnit === 'cm' ? 50 : 50 / 30.48 : fromKg(10, config.weightUnit);
  const maximum = step === 1 ? config.heightUnit === 'cm' ? 300 : 300 / 30.48 : fromKg(650, config.weightUnit);
  const rulerMin = Math.ceil(minimum / increment) * increment;
  const rulerMax = Math.floor(maximum / increment) * increment;
  const measureLabel = step === 1 ? 'Tu altura' : step === 2 ? 'Tu peso actual' : 'Tu peso objetivo';
  const headings = ['', 'Empecemos por\ntu altura.', 'Tu punto\nde partida.', 'Hacia dónde\nquieres llegar.', 'Tu historia\ntiene un comienzo.'];
  const descriptions = ['', 'Para conocerte un poquito mejor. Cada cuerpo tiene su propio camino.', 'Este es solo el comienzo de tu historia. ¿Cuál es tu peso actual?', 'Una meta tuya, a tu ritmo. Puedes cambiarla cuando quieras.', '¿Cuándo naciste? Nos ayuda a adaptar la información para ti.'];

  // Update on a screen or unit change; typing may contain an incomplete decimal.
  useEffect(() => { setRaw(String(Number(value.toFixed(precision)))); }, [step, config.heightUnit, config.weightUnit]);
  const setMeasurement = (number: number) => {
    if (step === 1) setHeightCm(config.heightUnit === 'cm' ? number : number * 30.48);
    else if (step === 2) setWeightKg(toKg(number, config.weightUnit));
    else setGoalKg(toKg(number, config.weightUnit));
  };
  const pickMeasurement = (number: number) => {
    const next = Number(Math.max(rulerMin, Math.min(rulerMax, number)).toFixed(precision));
    setRaw(String(next));
    setMeasurement(next);
    setError('');
  };
  const choose = (newTheme: Theme) => {
    setChosen(newTheme);
    setConfig(current => ({ ...current, theme: newTheme }));
    onTheme(newTheme);
  };
  const next = () => {
    setError('');
    if (step > 0 && step < 4) {
      const number = Number(raw);
      if (!raw.trim() || !Number.isFinite(number)) return setError('Ingresa un número para continuar.');
      if (step === 1 && (heightCm < 50 || heightCm > 300)) return setError('Ingresa una altura entre 50 y 300 cm, o su equivalente en pies.');
      if ((step === 2 || step === 3) && (toKg(number, config.weightUnit) < 10 || toKg(number, config.weightUnit) > 650)) return setError('Ingresa un peso entre 10 y 650 kg, o su equivalente.');
    }
    if (step < 4) setStep(step + 1);
    else {
      const age = ageFromBirthDate(birthDate);
      if (!Number.isFinite(age) || age < 5 || age > 120) return setError('Elige una fecha de nacimiento válida, entre 5 y 120 años.');
      onFinish({ heightCm, initialWeightKg: weightKg, goalWeightKg: goalKg, birthDate, age, initialDate: dateKey() }, config);
    }
  };

  return <div className={`onboarding onboarding-refined ${step === 0 ? 'theme-onboarding' : 'measure-onboarding'}`}>
    <header className="onboarding-header"><Brand /><button className="text-link" onClick={onDemo}>{t('Explorar demo')} <ArrowRight size={16} /></button></header>
    {step === 0 ? <main className="theme-start">
      <div className="onboarding-intro">
        <div className="onboarding-language"><LanguageSwitch value={config.language} onChange={language => { setConfig(current => ({ ...current, language })); onLanguage(language); }} /></div>
        <span className="eyebrow">{t('DA EL PRIMER PASO')}</span>
        <h1>{t('Tu progreso.')}<br /><span>{t('Tu energía.')}</span></h1>
        <p>{t('Elige el estilo que mejor te representa')}</p>
        {IS_PRO && <div className="onboarding-accent"><AccentPicker theme={theme} value={config.accentColor} onChange={accentColor => { setConfig(current => ({ ...current, accentColor })); onAccentColor(accentColor); }} /></div>}
      </div>
      <div className={`theme-panels ${chosen ? `chosen-${chosen}` : ''}`}>
        <button className={`theme-panel dark-panel ${chosen === 'dark' ? 'chosen' : ''}`} onClick={() => choose('dark')} aria-pressed={chosen === 'dark'}>
          <img src="/images/dark-fitness.jpg" alt={t('Atleta entrenando con una mancuerna')} />
          <span className="theme-panel-tag"><Zap size={14} /> {t('BEAST MODE')}</span>
          <span className="theme-panel-content"><span className="theme-title">Dark<span className="theme-select-circle">{chosen === 'dark' ? <Check /> : <ArrowUpRightIcon />}</span></span><span>{t('Enfoque. Energía. Sin límites.')}</span><span className="theme-palette"><i /><i /><i /></span></span>
        </button>
        <button className={`theme-panel light-panel ${chosen === 'light' ? 'chosen' : ''}`} onClick={() => choose('light')} aria-pressed={chosen === 'light'}>
          <img src="/images/light-fitness.jpg" alt={t('Una pausa tranquila frente al mar')} />
          <span className="theme-panel-tag"><Sparkles size={14} /> {t('MINIMALISTA')}</span>
          <span className="theme-panel-content"><span className="theme-title">Light<span className="theme-select-circle">{chosen === 'light' ? <Check /> : <ArrowUpRightIcon />}</span></span><span>{t('Respira. Muévete. Fluye.')}</span><span className="theme-palette"><i /><i /><i /></span></span>
        </button>
      </div>
      <div className="theme-start-footer"><p>{t('Puedes cambiar de estilo cuando quieras.')}</p><button className="primary-button" disabled={!chosen} onClick={next}>{t('Este es mi estilo')}</button></div>
    </main> : <main className="onboarding-measure">
      <div className="step-sidebar"><img src={`/images/${theme}-fitness.jpg`} alt="" /><div><Brand compact /><h2>{theme === 'dark' ? <>BEAST<br />MODE.</> : t('Minimalista.')}</h2><p>{t('No se trata de hacerlo perfecto.')}<br />{t('Se trata de empezar.')}</p></div></div>
      <form className={`measure-content ${step === 4 ? 'birthdate-step' : ''}`} onSubmit={event => { event.preventDefault(); next(); }}>
        <div className="step-top"><button type="button" className="icon-button" onClick={() => { setStep(step - 1); setError(''); }} aria-label={t('Paso anterior')}><ArrowLeft size={20} /></button><span>{t('PASO')} {String(step).padStart(2, '0')} <span>/ 04</span></span></div>
        <div className="step-dots">{[1, 2, 3, 4].map(number => <i key={number} className={number <= step ? 'filled' : ''} />)}</div>
        <h1>{t(headings[step])}</h1><p>{t(descriptions[step])}</p>
        {step === 4 ? <BirthDatePicker value={birthDate} onChange={date => { setBirthDate(date); setError(''); }} /> : <>
          <div className="measure-unit">{step === 1 ? <HeightSwitch value={config.heightUnit} onChange={heightUnit => setConfig(current => ({ ...current, heightUnit }))} /> : <UnitSwitch value={config.weightUnit} onChange={weightUnit => setConfig(current => ({ ...current, weightUnit }))} />}</div>
          <div className="large-measure">
            <button type="button" className="icon-button" aria-label={t('Disminuir')} onClick={() => pickMeasurement(value - increment)}><Minus size={18} /></button>
            <label><input key={step} aria-label={t(measureLabel)} type="text" inputMode="decimal" value={raw} onChange={event => {
              const text = event.target.value.replace(',', '.');
              if (!/^\d*\.?\d*$/.test(text)) return;
              setRaw(text);
              if (text.trim() && Number.isFinite(Number(text))) setMeasurement(Number(text));
              setError('');
            }} /><span>{unit}</span></label>
            <button type="button" className="icon-button" aria-label={t('Aumentar')} onClick={() => pickMeasurement(value + increment)}><Plus size={18} /></button>
          </div>
          <RulerPicker value={value} min={rulerMin} max={rulerMax} step={increment} label={t(measureLabel)} unit={unit} onChange={pickMeasurement} />
          {step === 1 && config.heightUnit === 'ft' && <p className="input-hint">{t('Pies en decimales: 5,5 pies = 5 pies y 6 pulgadas.')}</p>}
        </>}
        {error && <p role="alert" className="error-message">{t(error)}</p>}
        <button className="primary-button" type="submit">{t(step === 4 ? 'Comenzar mi camino' : 'Continuar')}<ArrowRight size={18} /></button>
        <span className="private-note"><ShieldCheck size={15} /> {t('Tus datos se quedan en este dispositivo.')}</span>
      </form>
    </main>}
    <footer className="onboarding-bottom"><span>{t('HECHO PARA TU PROPIO RITMO.')}</span><span>{t('Un día a la vez')} <span className="dot" /></span></footer>
  </div>;
}

function ArrowUpRightIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 18 18 6M6 6h12v12" /></svg>; }
