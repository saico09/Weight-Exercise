import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, FileText, Sparkles } from 'lucide-react';
import type { AppData } from '../lib/model';
import { dateKey, displayWeight } from '../lib/model';
import { buildReportOverview, reportRange, saveProgressPdf, type ReportRange } from '../lib/report';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import { EmailSummaryControl } from './EmailSummaryControl';
import './report-export.css';

export default function ReportExport({ data, disabled = false }: { data: AppData; disabled?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <><section className="card report-launcher"><button type="button" className="report-launcher-button" onClick={() => setOpen(true)}><span className="report-launcher-icon"><FileText size={24} /></span><span><small>{t('TU PROGRESO, PARA LLEVAR')}</small><strong>{t('Crear informe PDF')}</strong><span>{t('Toda tu historia. Comparaciones claras. Tu estilo.')}</span></span></button><div className="report-launcher-actions"><span className="report-pro-badge"><Sparkles size={11} />PRO</span><EmailSummaryControl data={data} disabled={disabled} /></div></section>{open && <ReportDialog data={data} onClose={() => setOpen(false)} />}</>;
}

function ReportDialog({ data, onClose }: { data: AppData; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<ReportRange>(() => reportRange(data, 30));
  const [preset, setPreset] = useState<number | null>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  let report = null, validation = '';
  try { report = buildReportOverview(data, range); } catch (reason) { validation = reason instanceof Error ? reason.message : 'Elige un rango de fechas válido hasta hoy.'; }
  const weight = (kg: number | null, signed = false) => kg === null ? '—' : `${signed && kg > 0 ? '+' : ''}${displayWeight(kg, data.settings.weightUnit, 1, locale)} ${data.settings.weightUnit}`;
  return <Modal title={t('Tu informe Pro.')} subtitle={t('Una visión completa y una comparación del período que tú elijas.')} onClose={onClose}>
    <div className="report-options"><div className="segmented" aria-label={t('Período del informe')}>{[[30, '1M'], [90, '3M'], [0, 'Todo']].map(([value, title]) => <button type="button" key={value} className={preset === value ? 'active' : ''} aria-pressed={preset === value} disabled={busy} onClick={() => { setPreset(Number(value)); setRange(reportRange(data, Number(value))); setDone(false); }}>{t(String(title))}</button>)}</div>
    <div className="report-date-fields"><label className="field">{t('Desde')}<input type="date" min="1900-01-01" max={range.end || dateKey()} value={range.start} disabled={busy} onChange={event => { setRange(previous => ({ ...previous, start: event.target.value })); setPreset(null); setDone(false); }} /></label><label className="field">{t('Hasta')}<input type="date" min={range.start || '1900-01-01'} max={dateKey()} value={range.end} disabled={busy} onChange={event => { setRange(previous => ({ ...previous, end: event.target.value })); setPreset(null); setDone(false); }} /></label></div>
    {report && <div className="report-preview"><div className="report-preview-brand">Weight&<br />Exercise<span>PRO</span></div><div className="report-preview-divider" /><span className="eyebrow">{t('TU HISTORIA COMPLETA')}</span><div className="report-preview-metrics"><div><strong>{report.global.records.length}</strong><span>{t('registros en total')}</span></div><div><strong>{weight(report.global.changeKg, true)}</strong><span>{t('Cambio total registrado')}</span></div></div><div className="report-preview-comparison"><span className="eyebrow">{t('TU PERÍODO, EN CONTEXTO')}</span><div className="report-comparison-numbers"><div><span>{t('Promedio anterior')}</span><strong>{weight(report.previous.averageKg)}</strong></div>{report.averageChangeKg !== null && (report.averageChangeKg <= 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />)}<div><span>{t('Promedio elegido')}</span><strong>{weight(report.selected.averageKg)}</strong></div></div><p>{report.previous.records.length && report.selected.records.length ? t('{previous} registros anteriores · {current} en el período elegido', { previous: report.previous.records.length, current: report.selected.records.length }) : t('La comparación se completa cuando ambos períodos tienen registros.')}</p></div></div>}
    <ol className="report-includes"><li><span>01</span><div><strong>{t('Tu trayectoria completa')}</strong><p>{t('Peso, hábitos y pasos de todo tu historial.')}</p></div></li><li><span>02</span><div><strong>{t('Comparación entre períodos')}</strong><p>{t('Dos períodos de igual duración, con sus datos disponibles.')}</p></div></li><li><span>03</span><div><strong>{t('Registros del período elegido')}</strong><p>{t('Fecha, peso, hábitos y pasos, ordenados día a día.')}</p></div></li></ol>
    <p className="input-hint">{t('El PDF se crea en tu dispositivo con tu tema y color actuales.')}</p>
    {validation && <p className="error-message" role="alert">{t(validation)}</p>}{!validation && !report?.global.records.length && <p className="input-hint">{t('No hay registros para crear un informe.')}</p>}
    {!validation && !!report?.global.records.length && !report.selected.records.length && <p className="input-hint">{t('El período está vacío. El informe incluirá tu resumen general e indicará que no hay datos en esas fechas.')}</p>}
    {error && <p className="error-message" role="alert">{t(error)}</p>}
    {done && <p className="report-success" role="status">{t('Informe generado. Puedes guardarlo o compartirlo.')}</p>}
    <button type="button" className="primary-button full-width" disabled={busy || !!validation || !report?.global.records.length} onClick={async () => {
      setBusy(true); setError(''); setDone(false);
      try { await saveProgressPdf(data, range); setDone(true); }
      catch { setError('No se completó la exportación. Puedes volver a intentarlo.'); }
      finally { setBusy(false); }
    }}><Download size={17} />{t(busy ? 'Preparando informe…' : 'Guardar o compartir PDF')}</button></div>
  </Modal>;
}
