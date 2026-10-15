import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Dumbbell, Flag, Footprints, Leaf, Minus } from 'lucide-react';
import type { AppData } from '../lib/model';
import { displayWeight, fromKg } from '../lib/model';
import { compareRecords } from '../lib/comparison';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './record-comparison-summary.css';

export default function RecordComparison({ data, selectedIds, onClose }: { data: AppData; selectedIds: string[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const comparison = useMemo(() => compareRecords(data, selectedIds), [data, selectedIds]);
  const [limit, setLimit] = useState(30);
  if (!comparison) return null;
  const { reference, rows, usesInitial, summary } = comparison;
  const summaryDelta = Math.round(fromKg(summary.weightChangeKg, data.settings.weightUnit) * 10) / 10;
  const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const weight = (value: number) => `${displayWeight(value, data.settings.weightUnit, 1, locale)} ${data.settings.weightUnit}`;
  const signed = (value: number, format: (number: number) => string) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${format(Math.abs(value))}`;
  const habitChange = (value: number | null) => value === null ? t('Sin dato de referencia') : value === 0 ? t('Sin cambio') : value > 0 ? t('No → Sí') : t('Sí → No');
  return <Modal title={t('Tu progreso, frente a frente.')} onClose={onClose} wide>
    <div className="comparison-reference"><span className="soft-icon"><Flag size={20} /></span><div><span className="eyebrow">{t(usesInitial ? 'TU PUNTO DE PARTIDA' : 'PRIMER REGISTRO SELECCIONADO')}</span><strong>{date(reference.date)}<span>{weight(reference.weightKg)}</span></strong></div></div>
    <p className="comparison-intro">{t(usesInitial ? 'Comparamos este registro con tu inicio elegido.' : 'Cada diferencia se calcula respecto del primer registro seleccionado, en orden de fecha.')}</p>
    <div className="comparison-list">{rows.slice(0, limit).map(row => <article className={`comparison-entry ${row.record.id === reference.id ? 'is-reference' : ''}`} key={row.record.id}>
      <div className="comparison-entry-head"><div><time dateTime={row.record.date}>{date(row.record.date)}</time><span>{row.record.id === reference.id ? t('Registro de referencia') : t(Math.abs(row.days) === 1 ? '{days} día respecto de la referencia' : '{days} días respecto de la referencia', { days: row.days })}</span></div><strong>{weight(row.record.weightKg)}<small>{signed(row.weightChangeKg, weight)}</small></strong></div>
      <div className="comparison-metrics"><div><span>{t('IMC')}</span><strong>{row.bmi.toLocaleString(locale, { maximumFractionDigits: 1 })}</strong><small>{signed(row.bmiChange, value => value.toLocaleString(locale, { maximumFractionDigits: 1 }))}</small></div><div><span><Footprints size={14} />{t('Pasos')}</span><strong>{row.record.steps === undefined ? '—' : row.record.steps.toLocaleString(locale)}</strong><small>{row.stepsChange === null ? t('Sin diferencia comparable') : signed(row.stepsChange, value => value.toLocaleString(locale))}</small></div></div>
      <div className="comparison-habits"><div><Dumbbell size={15} /><span>{t('Ejercicio')}<strong>{t(row.record.exercise ? 'Sí' : 'No')}</strong></span><small>{habitChange(row.exerciseChange)}</small></div><div><Leaf size={15} /><span>{t('Comer sano')}<strong>{t(row.record.healthy ? 'Sí' : 'No')}</strong></span><small>{habitChange(row.healthyChange)}</small></div></div>
    </article>)}</div>
    {rows.length > limit && <button className="text-link centered" onClick={() => setLimit(value => value + 30)}>{t('Mostrar más registros')}<ArrowRight size={15} /></button>}
    <section className="comparison-final-summary" aria-label={t('Diferencia final de peso')}>
      <span className="eyebrow">{t('DIFERENCIA FINAL DE PESO')}</span>
      <div className="comparison-final-value">{summaryDelta < 0 ? <ArrowDownRight size={26} /> : summaryDelta > 0 ? <ArrowUpRight size={26} /> : <Minus size={26} />}<strong>{summaryDelta === 0 ? weight(0) : signed(summary.weightChangeKg, weight)}</strong></div>
      <p>{t(summaryDelta === 0 ? 'El peso se mantiene igual.' : summaryDelta < 0 ? '{weight} menos que la referencia.' : '{weight} más que la referencia.', { weight: weight(Math.abs(summary.weightChangeKg)) })}</p>
      <div className="comparison-final-endpoints"><div><span>{t('Referencia')}</span><strong>{weight(summary.from.weightKg)}</strong><time dateTime={summary.from.date}>{date(summary.from.date)}</time></div><ArrowRight size={17} /><div><span>{t(usesInitial ? 'Registro seleccionado' : 'Último seleccionado')}</span><strong>{weight(summary.to.weightKg)}</strong><time dateTime={summary.to.date}>{date(summary.to.date)}</time></div></div>
    </section>
    <p className="footnote">{t('El IMC se calcula con tu altura actual para ambas fechas. Los pasos sin dato se muestran como «—»; no se cuentan como cero. Solo se comparan los registros seleccionados.')}</p>
  </Modal>;
}
