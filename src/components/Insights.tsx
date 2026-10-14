import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight,
  Dumbbell, Flag, Flame, Leaf, LockKeyhole, Pencil, Plus, Scale, Sparkles, Trophy,
} from 'lucide-react';
import type { AppData, DailyRecord, HeightUnit } from '../lib/model';
import {
  BMI_RANGES, bmiCategory, displayHeight, displayWeight, getStats, shiftDate,
} from '../lib/model';
import { BmiGauge } from './Charts';
import { HeightSwitch, SectionHeading } from './UI';

export interface InsightsProps {
  data: AppData;
  onProfile: () => void;
  onRecord: (record: DailyRecord) => void;
  onNewRecord: () => void;
  onHeightUnit: (unit: HeightUnit) => void;
}

const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', options);

function Metric({ label, value, unit, note, icon, accent = false }: {
  label: string; value: string; unit?: string; note: string; icon: ReactNode; accent?: boolean;
}) {
  return <article className={`card metric-card ${accent ? 'metric-accent' : ''}`}>
    <div className="card-head"><span className="muted">{label}</span>{icon}</div>
    <strong className="metric-value">{value}{unit && <small> {unit}</small>}</strong>
    <p className="muted">{note}</p>
  </article>;
}

function longestRecordingStreak(records: DailyRecord[]) {
  let best = 0;
  let streak = 0;
  let previous: string | null = null;
  for (const record of records) {
    streak = previous && shiftDate(previous, 1) === record.date ? streak + 1 : 1;
    best = Math.max(best, streak);
    previous = record.date;
  }
  return best;
}

export function StatsPage({ data, onProfile }: InsightsProps) {
  if (!data.profile) return null;
  const stats = getStats(data);
  const unit = data.settings.weightUnit;
  const weight = (value: number) => displayWeight(value, unit);
  const change = stats.change === 0 ? weight(0) : `${stats.change > 0 ? '+' : '−'}${weight(Math.abs(stats.change))}`;
  const weeklyLoss = stats.weeklyLoss;
  const achievements = [
    { name: 'El primer paso', description: 'Tu primer registro guardado.', earned: stats.totalDays >= 1, icon: <Flag size={20} /> },
    { name: 'Una semana contigo', description: '7 días seguidos registrando.', earned: longestRecordingStreak(stats.records) >= 7, icon: <Flame size={20} /> },
    { name: 'En movimiento', description: '10 días de ejercicio registrados.', earned: stats.exerciseDays >= 10, icon: <Dumbbell size={20} /> },
    { name: 'Un hábito que crece', description: '30 días de registros, a tu ritmo.', earned: stats.totalDays >= 30, icon: <Sparkles size={20} /> },
  ];
  return <div className="stats-layout">
    <SectionHeading eyebrow="CADA PASO CUENTA" title="Más que números." text="Una mirada a todo lo que estás construyendo."
      action={<button className="secondary-button" onClick={onProfile}><Pencil size={16} /> Mi perfil y meta</button>} />

    <section className="insight-section" aria-labelledby="weight-stats-title">
      <div className="card-head"><h2 id="weight-stats-title">Tu evolución</h2><span className="pill">Desde el {dateLabel(stats.startDate)}</span></div>
      <div className="metrics-grid">
        <Metric label="Peso actual" value={weight(stats.currentWeight)} unit={unit} note={stats.latestRecord ? `Último registro · ${dateLabel(stats.latestRecord.date)}` : 'Tu punto de partida'} icon={<Scale size={18} />} accent />
        <Metric label="Cambio total" value={change} unit={unit} note={`Desde ${weight(stats.initialWeight)} ${unit} de inicio`} icon={stats.change <= 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />} />
        <Metric label="Peso mínimo" value={weight(stats.minWeight)} unit={unit} note="Desde tu registro inicial elegido" icon={<ArrowDownRight size={18} />} />
        <Metric label="Peso máximo" value={weight(stats.maxWeight)} unit={unit} note="Desde tu registro inicial elegido" icon={<ArrowUpRight size={18} />} />
      </div>
    </section>

    <section className="insight-section" aria-labelledby="weekly-stats-title">
      <div className="card-head"><h2 id="weekly-stats-title">Una semana a la vez</h2><span className="muted">Últimos 7 días</span></div>
      <div className="metrics-grid">
        <Metric label="Peso promedio semanal" value={stats.weeklyAverageWeight === null ? '—' : weight(stats.weeklyAverageWeight)} unit={stats.weeklyAverageWeight === null ? undefined : unit}
          note={`${stats.weekRecords.length} ${stats.weekRecords.length === 1 ? 'peso registrado' : 'pesos registrados'} en los últimos 7 días`} icon={<Scale size={18} />} />
        <Metric label={weeklyLoss !== null && weeklyLoss < 0 ? 'Aumento semanal' : 'Descenso semanal'} value={weeklyLoss === null ? '—' : weight(Math.abs(weeklyLoss))} unit={weeklyLoss === null ? undefined : unit}
          note={weeklyLoss === null ? 'Necesitas registros en ambas semanas' : 'Cambio entre promedios de los últimos 7 días y los 7 anteriores'} icon={weeklyLoss !== null && weeklyLoss < 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />} />
        <Metric label="Ejercicio por semana" value={stats.weeklyExerciseAverage.toLocaleString('es-CL', { maximumFractionDigits: 1 })} unit="días"
          note={`Promedio en ${stats.weeks.length} ${stats.weeks.length === 1 ? 'semana con registros' : 'semanas con registros'}`} icon={<Dumbbell size={18} />} />
        <Metric label="Racha de registros" value={String(stats.streak)} unit={stats.streak === 1 ? 'día' : 'días'} note="Días consecutivos registrando hasta hoy o ayer" icon={<Flame size={18} />} />
      </div>
    </section>

    <div className="detail-grid">
      <section className="card" aria-labelledby="habit-stats-title">
        <div className="card-head"><h2 id="habit-stats-title">Tus hábitos</h2><Dumbbell size={19} /></div>
        <div className="list-row"><span>Ejercicio</span><strong>{stats.exerciseDays} días</strong></div>
        <div className="list-row"><span>Descanso registrado</span><strong>{stats.restDays} días</strong></div>
        <div className="list-row"><span>Comer sano · sí</span><strong>{stats.healthyDays} días</strong></div>
        <div className="list-row"><span>Días registrados</span><strong>{stats.totalDays}</strong></div>
        <p className="muted">Los días sin registro no cuentan como descanso.</p>
      </section>
      <section className="card" aria-labelledby="profile-stats-title">
        <div className="card-head"><h2 id="profile-stats-title">Tu punto de referencia</h2><button className="icon-button" aria-label="Editar perfil y meta" onClick={onProfile}><Pencil size={17} /></button></div>
        <div className="list-row"><span>Meta</span><strong>{weight(stats.goalWeight)} {unit}</strong></div>
        <div className="list-row"><span>Altura</span><strong>{displayHeight(data.profile.heightCm, data.settings.heightUnit)}</strong></div>
        <div className="list-row"><span>Edad</span><strong>{data.profile.age} años</strong></div>
        <div className="list-row"><span>IMC actual</span><strong>{stats.currentBmi?.toLocaleString('es-CL', { maximumFractionDigits: 1 }) ?? '—'}</strong></div>
        <p className="muted">{stats.adultBmi ? 'El IMC es una referencia general; no distingue masa muscular.' : 'Las categorías de IMC para adultos no se aplican a menores de 20 años.'}</p>
      </section>
    </div>

    <section className="insight-section" aria-labelledby="achievements-title">
      <div className="card-head"><h2 id="achievements-title">Pequeñas grandes victorias</h2><Trophy size={20} /></div>
      <div className="achievement-grid">{achievements.map(achievement => <article className={`card achievement ${achievement.earned ? 'earned' : 'is-locked'}`} key={achievement.name}>
        <span className="achievement-icon">{achievement.earned ? achievement.icon : <LockKeyhole size={20} />}</span>
        <h3>{achievement.name}</h3><p className="muted">{achievement.description}</p>
        <span className={`pill ${achievement.earned ? 'accent' : ''}`}>{achievement.earned ? <><Check size={12} /> Conseguido</> : 'Por descubrir'}</span>
      </article>)}</div>
    </section>
  </div>;
}

export function BmiPage({ data, onProfile, onHeightUnit }: InsightsProps) {
  const [rangeMode, setRangeMode] = useState<'bmi' | 'weight'>('bmi');
  if (!data.profile) return null;
  const stats = getStats(data);
  const value = stats.currentBmi ?? 0;
  const category = bmiCategory(value, data.profile.age);
  const unit = data.settings.weightUnit;
  const heightSquared = (data.profile.heightCm / 100) ** 2;
  const lowerWeight = 18.5 * heightSquared;
  const upperWeight = 25 * heightSquared;
  const deviation = value < 18.5 ? stats.currentWeight - lowerWeight : value >= 25 ? stats.currentWeight - upperWeight : 0;
  const deviationLabel = value < 18.5 ? 'Por debajo del límite inferior' : value >= 25 ? deviation < 0.005 ? 'En el límite superior' : 'Sobre el límite superior' : 'Dentro del rango de referencia';
  const weight = (kg: number) => displayWeight(kg, unit);
  const rangeText = (min: number, max: number) => {
    const format = (valueToFormat: number) => rangeMode === 'bmi' ? valueToFormat.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : weight(valueToFormat * heightSquared);
    const suffix = rangeMode === 'weight' ? ` ${unit}` : '';
    if (min === 0) return `< ${format(max)}${suffix}`;
    if (!Number.isFinite(max)) return `≥ ${format(min)}${suffix}`;
    return `${format(min)} – < ${format(max)}${suffix}`;
  };
  return <div className="bmi-layout">
    <SectionHeading eyebrow="CONOCE TU CUERPO" title="Un poco de perspectiva." text="Tu índice de masa corporal, explicado con calma." />
    <div className="detail-grid">
      <section className="card bmi-summary" aria-labelledby="bmi-summary-title">
        <div className="card-head"><h2 id="bmi-summary-title">Tu equilibrio actual</h2><span className="pill">IMC</span></div>
        <BmiGauge value={value} adult={stats.adultBmi} />
        <div className="bmi-category">{category ? <><span className="pill" style={{ borderColor: category.color }}>{category.label}</span><p className="muted">Referencia para adultos de 20 años o más</p></> : <><span className="pill">Sin clasificación adulta</span><p className="muted">Para tu edad se necesita una evaluación de IMC por edad.</p></>}</div>
      </section>
      <section className="card" aria-labelledby="bmi-details-title">
        <div className="card-head"><h2 id="bmi-details-title">Tus medidas</h2><button className="icon-button" onClick={onProfile} aria-label="Editar altura, edad y meta"><Pencil size={17} /></button></div>
        <div className="list-row"><span>Altura</span><strong>{displayHeight(data.profile.heightCm, data.settings.heightUnit)}</strong></div>
        <div className="list-row"><span className="muted">Unidad de altura</span><HeightSwitch value={data.settings.heightUnit} onChange={onHeightUnit} /></div>
        <div className="list-row"><span>Peso actual</span><strong>{weight(stats.currentWeight)} {unit}</strong></div>
        <div className="list-row"><span>Edad</span><strong>{data.profile.age} años</strong></div>
        {stats.adultBmi ? <>
          <div className="list-row"><span>Rango normal de IMC</span><strong>18,5 – &lt; 25</strong></div>
          <div className="list-row"><span>Rango de peso de referencia</span><strong>{weight(lowerWeight)} – &lt; {weight(upperWeight)} {unit}</strong></div>
          <div className="list-row"><span>Desviación del rango</span><strong>{deviation === 0 ? '—' : `${weight(Math.abs(deviation))} ${unit}`}</strong></div>
          <p className="muted">{deviationLabel}. En adultos, estos límites dependen de la altura; no cambian con la edad.</p>
        </> : <p className="muted">Antes de los 20 años, el IMC se interpreta con referencias de crecimiento por edad y sexo. Aquí puedes seguir tu peso sin aplicar los rangos de adultos.</p>}
      </section>
    </div>

    {stats.adultBmi && <section className="card" aria-labelledby="bmi-ranges-title">
      <div className="card-head"><div><span className="eyebrow">UNA REFERENCIA, NO UNA ETIQUETA</span><h2 id="bmi-ranges-title">Los rangos, en contexto</h2></div><div className="unit-switch" role="group" aria-label="Mostrar rangos como">{(['bmi', 'weight'] as const).map(mode => <button key={mode} type="button" className={rangeMode === mode ? 'active' : ''} aria-pressed={rangeMode === mode} onClick={() => setRangeMode(mode)}>{mode === 'bmi' ? 'IMC' : `Peso (${unit})`}</button>)}</div></div>
      <div className="bmi-range-list">{BMI_RANGES.map(range => <div className={`list-row bmi-range-row ${category === range ? 'current' : ''}`} key={range.label}>
        <span><i className="range-dot" style={{ background: range.color }} aria-hidden="true" />{range.label}{category === range && <span className="pill">Tú estás aquí</span>}</span>
        <strong>{rangeText(range.min, range.max)}</strong>
      </div>)}</div>
      <p className="muted">El inicio de cada rango está incluido; el límite con «&lt;» no. Los valores se muestran redondeados, pero la categoría se calcula con el IMC completo.</p>
    </section>}
    <aside className="bmi-footnote muted">El IMC relaciona peso y altura. Es una referencia general y no distingue músculo, grasa ni las particularidades de cada cuerpo. <a href="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html" target="_blank" rel="noreferrer">Sobre los rangos de IMC <ArrowUpRight size={13} /></a></aside>
  </div>;
}

export function HistoryPage({ data, onRecord, onNewRecord }: InsightsProps) {
  const [filter, setFilter] = useState<'all' | 'exercise' | 'healthy'>('all');
  const [month, setMonth] = useState('');
  const stats = getStats(data);
  const records = stats.allRecords.filter(record =>
    (!month || record.date.startsWith(month)) && (filter === 'all' || (filter === 'exercise' ? record.exercise : record.healthy)),
  ).reverse();
  const groups = new Map<string, DailyRecord[]>();
  for (const record of records) {
    const key = record.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const filterNames = { all: 'Todo', exercise: 'Ejercicio', healthy: 'Comer sano' };
  return <div className="history-layout">
    <SectionHeading eyebrow="CADA DÍA TIENE SU HISTORIA" title="Tu camino, día a día." text="Vuelve a cualquier registro para editarlo o elegirlo como tu nuevo inicio."
      action={<button className="primary-button" onClick={onNewRecord}><Plus size={17} /> Añadir registro</button>} />
    <div className="history-filters"><div className="unit-switch" role="group" aria-label="Filtrar registros por hábito">{(['all', 'exercise', 'healthy'] as const).map(value => <button type="button" key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{filterNames[value]}</button>)}</div>
      <label className="month-filter"><CalendarDays size={17} /><span className="sr-only">Mes de los registros</span><input type="month" aria-label="Mes de los registros" value={month} onChange={event => setMonth(event.target.value)} /></label>
      {month && <button className="text-link" onClick={() => setMonth('')}>Todos los meses</button>}
      <span className="muted">{records.length} {records.length === 1 ? 'registro' : 'registros'}</span>
    </div>
    {records.length === 0 ? <div className="card empty-state"><CalendarDays size={32} /><h2>{data.records.length ? 'No hay registros con estos filtros.' : 'La primera página está por escribirse.'}</h2><p className="muted">{data.records.length ? 'Prueba otro mes o muestra todos tus hábitos.' : 'Un peso, un hábito, un pequeño momento para ti.'}</p>{data.records.length ? <button className="secondary-button" onClick={() => { setMonth(''); setFilter('all'); }}>Ver todos los registros <ArrowRight size={16} /></button> : <button className="primary-button" onClick={onNewRecord}>Crear mi primer registro <Plus size={16} /></button>}</div> :
      <div className="history-list">{Array.from(groups, ([key, entries]) => <section className="history-month" key={key} aria-labelledby={`month-${key}`}>
        <div className="card-head"><h2 id={`month-${key}`}>{dateLabel(`${key}-01`, { month: 'long', year: 'numeric' })}</h2><span className="muted">{entries.length} {entries.length === 1 ? 'día' : 'días'}</span></div>
        <div className="card">{entries.map(record => {
          const initial = stats.initialRecord?.id === record.id || (!stats.initialRecord && record.date === stats.startDate);
          const beforeInitial = record.date < stats.startDate;
          return <button key={record.id} className="list-row history-record" onClick={() => onRecord(record)} aria-label={`Ver y editar registro del ${dateLabel(record.date, { day: 'numeric', month: 'long', year: 'numeric' })}: ${displayWeight(record.weightKg, data.settings.weightUnit)} ${data.settings.weightUnit}, ${record.exercise ? 'ejercicio' : 'descanso'}, comer sano: ${record.healthy ? 'sí' : 'no'}${initial ? '. Punto de partida' : ''}`}>
            <span className="history-record-main"><span className="history-day">{record.date.slice(-2)}</span><span><strong>{dateLabel(record.date, { weekday: 'long' })}</strong><span className="history-record-meta">{initial ? <span className="pill accent"><Flag size={11} /> Punto de partida</span> : beforeInitial ? <span className="muted">Anterior a tu inicio actual</span> : <span className="muted">{dateLabel(record.date)}</span>}{record.note && <span className="record-note">{record.note}</span>}</span></span></span>
            <span className="history-habits"><span className={record.exercise ? 'habit-indicator positive' : 'habit-indicator'} aria-label={record.exercise ? 'Hiciste ejercicio' : 'Descanso registrado'} title={record.exercise ? 'Ejercicio' : 'Descanso'}><Dumbbell size={17} /></span><span className={record.healthy ? 'habit-indicator positive' : 'habit-indicator'} aria-label={record.healthy ? 'Comer sano: sí' : 'Comer sano: no'} title={record.healthy ? 'Comer sano: sí' : 'Comer sano: no'}><Leaf size={17} /></span></span>
            <strong className="history-weight">{displayWeight(record.weightKg, data.settings.weightUnit)} <small>{data.settings.weightUnit}</small></strong><ChevronRight size={17} />
          </button>;
        })}</div>
      </section>)}</div>}
    {stats.allRecords.some(record => record.date < stats.startDate) && <p className="muted">Los registros anteriores al inicio elegido siguen aquí. Tus estadísticas de progreso comienzan el {dateLabel(stats.startDate, { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}
  </div>;
}
