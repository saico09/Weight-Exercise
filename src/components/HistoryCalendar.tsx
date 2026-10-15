import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { dateKey } from '../lib/model';
import {
  addCalendarDays, calendarMonthCells, calendarMonthRange, moveCalendarDate,
  selectCalendarRange, shiftCalendarMonth, type CalendarSelection, type HistoryDateFilter,
} from '../lib/calendar';
import './calendar.css';

interface HistoryCalendarProps {
  value: HistoryDateFilter | null;
  recordDates: string[];
  onApply: (value: HistoryDateFilter | null) => void;
  onClose: () => void;
}

export function HistoryCalendar({ value, recordDates, onApply, onClose }: HistoryCalendarProps) {
  const { t, locale } = useI18n();
  const today = dateKey();
  const currentMonth = today.slice(0, 7);
  const [monthCount, setMonthCount] = useState(() => window.matchMedia('(min-width: 700px)').matches ? 2 : 1);
  // The jump controls describe the latest visible month. On desktop the previous
  // month sits beside it, so the current month never shows an empty future panel.
  const firstMonth = value?.end.slice(0, 7) ?? currentMonth;
  const minYear = recordDates.reduce((year, date) => Math.min(year, Number(date.slice(0, 4))), 1900);
  const minDate = `${minYear}-01-01`;
  const maxYear = Number(today.slice(0, 4));
  const [viewMonth, setViewMonth] = useState(firstMonth);
  const firstViewMonth = shiftCalendarMonth(viewMonth, 1 - monthCount);
  const [mode, setMode] = useState<'range' | 'month'>(value?.mode ?? 'range');
  const [selection, setSelection] = useState<CalendarSelection>({ start: value?.start ?? '', end: value?.end ?? '' });
  const [hoverDate, setHoverDate] = useState('');
  const [cleared, setCleared] = useState(false);
  const [focusDate, setFocusDate] = useState(value?.start ?? today);
  const dialog = useRef<HTMLDialogElement>(null);
  const dateButtons = useRef(new Map<string, HTMLButtonElement>());
  const requestDayFocus = useRef(false);
  const datesWithRecords = new Set(recordDates);
  const format = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, options);
  const monthLabel = (month: string) => format(`${month}-01`, { month: 'long', year: 'numeric' });
  const shortDate = (date: string) => format(date, { day: 'numeric', month: 'short', year: 'numeric' });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 700px)');
    const update = () => setMonthCount(query.matches ? 2 : 1);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (requestDayFocus.current) {
      dateButtons.current.get(focusDate)?.focus();
      requestDayFocus.current = false;
    }
  }, [focusDate, viewMonth]);

  function navigate(month: string) {
    const bounded = [month, `${minYear}-01`, currentMonth].sort()[1];
    setViewMonth(bounded);
    setFocusDate(bounded === currentMonth ? today : `${bounded}-01`);
    setHoverDate('');
    if (mode === 'month') {
      setSelection(calendarMonthRange(bounded, today));
      setCleared(false);
    }
  }

  function choose(date: string) {
    setSelection(mode === 'month' ? calendarMonthRange(date.slice(0, 7), today) : selectCalendarRange(selection, date));
    setFocusDate(date);
    setHoverDate('');
    setCleared(false);
  }

  function changeMode(next: 'range' | 'month') {
    if (next === mode) return;
    setMode(next);
    setSelection(next === 'month' ? calendarMonthRange(viewMonth, today) : { start: '', end: '' });
    setCleared(false);
    setHoverDate('');
  }

  function handleDayKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    let next: string | undefined;
    const dayOfWeek = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (event.key === 'ArrowLeft') next = addCalendarDays(date, -1);
    if (event.key === 'ArrowRight') next = addCalendarDays(date, 1);
    if (event.key === 'ArrowUp') next = addCalendarDays(date, -7);
    if (event.key === 'ArrowDown') next = addCalendarDays(date, 7);
    if (event.key === 'Home') next = addCalendarDays(date, -dayOfWeek);
    if (event.key === 'End') next = addCalendarDays(date, 6 - dayOfWeek);
    if (event.key === 'PageUp') next = moveCalendarDate(date, event.shiftKey ? -12 : -1);
    if (event.key === 'PageDown') next = moveCalendarDate(date, event.shiftKey ? 12 : 1);
    if (!next) return;
    event.preventDefault();
    next = [next, minDate, today].sort()[1];
    const nextMonth = next.slice(0, 7);
    const changesView = nextMonth < firstViewMonth || nextMonth > viewMonth;
    if (changesView) setViewMonth(nextMonth < firstViewMonth ? shiftCalendarMonth(nextMonth, monthCount - 1) : nextMonth);
    requestDayFocus.current = changesView || next !== focusDate;
    setFocusDate(next);
    // At a boundary the state may be unchanged, so focus the existing button too.
    dateButtons.current.get(next)?.focus();
  }

  const preview = !selection.end && selection.start && hoverDate ? selectCalendarRange(selection, hoverDate) : selection;
  const visibleFocusDate = focusDate.slice(0, 7) >= firstViewMonth && focusDate.slice(0, 7) <= viewMonth ? focusDate : `${viewMonth}-01`;
  const weekdays = Array.from({ length: 7 }, (_, index) => format(`2024-01-${String(index + 1).padStart(2, '0')}`, { weekday: 'short' }));
  const canApply = Boolean(selection.start && selection.end) || cleared;
  const summary = cleared ? t('Todas las fechas') : !selection.start ? t('Elige la fecha de inicio') : !selection.end ? t('Ahora elige la fecha de término') : mode === 'month' ? monthLabel(selection.start.slice(0, 7)) : selection.start === selection.end ? shortDate(selection.start) : `${shortDate(selection.start)} — ${shortDate(selection.end)}`;

  return <dialog ref={dialog} className="calendar-dialog" aria-labelledby="history-calendar-title"
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="calendar-inner">
      <div className="calendar-scroll">
      <div className="calendar-title-row"><div><span className="eyebrow">{t('TU HISTORIAL')}</span><h2 id="history-calendar-title">{t('Elige tus fechas')}</h2></div><button className="icon-button" type="button" aria-label={t('Cerrar')} onClick={onClose}><X size={20} /></button></div>
      <div className="calendar-mode" role="group" aria-label={t('Modo de selección de fechas')}>
        {(['range', 'month'] as const).map(option => <button key={option} type="button" className={mode === option ? 'active' : ''} aria-pressed={mode === option} onClick={() => changeMode(option)}>{t(option === 'range' ? 'Rango de días' : 'Mes completo')}</button>)}
      </div>
      <div className="calendar-navigation">
        <button type="button" className="icon-button" aria-label={t('Mes anterior')} disabled={viewMonth <= `${minYear}-01`} onClick={() => navigate(shiftCalendarMonth(viewMonth, -1))}><ChevronLeft size={20} /></button>
        <div className="calendar-jump">
          <select aria-label={t('Mes del calendario')} value={viewMonth.slice(5, 7)} onChange={event => navigate(`${viewMonth.slice(0, 4)}-${event.target.value}`)}>
            {Array.from({ length: 12 }, (_, index) => { const month = String(index + 1).padStart(2, '0'); return <option key={month} value={month} disabled={`${viewMonth.slice(0, 4)}-${month}` > currentMonth}>{format(`2024-${month}-01`, { month: 'long' })}</option>; })}
          </select>
          <select aria-label={t('Año del calendario')} value={viewMonth.slice(0, 4)} onChange={event => navigate(`${event.target.value}-${viewMonth.slice(5, 7)}`)}>
            {Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index).map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <button type="button" className="icon-button" aria-label={t('Mes siguiente')} disabled={viewMonth >= currentMonth} onClick={() => navigate(shiftCalendarMonth(viewMonth, 1))}><ChevronRight size={20} /></button>
      </div>
      <div className="calendar-months" onMouseLeave={() => setHoverDate('')}>
        {Array.from({ length: monthCount }, (_, index) => shiftCalendarMonth(firstViewMonth, index)).map(month => {
          const cells = calendarMonthCells(month);
          return <section className="calendar-month-panel" key={month} aria-label={monthLabel(month)}>
            {mode === 'month' ? <button className={`calendar-month-caption ${selection.start.slice(0, 7) === month ? 'selected' : ''}`} type="button" aria-label={t('Seleccionar {month}', { month: monthLabel(month) })} disabled={month > currentMonth || month < minDate.slice(0, 7)} onClick={() => choose(`${month}-01`)}>{monthLabel(month)}</button> : <h3 className="calendar-month-caption">{monthLabel(month)}</h3>}
            <div role="grid" aria-label={monthLabel(month)} className="calendar-grid">
              <div role="row" className="calendar-weekdays">{weekdays.map((day, index) => <span role="columnheader" key={index} aria-label={format(`2024-01-${String(index + 1).padStart(2, '0')}`, { weekday: 'long' })}>{day.replace('.', '')}</span>)}</div>
              {Array.from({ length: cells.length / 7 }, (_, week) => <div role="row" className="calendar-week" key={week}>{cells.slice(week * 7, week * 7 + 7).map((date, column) => {
                if (!date) return <span role="gridcell" className="calendar-blank" key={`blank-${column}`} />;
                const endpoint = date === selection.start || date === selection.end;
                const inRange = Boolean(preview.start && preview.end && date >= preview.start && date <= preview.end);
                const disabled = date > today || date < minDate;
                const hasRecord = datesWithRecords.has(date);
                const label = [format(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), date === today ? t('Hoy') : '', date === selection.start ? t('Fecha de inicio') : '', date === selection.end ? t('Fecha de término') : '', hasRecord ? t('Con registro') : ''].filter(Boolean).join(' · ');
                return <button key={date} ref={node => { if (node) dateButtons.current.set(date, node); else dateButtons.current.delete(date); }} type="button" role="gridcell" aria-label={label} aria-selected={endpoint || Boolean(selection.end && date >= selection.start && date <= selection.end)} aria-current={date === today ? 'date' : undefined} disabled={disabled} tabIndex={visibleFocusDate === date ? 0 : -1}
                  className={`calendar-day ${endpoint ? 'endpoint' : ''} ${inRange ? 'in-range' : ''} ${date === preview.start ? 'range-start' : ''} ${date === preview.end ? 'range-end' : ''} ${date === today ? 'today' : ''} ${hasRecord ? 'has-record' : ''}`}
                  onClick={() => choose(date)} onMouseEnter={() => { if (!disabled && mode === 'range') setHoverDate(date); }} onFocus={() => setFocusDate(date)} onKeyDown={event => handleDayKey(event, date)}>
                  <span>{Number(date.slice(-2))}</span>{hasRecord && <i aria-hidden="true" />}
                </button>;
              })}</div>)}
            </div>
          </section>;
        })}
      </div>
      </div>
      <div className="calendar-actions">
      <div className="calendar-summary"><CalendarDays size={17} aria-hidden="true" /><div aria-live="polite"><strong>{summary}</strong>{selection.start && !selection.end && !cleared && <span>{shortDate(selection.start)}</span>}</div><button type="button" onClick={() => { setSelection({ start: '', end: '' }); setHoverDate(''); setCleared(true); }}>{t('Limpiar')}</button></div>
      <div className="calendar-footer"><button className="secondary-button" type="button" onClick={onClose}>{t('Cancelar')}</button><button className="primary-button" type="button" disabled={!canApply} onClick={() => onApply(cleared ? null : { ...selection, mode })}>{t('Aplicar fechas')}</button></div>
      </div>
    </div>
  </dialog>;
}
