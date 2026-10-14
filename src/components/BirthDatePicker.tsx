import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { dateKey, shiftDate } from '../lib/model';
import { useI18n } from '../lib/i18n';
import './onboarding-controls.css';

const ROW_HEIGHT = 44;
const pad = (value: number) => String(value).padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(year, month, 0, 12).getDate();
const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export function birthDateBounds(today = dateKey()) {
  const [year, month, day] = today.split('-').map(Number);
  return {
    min: shiftDate(isoDate(year - 121, month, Math.min(day, daysInMonth(year - 121, month))), 1),
    max: isoDate(year - 5, month, Math.min(day, daysInMonth(year - 5, month))),
  };
}

export function defaultBirthDate(today = dateKey()) {
  const [year, month, day] = today.split('-').map(Number);
  return isoDate(year - 25, month, Math.min(day, daysInMonth(year - 25, month)));
}

type WheelProps = { label: string; value: number; options: number[]; onChange: (value: number) => void; padded?: boolean };

function DateWheel({ label, value, options, onChange, padded = false }: WheelProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressScroll = useRef(false);
  const selected = options.indexOf(value);
  const latest = useRef({ options, onChange, value });
  latest.current = { options, onChange, value };

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    if (settling.current) clearTimeout(settling.current);
    suppressScroll.current = true;
    node.scrollTop = Math.max(0, selected) * ROW_HEIGHT;
    const frame = requestAnimationFrame(() => { suppressScroll.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [selected, options.length]);
  useEffect(() => () => { if (settling.current) clearTimeout(settling.current); }, []);

  const changeBy = (amount: number) => onChange(options[Math.max(0, Math.min(options.length - 1, selected + amount))]);
  return <div className="birth-wheel-column">
    <span className="birth-wheel-label">{label}</span>
    <button type="button" className="birth-wheel-arrow" aria-label={`${label}: −1`} onClick={() => changeBy(-1)} disabled={selected <= 0}><ChevronUp size={15} /></button>
    <div
      ref={scroller}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={options[0]}
      aria-valuemax={options[options.length - 1]}
      className="birth-wheel"
      tabIndex={0}
      onScroll={() => {
        if (suppressScroll.current) return;
        if (settling.current) clearTimeout(settling.current);
        settling.current = setTimeout(() => {
          const node = scroller.current;
          if (!node) return;
          const current = latest.current;
          const index = Math.max(0, Math.min(current.options.length - 1, Math.round(node.scrollTop / ROW_HEIGHT)));
          if (current.options[index] !== current.value) current.onChange(current.options[index]);
        }, 100);
      }}
      onKeyDown={event => {
        const amount = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : event.key === 'PageUp' ? -10 : event.key === 'PageDown' ? 10 : 0;
        if (amount) { event.preventDefault(); changeBy(amount); }
        else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); onChange(event.key === 'Home' ? options[0] : options[options.length - 1]); }
      }}
    >
      {options.map(option => <button type="button" tabIndex={-1} aria-hidden="true" key={option} className={`birth-wheel-number ${value === option ? 'selected' : ''}`} onClick={() => onChange(option)}>{padded ? pad(option) : option}</button>)}
    </div>
    <button type="button" className="birth-wheel-arrow" aria-label={`${label}: +1`} onClick={() => changeBy(1)} disabled={selected === options.length - 1}><ChevronDown size={15} /></button>
  </div>;
}

export default function BirthDatePicker({ value, onChange, min, max }: { value: string; onChange: (date: string) => void; min?: string; max?: string }) {
  const { t, locale } = useI18n();
  const bounds = birthDateBounds();
  const minimum = min || bounds.min;
  const maximum = max || bounds.max;
  const [year, month, day] = value.split('-').map(Number);
  const [editing, setEditing] = useState(false);
  const [directDate, setDirectDate] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const minYear = Number(minimum.slice(0, 4));
  const maxYear = Number(maximum.slice(0, 4));
  const clampDate = (date: string) => date < minimum ? minimum : date > maximum ? maximum : date;
  const directValid = /^\d{4}-\d{2}-\d{2}$/.test(directDate) && directDate >= minimum && directDate <= maximum;

  useEffect(() => setDirectDate(value), [value]);
  useEffect(() => { if (editing) input.current?.focus({ preventScroll: true }); }, [editing]);
  const updatePart = (part: 'year' | 'month' | 'day', number: number) => {
    const nextYear = part === 'year' ? number : year;
    const nextMonth = part === 'month' ? number : month;
    const nextDay = Math.min(part === 'day' ? number : day, daysInMonth(nextYear, nextMonth));
    onChange(clampDate(isoDate(nextYear, nextMonth, nextDay)));
  };
  return <div className="birth-date-picker">
    <div className="birth-date-toolbar"><span>{t('Tu fecha de nacimiento')}</span><button type="button" className={`icon-button birth-calendar-button ${editing ? 'active' : ''}`} aria-label={t('Escribir o elegir una fecha')} aria-expanded={editing} onClick={() => { if (editing && !directValid) input.current?.reportValidity(); else setEditing(!editing); }}><CalendarDays size={20} /></button></div>
    <div className="birth-wheels"><span className="birth-selection-band" aria-hidden="true" />
      <DateWheel label={t('Día')} value={day} padded options={Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)} onChange={number => updatePart('day', number)} />
      <DateWheel label={t('Mes')} value={month} padded options={Array.from({ length: 12 }, (_, i) => i + 1)} onChange={number => updatePart('month', number)} />
      <DateWheel label={t('Año')} value={year} options={Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)} onChange={number => updatePart('year', number)} />
    </div>
    {editing ? <label className="birth-date-direct"><span>{t('Escribe la fecha o abre el calendario')}</span><input ref={input} type="date" lang={locale} min={minimum} max={maximum} value={directDate} aria-label={t('Fecha de nacimiento')} aria-invalid={!directValid} onChange={event => { const next = event.target.value; setDirectDate(next); if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next >= minimum && next <= maximum) onChange(next); }} required />{!directValid && <span role="alert" className="birth-date-error">{t('Elige una fecha válida dentro del rango permitido.')}</span>}</label> : <span className="birth-date-hint">{t('Desliza cada columna hacia arriba o abajo')}</span>}
  </div>;
}
