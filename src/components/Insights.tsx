import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight,
  Dumbbell, Flag, Flame, Leaf, LockKeyhole, Pencil, Plus, Scale, Sparkles, Trophy, ListFilter, X,
} from 'lucide-react';
import type { AppData, DailyRecord, HeightUnit } from '../lib/model';
import {
  BMI_RANGES, bmiCategory, displayHeight, displayWeight, getStats, shiftDate, profileAge,
} from '../lib/model';
import { BmiGauge } from './Charts';
import { HeightSwitch, SectionHeading, Modal } from './UI';
import { useI18n } from '../lib/i18n';
import './insights.css';

export interface InsightsProps {
  data: AppData;
  onProfile: () => void;
  onRecord: (record: DailyRecord) => void;
  onNewRecord: () => void;
  onHeightUnit: (unit: HeightUnit) => void;
}

const formatDate = (date: string, locale: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(locale, options);

function Metric({ label, value, unit, note, icon, accent = false }: {
  label: string; value: string; unit?: string; note: string; icon: ReactNode; accent?: boolean;
}) {
  const { t } = useI18n();
  return <article className={`card metric-card ${accent ? 'metric-accent' : ''}`}>
    <div className="card-head"><span className="muted">{t(label)}</span>{icon}</div>
    <strong className="metric-value">{value}{unit && <small> {t(unit)}</small>}</strong>
    <p className="muted">{t(note)}</p>
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
  const { t, locale } = useI18n();
  const dateLabel = (date: string, options?: Intl.DateTimeFormatOptions) => formatDate(date, locale, options);
  if (!data.profile) return null;
  const stats = getStats(data);
  const unit = data.settings.weightUnit;
  const weight = (value: number) => displayWeight(value, unit, 1, locale);
  const change = stats.change === 0 ? weight(0) : `${stats.change > 0 ? '+' : '−'}${weight(Math.abs(stats.change))}`;
  const weeklyLoss = stats.weeklyLoss;
  const bestStreak = longestRecordingStreak(stats.records);
  const bothDays = stats.records.filter(record => record.exercise && record.healthy).length;
  const achievements = [
    { name: 'El primer paso', description: 'Tu primer registro guardado.', count: stats.totalDays, target: 1, icon: <Flag size={20} /> },
    { name: 'Tomando impulso', description: '3 días de registros.', count: stats.totalDays, target: 3, icon: <Sparkles size={20} /> },
    { name: 'Una semana contigo', description: '7 días seguidos registrando.', count: bestStreak, target: 7, icon: <Flame size={20} /> },
    { name: 'Constancia que inspira', description: '14 días seguidos registrando.', count: bestStreak, target: 14, icon: <Flame size={20} /> },
    { name: 'Un hábito que crece', description: '30 días de registros, a tu ritmo.', count: stats.totalDays, target: 30, icon: <Sparkles size={20} /> },
    { name: 'Tu propia historia', description: '90 días de registros.', count: stats.totalDays, target: 90, icon: <Trophy size={20} /> },
    { name: 'A moverse', description: 'Tu primer día de ejercicio.', count: stats.exerciseDays, target: 1, icon: <Dumbbell size={20} /> },
    { name: 'En movimiento', description: '10 días de ejercicio registrados.', count: stats.exerciseDays, target: 10, icon: <Dumbbell size={20} /> },
    { name: 'Energía que suma', description: '30 días de ejercicio registrados.', count: stats.exerciseDays, target: 30, icon: <Dumbbell size={20} /> },
    { name: 'Cien veces por ti', description: '100 días de ejercicio registrados.', count: stats.exerciseDays, target: 100, icon: <Trophy size={20} /> },
    { name: 'Nutriendo el hábito', description: '7 días de comer sano.', count: stats.healthyDays, target: 7, icon: <Leaf size={20} /> },
    { name: 'Cuidarte se siente bien', description: '30 días de comer sano.', count: stats.healthyDays, target: 30, icon: <Leaf size={20} /> },
    { name: 'En sintonía', description: '10 días con ambos hábitos.', count: bothDays, target: 10, icon: <Sparkles size={20} /> },
    { name: 'Tu ritmo, tu equilibrio', description: '30 días con ambos hábitos.', count: bothDays, target: 30, icon: <Trophy size={20} /> },
  ].map(item => ({ ...item, earned: item.count >= item.target }));
  return <div className="stats-layout">
    <div className="compact-section-heading"><h1 className="eyebrow">{t("Tu evolución")}</h1><button className="icon-button" onClick={onProfile} aria-label={t("Mi perfil y meta")} title={t("Mi perfil y meta")}><Pencil size={19} /></button></div>

    <section className="insight-section" aria-labelledby="weight-stats-title">
      <div className="card-head"><h2 id="weight-stats-title">{t("Tu evolución")}</h2><span className="pill">{t("Desde el")} {dateLabel(stats.startDate)}</span></div>
      <div className="metrics-grid">
        <Metric label={t("Peso actual")} value={weight(stats.currentWeight)} unit={unit} note={stats.latestRecord ? `${t('Último registro')} · ${dateLabel(stats.latestRecord.date)}` : t('Tu punto de partida')} icon={<Scale size={18} />} accent />
        <Metric label={t("Cambio total")} value={change} unit={unit} note={t('Desde {weight} {unit} de inicio', { weight: weight(stats.initialWeight), unit })} icon={stats.change <= 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />} />
        <Metric label={t("Peso mínimo")} value={weight(stats.minWeight)} unit={unit} note={t("Desde tu registro inicial elegido")} icon={<ArrowDownRight size={18} />} />
        <Metric label={t("Peso máximo")} value={weight(stats.maxWeight)} unit={unit} note={t("Desde tu registro inicial elegido")} icon={<ArrowUpRight size={18} />} />
      </div>
    </section>

    <section className="insight-section" aria-labelledby="weekly-stats-title">
      <div className="card-head"><h2 id="weekly-stats-title">{t("Una semana a la vez")}</h2><span className="muted">{t("Últimos 7 días")}</span></div>
      <div className="metrics-grid">
        <Metric label={t("Peso promedio semanal")} value={stats.weeklyAverageWeight === null ? '—' : weight(stats.weeklyAverageWeight)} unit={stats.weeklyAverageWeight === null ? undefined : unit}
          note={t('{count} registros en los últimos 7 días', { count: stats.weekRecords.length })} icon={<Scale size={18} />} />
        <Metric label={weeklyLoss !== null && weeklyLoss < 0 ? 'Aumento semanal' : 'Descenso semanal'} value={weeklyLoss === null ? '—' : weight(Math.abs(weeklyLoss))} unit={weeklyLoss === null ? undefined : unit}
          note={weeklyLoss === null ? 'Necesitas registros en ambas semanas' : 'Cambio entre promedios de los últimos 7 días y los 7 anteriores'} icon={weeklyLoss !== null && weeklyLoss < 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />} />
        <Metric label={t("Ejercicio por semana")} value={stats.weeklyExerciseAverage.toLocaleString(locale, { maximumFractionDigits: 1 })} unit="días"
          note={t('Promedio en {count} semanas con registros', { count: stats.weeks.length })} icon={<Dumbbell size={18} />} />
        <Metric label={t("Racha de registros")} value={String(stats.streak)} unit={stats.streak === 1 ? 'día' : 'días'} note={t("Días consecutivos registrando hasta hoy o ayer")} icon={<Flame size={18} />} />
      </div>
    </section>

    <div className="detail-grid">
      <section className="card" aria-labelledby="habit-stats-title">
        <div className="card-head"><h2 id="habit-stats-title">{t("Tus hábitos")}</h2><Dumbbell size={19} /></div>
        <div className="list-row"><span>{t("Ejercicio")}</span><strong>{stats.exerciseDays} {t("días")}</strong></div>
        <div className="list-row"><span>{t("Descanso registrado")}</span><strong>{stats.restDays} {t("días")}</strong></div>
        <div className="list-row"><span>{t("Comer sano · sí")}</span><strong>{stats.healthyDays} {t("días")}</strong></div>
        <div className="list-row"><span>{t("Días registrados")}</span><strong>{stats.totalDays}</strong></div>
        <p className="muted">{t("Los días sin registro no cuentan como descanso.")}</p>
      </section>
      <section className="card" aria-labelledby="profile-stats-title">
        <div className="card-head"><h2 id="profile-stats-title">{t("Tu punto de referencia")}</h2><button className="icon-button" aria-label={t("Editar perfil y meta")} onClick={onProfile}><Pencil size={17} /></button></div>
        <div className="list-row"><span>{t("Meta")}</span><strong>{weight(stats.goalWeight)} {unit}</strong></div>
        <div className="list-row"><span>{t("Altura")}</span><strong>{displayHeight(data.profile.heightCm, data.settings.heightUnit, locale)}</strong></div>
        <div className="list-row"><span>{t("Edad")}</span><strong>{profileAge(data.profile)} {t("años")}</strong></div>
        <div className="list-row"><span>{t("IMC actual")}</span><strong>{stats.currentBmi?.toLocaleString(locale, { maximumFractionDigits: 1 }) ?? '—'}</strong></div>
        <p className="muted">{t(stats.adultBmi ? 'El IMC es una referencia general; no distingue masa muscular.' : 'Las categorías de IMC para adultos no se aplican a menores de 20 años.')}</p>
      </section>
    </div>

    <section className="insight-section" aria-labelledby="achievements-title">
      <div className="card-head"><h2 id="achievements-title">{t("Pequeñas grandes victorias")}</h2><Trophy size={20} /></div>
      <div className="achievement-grid">{achievements.map(achievement => <article className={`card achievement ${achievement.earned ? 'earned' : 'is-locked'}`} key={achievement.name}>
        <span className="achievement-icon">{achievement.earned ? achievement.icon : <LockKeyhole size={20} />}</span>
        <h3>{t(achievement.name)}</h3><p className="muted">{t(achievement.description)}</p>
        <div className="achievement-progress"><progress value={Math.min(achievement.count, achievement.target)} max={achievement.target} aria-label={t(achievement.name)} /><span>{Math.min(achievement.count, achievement.target)} / {achievement.target}</span></div>
        <span className={`pill ${achievement.earned ? 'accent' : ''}`}>{achievement.earned ? <><Check size={12} /> {t("Conseguido")}</> : t('Por descubrir')}</span>
      </article>)}</div>
    </section>
  </div>;
}

export function BmiPage({ data, onProfile, onHeightUnit }: InsightsProps) {
  const { t, locale } = useI18n();
  const [rangeMode, setRangeMode] = useState<'bmi' | 'weight'>('bmi');
  if (!data.profile) return null;
  const stats = getStats(data);
  const value = stats.currentBmi ?? 0;
  const category = bmiCategory(value, profileAge(data.profile));
  const unit = data.settings.weightUnit;
  const heightSquared = (data.profile.heightCm / 100) ** 2;
  const lowerWeight = 18.5 * heightSquared;
  const upperWeight = 25 * heightSquared;
  const deviation = value < 18.5 ? stats.currentWeight - lowerWeight : value >= 25 ? stats.currentWeight - upperWeight : 0;
  const deviationLabel = value < 18.5 ? 'Por debajo del límite inferior' : value >= 25 ? deviation < 0.005 ? 'En el límite superior' : 'Sobre el límite superior' : 'Dentro del rango de referencia';
  const weight = (kg: number) => displayWeight(kg, unit, 1, locale);
  const rangeText = (min: number, max: number) => {
    const format = (valueToFormat: number) => rangeMode === 'bmi' ? valueToFormat.toLocaleString(locale, { maximumFractionDigits: 1 }) : weight(valueToFormat * heightSquared);
    const suffix = rangeMode === 'weight' ? ` ${unit}` : '';
    if (min === 0) return `< ${format(max)}${suffix}`;
    if (!Number.isFinite(max)) return `≥ ${format(min)}${suffix}`;
    return `${format(min)} – < ${format(max)}${suffix}`;
  };
  return <div className="bmi-layout">
    <SectionHeading eyebrow={t("CONOCE TU CUERPO")} title={t("Un poco de perspectiva.")} text={t("Tu índice de masa corporal, explicado con calma.")} />
    <div className="detail-grid">
      <section className="card bmi-summary" aria-labelledby="bmi-summary-title">
        <div className="card-head"><h2 id="bmi-summary-title">{t("Tu equilibrio actual")}</h2><span className="pill">{t("IMC")}</span></div>
        <BmiGauge value={value} adult={stats.adultBmi} />
        <div className="bmi-category">{category ? <><span className="pill bmi-current-category">{t(category.label)}</span><p className="muted">{t("Referencia para adultos de 20 años o más")}</p></> : <><span className="pill">{t("Sin clasificación adulta")}</span><p className="muted">{t("Para tu edad se necesita una evaluación de IMC por edad.")}</p></>}</div>
      </section>
      <section className="card" aria-labelledby="bmi-details-title">
        <div className="card-head"><h2 id="bmi-details-title">{t("Tus medidas")}</h2><button className="icon-button" onClick={onProfile} aria-label={t("Editar altura, edad y meta")}><Pencil size={17} /></button></div>
        <div className="list-row"><span>{t("Altura")}</span><strong>{displayHeight(data.profile.heightCm, data.settings.heightUnit, locale)}</strong></div>
        <div className="list-row"><span className="muted">{t("Unidad de altura")}</span><HeightSwitch value={data.settings.heightUnit} onChange={onHeightUnit} /></div>
        <div className="list-row"><span>{t("Peso actual")}</span><strong>{weight(stats.currentWeight)} {unit}</strong></div>
        <div className="list-row"><span>{t("Edad")}</span><strong>{profileAge(data.profile)} {t("años")}</strong></div>
        {stats.adultBmi ? <>
          <div className="list-row"><span>{t("Rango normal de IMC")}</span><strong>{(18.5).toLocaleString(locale)} – &lt; 25</strong></div>
          <div className="list-row"><span>{t("Rango de peso de referencia")}</span><strong>{weight(lowerWeight)} – &lt; {weight(upperWeight)} {unit}</strong></div>
          <div className="list-row"><span>{t("Desviación del rango")}</span><strong>{deviation === 0 ? '—' : `${weight(Math.abs(deviation))} ${unit}`}</strong></div>
          <p className="muted">{t(deviationLabel)}{t(". En adultos, estos límites dependen de la altura; no cambian con la edad.")}</p>
        </> : <p className="muted">{t("Antes de los 20 años, el IMC se interpreta con referencias de crecimiento por edad y sexo. Aquí puedes seguir tu peso sin aplicar los rangos de adultos.")}</p>}
      </section>
    </div>

    {stats.adultBmi && <section className="card" aria-labelledby="bmi-ranges-title">
      <div className="card-head"><div><span className="eyebrow">{t("UNA REFERENCIA, NO UNA ETIQUETA")}</span><h2 id="bmi-ranges-title">{t("Los rangos, en contexto")}</h2></div><div className="unit-switch" role="group" aria-label={t("Mostrar rangos como")}>{(['bmi', 'weight'] as const).map(mode => <button key={mode} type="button" className={rangeMode === mode ? 'active' : ''} aria-pressed={rangeMode === mode} onClick={() => setRangeMode(mode)}>{mode === 'bmi' ? t('IMC') : `${t('Peso')} (${unit})`}</button>)}</div></div>
      <div className="bmi-range-list">{BMI_RANGES.map(range => <div className={`list-row bmi-range-row ${category === range ? 'current' : ''}`} key={range.label}>
        <span><i className="range-dot" aria-hidden="true" />{t(range.label)}{category === range && <span className="pill">{t("Tú estás aquí")}</span>}</span>
        <strong>{rangeText(range.min, range.max)}</strong>
      </div>)}</div>
      <p className="muted">{t("El inicio de cada rango está incluido; el límite con «<» no. Los valores se muestran redondeados, pero la categoría se calcula con el IMC completo.")}</p>
    </section>}
    <aside className="bmi-footnote muted">{t("El IMC relaciona peso y altura. Es una referencia general y no distingue músculo, grasa ni las particularidades de cada cuerpo.")} <a href="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html" target="_blank" rel="noreferrer">{t("Sobre los rangos de IMC")} <ArrowUpRight size={13} /></a></aside>
  </div>;
}

export function HistoryPage({ data, onRecord, onNewRecord }: InsightsProps) {
  const { t, locale } = useI18n();
  const dateLabel = (date: string, options?: Intl.DateTimeFormatOptions) => formatDate(date, locale, options);
  const [filter, setFilter] = useState<'all' | 'exercise' | 'healthy'>('all');
  const [month, setMonth] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const stats = getStats(data);
  const records = stats.allRecords.filter(record =>
    (!month || record.date.startsWith(month)) && (filter === 'all' || (filter === 'exercise' ? record.exercise : record.healthy)),
  ).reverse();
  const groups = new Map<string, DailyRecord[]>();
  for (const record of records) {
    const key = record.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const filterOptions = [{ value: 'all', label: 'Todos los registros', icon: ListFilter }, { value: 'exercise', label: 'Con ejercicio', icon: Dumbbell }, { value: 'healthy', label: 'Comer sano', icon: Leaf }] as const;
  return <div className="history-layout compact-history">
    <div className="history-topline"><h1 className="eyebrow">{t('TU HISTORIAL')}</h1><div className="history-tools">
      <div className="history-segments" role="group" aria-label={t('Filtrar registros por hábito')}>{filterOptions.map(({ value, label, icon: Icon }) => <button type="button" key={value} className={filter === value ? 'active' : ''} aria-label={t(label)} title={t(label)} aria-pressed={filter === value} onClick={() => setFilter(value)}><Icon size={18} /></button>)}</div>
      <button className={`round-action calendar-action ${month ? 'selected' : ''}`} aria-label={t('Filtrar por fecha')} title={t('Filtrar por fecha')} onClick={() => setCalendarOpen(true)}><CalendarDays size={19} />{month && <i />}</button>
      <button className="round-action add-action" aria-label={t('Añadir registro')} title={t('Añadir registro')} onClick={onNewRecord}><Plus size={21} /></button>
    </div></div>
    {month && <button className="history-month-chip" onClick={() => setMonth('')} aria-label={t('Quitar filtro de fecha')}>{dateLabel(`${month}-01`, { month: 'long', year: 'numeric' })}<X size={13} /></button>}
    {calendarOpen && <Modal title={t('Filtrar por fecha')} subtitle={t('Elige un mes para encontrar tus registros.')} onClose={() => setCalendarOpen(false)}><label className="field-label">{t('Mes de los registros')}<input className="history-month-input" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label><button className="primary-button full-width" onClick={() => setCalendarOpen(false)}>{t('Ver registros')}</button><button className="secondary-button full-width" onClick={() => { setMonth(''); setCalendarOpen(false); }}>{t('Todos los meses')}</button></Modal>}
    {records.length === 0 ? <div className="card empty-state"><CalendarDays size={32} /><h2>{t(data.records.length ? 'No hay registros con estos filtros.' : 'La primera página está por escribirse.')}</h2><p className="muted">{t(data.records.length ? 'Prueba otro mes o muestra todos tus hábitos.' : 'Un peso, un hábito, un pequeño momento para ti.')}</p>{data.records.length ? <button className="secondary-button" onClick={() => { setMonth(''); setFilter('all'); }}>{t('Ver todos los registros')} <ArrowRight size={16} /></button> : <button className="primary-button" onClick={onNewRecord}>{t('Crear mi primer registro')} <Plus size={16} /></button>}</div> :
      <div className="history-list">{Array.from(groups, ([key, entries]) => <section className="history-month" key={key} aria-labelledby={`month-${key}`}>
        <div className="card-head"><h2 id={`month-${key}`}>{dateLabel(`${key}-01`, { month: 'long', year: 'numeric' })}</h2><span className="muted">{entries.length} {t(entries.length === 1 ? 'día' : 'días')}</span></div>
        <div className="card">{entries.map(record => {
          const initial = stats.initialRecord?.id === record.id || (!stats.initialRecord && record.date === stats.startDate);
          const beforeInitial = record.date < stats.startDate;
          return <button key={record.id} className="list-row history-record" onClick={() => onRecord(record)} aria-label={`${t('Ver y editar registro')} · ${dateLabel(record.date, { day: 'numeric', month: 'long', year: 'numeric' })} · ${displayWeight(record.weightKg, data.settings.weightUnit, 1, locale)} ${data.settings.weightUnit} · ${t(record.exercise ? 'Con ejercicio' : 'Sin ejercicio')} · ${t(record.healthy ? 'Comer sano: sí' : 'Comer sano: no')}${initial ? ` · ${t('Punto de partida')}` : ''}`}>
            <span className="history-record-main"><span className="history-day">{record.date.slice(-2)}</span><span className="history-day-detail"><strong>{dateLabel(record.date, { weekday: 'long' })}</strong><span className="history-record-meta">{initial ? <span className="history-baseline"><Flag size={10} /> {t('Punto de partida')}</span> : beforeInitial ? <span className="muted">{t('Anterior a tu inicio actual')}</span> : <span className="muted">{dateLabel(record.date)}</span>}{record.note && <span className="record-note">{record.note}</span>}</span></span></span>
            <span className="history-habits"><span className={record.exercise ? 'habit-indicator positive' : 'habit-indicator'} title={t(record.exercise ? 'Con ejercicio' : 'Sin ejercicio')}><Dumbbell size={15} /></span><span className={record.healthy ? 'habit-indicator positive' : 'habit-indicator'} title={t(record.healthy ? 'Comer sano: sí' : 'Comer sano: no')}><Leaf size={15} /></span></span>
            <strong className="history-weight">{displayWeight(record.weightKg, data.settings.weightUnit, 1, locale)} <small>{data.settings.weightUnit}</small></strong><ChevronRight className="record-chevron" size={16} />
          </button>;
        })}</div>
      </section>)}</div>}
    {stats.allRecords.some(record => record.date < stats.startDate) && <p className="muted history-baseline-note">{t('Tus registros anteriores al inicio elegido siguen aquí.')} {t('Progreso desde')} {dateLabel(stats.startDate, { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}
  </div>;
}
