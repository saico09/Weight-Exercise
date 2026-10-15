import { useState } from 'react';
import { Download, FileText, Sparkles } from 'lucide-react';
import type { AppData } from '../lib/model';
import { dateKey, displayWeight } from '../lib/model';
import { buildProgressReport, reportRange, saveProgressPdf, type ReportRange } from '../lib/report';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './report-export.css';

export default function ReportExport({ data }: { data: AppData }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <><button type="button" className="card report-launcher" onClick={() => setOpen(true)}><span className="report-launcher-icon"><FileText size={24} /></span><span><small>{t('TU PROGRESO, PARA LLEVAR')}</small><strong>{t('Crear informe PDF')}</strong><span>{t('Con tu tema, tu color y tus registros.')}</span></span><span className="report-pro-badge"><Sparkles size={11} />PRO</span></button>{open && <ReportDialog data={data} onClose={() => setOpen(false)} />}</>;
}

function ReportDialog({ data, onClose }: { data: AppData; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<ReportRange>(() => reportRange(data, 30));
  const [preset, setPreset] = useState<number | null>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  let summary = null, validation = '';
  try { summary = buildProgressReport(data, range); } catch (reason) { validation = reason instanceof Error ? reason.message : 'Elige un rango de fechas válido hasta hoy.'; }
  const weight = (kg: number) => `${displayWeight(kg, data.settings.weightUnit, 1, locale)} ${data.settings.weightUnit}`;
  return <Modal title={t('Tu informe Pro.')} subtitle={t('Elige el período. El PDF usará tu apariencia actual.')} onClose={onClose}>
    <div className="report-options"><div className="segmented" aria-label={t('Período del informe')}>{[[30, '1M'], [90, '3M'], [0, 'Todo']].map(([value, title]) => <button type="button" key={value} className={preset === value ? 'active' : ''} aria-pressed={preset === value} disabled={busy} onClick={() => { setPreset(Number(value)); setRange(reportRange(data, Number(value))); setDone(false); }}>{t(String(title))}</button>)}</div>
    <div className="report-date-fields"><label className="field">{t('Desde')}<input type="date" min="1900-01-01" max={range.end || dateKey()} value={range.start} disabled={busy} onChange={event => { setRange(previous => ({ ...previous, start: event.target.value })); setPreset(null); setDone(false); }} /></label><label className="field">{t('Hasta')}<input type="date" min={range.start || '1900-01-01'} max={dateKey()} value={range.end} disabled={busy} onChange={event => { setRange(previous => ({ ...previous, end: event.target.value })); setPreset(null); setDone(false); }} /></label></div>
    {summary && <div className="report-preview"><div className="report-preview-brand">Weight&<br />Exercise<span>PRO</span></div><div className="report-preview-divider" /><span className="eyebrow">{t('TU EVOLUCIÓN')}</span><div className="report-preview-metrics"><div><strong>{summary.records.length}</strong><span>{t('registros')}</span></div><div><strong>{summary.changeKg === null ? '—' : `${summary.changeKg > 0 ? '+' : ''}${weight(summary.changeKg)}`}</strong><span>{t('Cambio en el período')}</span></div></div><div className="report-preview-bars"><span>{t('Ejercicio')}<b>{Math.round(summary.exercisePercent)}%</b></span><div><i style={{ width: `${summary.exercisePercent}%` }} /></div><span>{t('Comer sano')}<b>{Math.round(summary.healthyPercent)}%</b></span><div><i style={{ width: `${summary.healthyPercent}%` }} /></div></div></div>}
    <p className="input-hint">{t('Incluye resumen, gráfico de peso, hábitos y el detalle de los registros del período. Se genera en tu dispositivo.')}</p>
    {validation && <p className="error-message" role="alert">{t(validation)}</p>}{!validation && !summary?.records.length && <p className="input-hint">{t('No hay registros en este período.')}</p>}
    {error && <p className="error-message" role="alert">{t(error)}</p>}
    {done && <p className="report-success" role="status">{t('Informe generado. Puedes guardarlo o compartirlo.')}</p>}
    <button type="button" className="primary-button full-width" disabled={busy || !!validation || !summary?.records.length} onClick={async () => {
      setBusy(true); setError(''); setDone(false);
      try { await saveProgressPdf(data, range); setDone(true); }
      catch { setError('No se completó la exportación. Puedes volver a intentarlo.'); }
      finally { setBusy(false); }
    }}><Download size={17} />{t(busy ? 'Preparando informe…' : 'Guardar o compartir PDF')}</button></div>
  </Modal>;
}
