import { useState } from 'react';
import { Check, Download, FileSpreadsheet } from 'lucide-react';
import type { AppData, DailyRecord } from '../lib/model';
import { useI18n } from '../lib/i18n';
import { saveProgressWorkbook } from '../lib/workbook';
import { Modal } from './UI';

export default function WorkbookExport({ data, records, filteredRecords, label, disabled = false }: { data: AppData; records: DailyRecord[]; filteredRecords: DailyRecord[]; label: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false), [scope, setScope] = useState<'month' | 'filtered' | 'all'>('month');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  const chosen = scope === 'month' ? records : scope === 'filtered' ? filteredRecords : data.records;
  const scopeLabel = scope === 'month' ? label : t(scope === 'filtered' ? 'Todos los registros que coinciden con tus filtros' : 'Todo mi historial');
  return <><button type="button" className="round-action workbook-download" disabled={disabled} onClick={() => { setOpen(true); setDone(false); setError(''); }} aria-label={`${t('Descargar Excel')} · ${label}`}><Download size={15} /></button>{open && <Modal title={t('Tu historia en Excel.')} onClose={() => { if (!busy) setOpen(false); }}>
    <p className="muted workbook-intro">{t('Elige qué registros incluir. Se genera un archivo .xlsx con resumen y detalle.')}</p><div className="workbook-scopes">{([
      ['month', label, records.length], ['filtered', t('Con los filtros actuales'), filteredRecords.length], ['all', t('Todo mi historial'), data.records.length],
    ] as const).map(([value, title, count]) => <button type="button" key={value} className={scope === value ? 'selected' : ''} aria-pressed={scope === value} disabled={busy} onClick={() => { setScope(value); setDone(false); }}><FileSpreadsheet size={19} /><span><strong>{title}</strong><small>{count} {t('registros')}</small></span>{scope === value && <Check size={17} />}</button>)}</div>
    <p className="footnote">{t('Incluye fechas, peso, IMC, hábitos, pasos disponibles y notas. Los datos ausentes quedan vacíos.')}</p>{error && <p className="error-message" role="alert">{t(error)}</p>}{done && <p className="notice" role="status">{t('Archivo Excel generado. Puedes guardarlo o compartirlo.')}</p>}
    <button type="button" className="primary-button full-width" disabled={busy || !chosen.length} onClick={async () => { setBusy(true); setError(''); setDone(false); try { await saveProgressWorkbook(data, chosen, scopeLabel); setDone(true); } catch { setError('No se completó la exportación. Puedes volver a intentarlo.'); } finally { setBusy(false); } }}><Download size={17} />{t(busy ? 'Preparando archivo…' : 'Guardar o compartir Excel')}</button>
  </Modal>}</>;
}
