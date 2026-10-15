import { useState, type CSSProperties } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, Dumbbell, Flame, Leaf, Minus, Plus, Target, TrendingUp } from 'lucide-react';
import type { AppData } from '../lib/model';
import { dateKey, displayWeight, getStats, shiftDate } from '../lib/model';
import { useI18n } from '../lib/i18n';
import { ProgressRing, WeightChart } from './Charts';
import { chartPeriod } from './chartUtils';
import { SectionHeading, SmallLink } from './UI';
import Motivation from './Motivation';
import ProTeaser from './ProTeaser';
import type { MotivationPreferences } from '../lib/motivation';
import './charts-dashboard.css';
import './responsive-layout.css';

export default function Dashboard({ data, onDaily, onProfile, onHistory, onEditDay, onMotivationChange }: { data: AppData; onDaily: () => void; onProfile: () => void; onHistory: () => void; onEditDay: (date: string) => void; onMotivationChange: (value: MotivationPreferences) => void }) {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState(30);
  const stats = getStats(data);
  const unit = data.settings.weightUnit;
  const weight = (value: number) => displayWeight(value, unit, 1, locale);
  const today = dateKey();
  const todayRecord = data.records.find(record => record.date === today);
  const chart = chartPeriod(data.records, period, today);
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftDate(today, index - 6));
  // Show actual records even when the chosen weight baseline is more recent.
  const weekRecords = data.records.filter(record => weekDays.includes(record.date));
  const weekExercise = weekRecords.filter(record => record.exercise).length;
  const weekHealthy = weekRecords.filter(record => record.healthy).length;
  const ratio = stats.totalDays ? stats.exerciseDays / stats.totalDays * 100 : 0;
  const healthyRatio = stats.totalDays ? stats.healthyDays / stats.totalDays * 100 : 0;
  const headlines = { dark: 'Activa el beast mode', light: 'Tu mejor versión', gold: 'Tu constancia brilla', platinum: 'Eres el auténtico pro' };

  return <>
    <div className="dashboard-heading"><SectionHeading eyebrow={t('CADA DÍA CUENTA')} title={t(headlines[data.settings.theme])} action={<div className="dashboard-actions"><button className={`primary-button ${todayRecord ? 'recorded-button' : ''}`} onClick={onDaily}>{todayRecord ? <Check size={18} /> : <Plus size={18} />}<span>{t(todayRecord ? 'Hoy ya cuenta' : 'Registrar mi día')}</span><ChevronRight size={17} /></button><Motivation value={data.settings.motivation} onChange={onMotivationChange} /></div>} /></div>
    <div className="dashboard-grid">
      <section className="card weight-card">
        <div className="card-head"><span className="card-title"><TrendingUp size={18} />{t('Tu evolución')}</span><span className="pill subtle"><span className="dot" />{chart.records.length} {t(chart.records.length === 1 ? 'registro' : 'registros')}</span></div>
        <div className="weight-overview"><div><span className="muted small">{t('PESO ACTUAL')}</span><div className="big-weight" style={{ '--weight-number-width': Math.max(3, weight(stats.currentWeight).length) * .62 } as CSSProperties}><strong className="big-weight-number">{weight(stats.currentWeight)}</strong><span>{unit}</span></div></div><div className="weight-change"><span className="change-pill">{stats.change <= 0 ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}{stats.change > 0 ? '+' : ''}{weight(stats.change)} {unit}</span><span>{t('desde tu inicio')}</span></div></div>
        <div className="chart-toolbar"><div className="chart-legend"><span className="dot" />{t('Peso registrado')}</div><div className="segmented small-segmented">{[[7, '7D'], [30, '1M'], [90, '3M'], [0, 'Todo']].map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(Number(value))} aria-pressed={period === value}>{t(String(label))}</button>)}</div></div>
        <WeightChart key={`${period}:${today}`} records={chart.records} periodBounds={chart.bounds} hasHistory={data.records.length > 0} unit={unit} goal={stats.goalWeight} styleAction={<ProTeaser feature="charts" trigger="chart" />} />
        <div className="chart-footer"><span><span className="dot" />{t('Tu constancia deja huella.')}</span><SmallLink onClick={onHistory}>{t('Ver historial')}</SmallLink></div>
      </section>
      <section className="card goal-card">
        <div className="card-head"><span className="card-title"><Target size={18} />{t('Tu próxima meta')}</span><button className="icon-button" aria-label={t('Editar mi meta')} onClick={onProfile}><ArrowUpRight size={19} /></button></div>
        <ProgressRing progress={stats.progress} remaining={stats.remaining} unit={unit} />
        <div className="goal-values"><div><span>{t('Tu inicio')}</span><strong>{weight(stats.initialWeight)} <small>{unit}</small></strong></div><span className="goal-connector">······<ArrowUpRight size={17} /></span><div><span>{t('Tu meta')}</span><strong className="accent">{weight(stats.goalWeight)} <small>{unit}</small></strong></div></div><div className="goal-note"><SparkleMark />{t('Cada paso también es un logro.')}</div>
      </section>
      <section className="card habits-card interactive-habits">
        <div className="card-head"><div><span className="eyebrow">{t('TU RITMO, ESTA SEMANA')}</span><h2>{t('Tus hábitos, día a día.')}</h2></div><span className="streak"><Flame size={17} />{stats.streak} {t(stats.streak === 1 ? 'día de racha' : 'días de racha')}</span></div>
        <div className="habit-week-grid" aria-label={t('Ejercicio y alimentación de los últimos siete días')}>
          <div className="habit-row-labels" aria-hidden="true"><span /><span><Dumbbell size={16} /></span><span><Leaf size={16} /></span></div>
          {weekDays.map(day => {
            const record = weekRecords.find(item => item.date === day);
            const date = new Date(`${day}T12:00:00`);
            const state = !record ? 'Sin registro' : record.exercise && record.healthy ? 'Ejercicio y comida sana' : record.exercise ? 'Solo ejercicio' : record.healthy ? 'Solo comida sana' : 'Sin ejercicio ni comida sana';
            return <button key={day} type="button" onClick={() => onEditDay(day)} className={`habit-day-button ${day === today ? 'is-today' : ''} ${record ? 'is-recorded' : 'is-unrecorded'}`} aria-label={`${date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}. ${t(state)}. ${t(record ? 'Editar registro' : 'Añadir registro')}`}>
              <span className="habit-day-date"><span>{day === today ? t('HOY') : date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').toUpperCase()}</span><strong>{date.getDate()}</strong></span>
              <HabitCheck value={record ? record.exercise : null} />
              <HabitCheck value={record ? record.healthy : null} />
            </button>;
          })}
        </div>
        <div className="habit-state-legend"><span><Dumbbell size={13} />{t('Ejercicio')}</span><span><Leaf size={13} />{t('Comer sano')}</span><span><i className="unrecorded-legend" />{t('Sin registro')}</span></div>
        <p className="habit-edit-hint">{t('Toca un día para añadir o editar sus hábitos.')}</p>
        <div className="habit-totals"><div><span className="soft-icon"><Dumbbell size={19} /></span><div><strong>{weekExercise}<small> / {weekRecords.length} {t('días')}</small></strong><span>{t('Con movimiento')}</span></div></div><div><span className="soft-icon"><Leaf size={19} /></span><div><strong>{weekHealthy}<small> / {weekRecords.length} {t('días')}</small></strong><span>{t('Comer sano')}</span></div></div></div>
      </section>
      <section className="card activity-card">
        <div className="card-head"><span className="card-title"><Dumbbell size={18} />{t('Movimiento y pausa')}</span><span className="muted small">{t('DESDE TU INICIO')}</span></div>
        <div className="activity-numbers"><div><strong>{stats.exerciseDays}</strong><span><i className="dot" />{t('Con ejercicio')}</span></div><div><strong className="muted">{stats.restDays}</strong><span><i className="dot rest-dot" />{t('Sin ejercicio')}</span></div></div>
        <div className="activity-bar" role="img" aria-label={`${stats.exerciseDays} ${t('días con ejercicio')} · ${stats.restDays} ${t('días sin ejercicio')}`}><span style={{ width: `${ratio}%` }} /></div>
        <div className="activity-bottom"><span>{Math.round(ratio)}% {t('de tus días registrados')}</span><span className="tiny-icon"><ArrowUpRight size={16} /></span></div>
        <div className="healthy-activity">
          <div className="card-head"><span className="card-title"><Leaf size={18} />{t('Alimentación consciente')}</span></div>
          <div className="activity-numbers"><div><strong>{stats.healthyDays}</strong><span><i className="dot" />{t('Comí sano')}</span></div><div><strong className="muted">{stats.totalDays - stats.healthyDays}</strong><span><i className="dot rest-dot" />{t('No comí sano')}</span></div></div>
          <div className="activity-bar" role="img" aria-label={`${stats.healthyDays} ${t('días de comer sano')} · ${Math.round(healthyRatio)}%`}><span style={{ width: `${healthyRatio}%` }} /></div>
          <div className="activity-bottom"><span>{Math.round(healthyRatio)}% {t('de tus días registrados')}</span><Leaf size={15} /></div>
        </div>
      </section>
    </div><ProTeaser feature="steps" compact /><div className="bottom-quote"><span className="quote-line" /><span>{t('EL ÚNICO RITMO QUE IMPORTA ES EL TUYO.')}</span><span className="quote-line" /></div>
  </>;
}

function HabitCheck({ value }: { value: boolean | null }) { return <span aria-hidden="true" className={`habit-check ${value === null ? 'missing' : value ? 'yes' : 'no'}`}>{value === true ? <Check size={13} strokeWidth={2.7} /> : value === false ? <Minus size={12} /> : null}</span>; }
function SparkleMark() { return <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="m10 1 2.5 6.5L19 10l-6.5 2.5L10 19l-2.5-6.5L1 10l6.5-2.5Z" /></svg>; }
