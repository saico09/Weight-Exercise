import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Minus, Plus, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { Profile, Settings, Theme } from '../lib/model';
import { dateKey, fromKg, toKg } from '../lib/model';
import { Brand, HeightSwitch, UnitSwitch } from './UI';

export default function Onboarding({ settings, onTheme, onFinish, onDemo }: { settings: Settings; onTheme: (theme: Theme) => void; onFinish: (profile: Profile, settings: Settings) => void; onDemo: () => void }) {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<Theme | null>(null);
  const [config, setConfig] = useState(settings);
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('75');
  const [goal, setGoal] = useState('70');
  const [age, setAge] = useState('25');
  const [error, setError] = useState('');
  const theme = chosen || settings.theme;
  const choose = (value: Theme) => { setChosen(value); setConfig(c => ({ ...c, theme: value })); onTheme(value); };
  const heading = ['', 'Empecemos por\ntu altura.', 'Tu punto\nde partida.', 'Hacia dónde\nquieres llegar.', 'Una última cosa.\n¿Cuántos años tienes?'];
  const descriptions = ['', 'Para conocerte un poquito mejor. Cada cuerpo tiene su propio camino.', 'Este es solo el comienzo de tu historia. ¿Cuál es tu peso actual?', 'Una meta tuya, a tu ritmo. Puedes cambiarla cuando quieras.', 'Nos ayuda a mostrarte información más adecuada para ti.'];
  const raw = step === 1 ? height : step === 2 ? weight : step === 3 ? goal : age;
  const setter = step === 1 ? setHeight : step === 2 ? setWeight : step === 3 ? setGoal : setAge;
  const unit = step === 1 ? config.heightUnit === 'cm' ? 'cm' : 'pies' : step === 4 ? 'años' : config.weightUnit;
  const changeWeightUnit = (u: Settings['weightUnit']) => { setWeight(String(Number(fromKg(toKg(Number(weight), config.weightUnit), u).toFixed(1)))); setGoal(String(Number(fromKg(toKg(Number(goal), config.weightUnit), u).toFixed(1)))); setConfig(c => ({ ...c, weightUnit: u })); };
  const next = () => {
    setError('');
    const val = Number(raw.replace(',', '.'));
    const heightCm = config.heightUnit === 'cm' ? Number(height) : Number(height) * 30.48;
    if (step > 0 && (!Number.isFinite(val) || raw.trim() === '')) return setError('Ingresa un número para continuar.');
    if (step === 1 && (heightCm < 50 || heightCm > 300)) return setError('Ingresa una altura entre 50 y 300 cm, o su equivalente en pies.');
    if ((step === 2 || step === 3) && (toKg(val, config.weightUnit) < 10 || toKg(val, config.weightUnit) > 650)) return setError('Ingresa un peso entre 10 y 650 kg, o su equivalente.');
    if (step === 4 && (!Number.isInteger(val) || val < 5 || val > 120)) return setError('Ingresa tu edad en años completos, entre 5 y 120.');
    if (step < 4) setStep(step + 1);
    else onFinish({ heightCm, initialWeightKg: toKg(Number(weight), config.weightUnit), goalWeightKg: toKg(Number(goal), config.weightUnit), age: val, initialDate: dateKey() }, config);
  };
  return <div className={`onboarding ${step === 0 ? 'theme-onboarding' : 'measure-onboarding'}`}>
    <header className="onboarding-header"><Brand /><span>WEIGHT & EXERCISE</span><button className="text-link" onClick={onDemo}>Explorar demo <ArrowRight size={16} /></button></header>
    {step === 0 ? <main className="theme-start"><div className="onboarding-intro"><span className="eyebrow">EL PRIMER PASO ES TUYO</span><h1>Tu progreso.<br /><span>Tu energía.</span></h1><p>Un pequeño hábito. Un gran cambio.<br />Elige el espacio que se siente como tú.</p></div><div className={`theme-panels ${chosen ? `chosen-${chosen}` : ''}`}>
      <button className={`theme-panel dark-panel ${chosen === 'dark' ? 'chosen' : ''}`} onClick={() => choose('dark')} aria-pressed={chosen === 'dark'}><img src="/images/dark-fitness.jpg" alt="Atleta entrenando con una mancuerna" /><span className="theme-panel-tag"><Zap size={14} /> ENCUENTRA TU FUERZA</span><span className="theme-panel-content"><span className="theme-title">DARK<span className="theme-select-circle">{chosen === 'dark' ? <Check /> : <ArrowUpRightIcon />}</span></span><span>Enfoque. Energía. Sin límites.</span><span className="theme-palette"><i /><i /><i /></span></span></button>
      <button className={`theme-panel light-panel ${chosen === 'light' ? 'chosen' : ''}`} onClick={() => choose('light')} aria-pressed={chosen === 'light'}><img src="/images/light-fitness.jpg" alt="Una pausa tranquila frente al mar" /><span className="theme-panel-tag"><Sparkles size={14} /> ENCUENTRA TU EQUILIBRIO</span><span className="theme-panel-content"><span className="theme-title">Light<span className="theme-select-circle">{chosen === 'light' ? <Check /> : <ArrowUpRightIcon />}</span></span><span>Respira. Muévete. Fluye.</span><span className="theme-palette"><i /><i /><i /></span></span></button>
    </div><div className="theme-start-footer"><p>Puedes cambiar de estilo cuando quieras.</p><button className="primary-button" disabled={!chosen} onClick={next}>{chosen ? `Este es mi estilo · ${chosen === 'dark' ? 'Dark' : 'Light'}` : 'Elige tu estilo'}<ArrowRight size={18} /></button></div></main> : <main className="onboarding-measure"><div className="step-sidebar"><img src={`/images/${theme}-fitness.jpg`} alt="" /><div><Brand compact /><h2>{theme === 'dark' ? <>HAZLO<br />POR TI.</> : <>Un paso.<br />A tu ritmo.</>}</h2><p>No se trata de hacerlo perfecto.<br />Se trata de empezar.</p></div></div><form className="measure-content" onSubmit={e => { e.preventDefault(); next(); }}><div className="step-top"><button type="button" className="icon-button" onClick={() => { setStep(step - 1); setError(''); }} aria-label="Paso anterior"><ArrowLeft size={20} /></button><span>PASO {String(step).padStart(2, '0')} <span>/ 04</span></span></div><div className="step-dots">{[1, 2, 3, 4].map(s => <i key={s} className={s <= step ? 'filled' : ''} />)}</div><h1>{heading[step]}</h1><p>{descriptions[step]}</p><div className="measure-unit">{step === 1 ? <HeightSwitch value={config.heightUnit} onChange={u => { setHeight(String(Number((u === 'cm' ? Number(height) * 30.48 : Number(height) / 30.48).toFixed(2)))); setConfig(c => ({ ...c, heightUnit: u })); }} /> : step !== 4 && <UnitSwitch value={config.weightUnit} onChange={changeWeightUnit} />}</div><div className="large-measure"><button type="button" className="icon-button" aria-label="Disminuir" onClick={() => setter(String(Math.max(0, Number((Number(raw) - (step === 4 ? 1 : .1)).toFixed(1)))))}><Minus size={18} /></button><label><input key={step} aria-label={step === 1 ? 'Tu altura' : step === 2 ? 'Tu peso actual' : step === 3 ? 'Tu peso objetivo' : 'Tu edad'} type="text" inputMode={step === 4 ? 'numeric' : 'decimal'} value={raw} onChange={e => { const s = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(s)) setter(s); }} /><span>{unit}</span></label><button type="button" className="icon-button" aria-label="Aumentar" onClick={() => setter(String(Number((Number(raw) + (step === 4 ? 1 : .1)).toFixed(1))))}><Plus size={18} /></button></div><div className="ruler" aria-hidden="true">{Array.from({ length: 35 }, (_, i) => <i key={i} className={i % 5 === 0 ? 'long' : ''} />)}<span /></div>{step === 1 && config.heightUnit === 'ft' && <p className="input-hint">Pies en decimales: 5,5 pies = 5 pies y 6 pulgadas.</p>}{error && <p role="alert" className="error-message">{error}</p>}<button className="primary-button" type="submit">{step === 4 ? 'Comenzar mi camino' : 'Continuar'}<ArrowRight size={18} /></button><span className="private-note"><ShieldCheck size={15} /> Tus datos se quedan en este dispositivo.</span></form></main>}
    <footer className="onboarding-bottom"><span>HECHO PARA TU PROPIO RITMO.</span><span>Un día a la vez <span className="dot" /></span></footer>
  </div>;
}
function ArrowUpRightIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 18 18 6M6 6h12v12" /></svg>; }
