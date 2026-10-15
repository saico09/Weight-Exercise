import { useEffect, useState } from 'react';
import { Footprints, RefreshCw, Settings2 } from 'lucide-react';
import type { AppData, Settings } from '../lib/model';
import { dateKey } from '../lib/model';
import { nativeSteps, openStepsSettings, requestStepsAccess, stepsStatus, type StepsStatus } from '../lib/steps';
import { useI18n } from '../lib/i18n';
import './steps.css';

export function StepsSettings({ data, demo, onSettings }: { data: AppData; demo: boolean; onSettings: (settings: Partial<Settings>) => void }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<StepsStatus | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void stepsStatus().then(value => { if (alive) setStatus(value); }).catch(() => { if (alive) setStatus({ available: false, granted: false, onDeviceCounting: false }); });
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const toggle = async () => {
    if (data.settings.steps.enabled) { onSettings({ steps: { enabled: false } }); return; }
    setBusy(true); setError('');
    try { const result = await requestStepsAccess(); setStatus(result); if (result.granted) onSettings({ steps: { enabled: true } }); else setError('Puedes conceder acceso desde los ajustes de Health Connect.'); }
    catch { setError('No pudimos conectar los pasos. Revisa Health Connect y sus permisos.'); }
    finally { setBusy(false); }
  };
  return <section className="card steps-settings"><div className="card-head"><h2>{t('Tus pasos también cuentan.')}</h2><Footprints size={23} /></div>
    <p className="muted">{t('Sincroniza los pasos de Health Connect con los días en que registraste tu peso.')}</p>
    {!nativeSteps() ? <p className="notice">{t('Disponible en la app instalada, en Android 14 o posterior. El navegador no cuenta pasos.')}</p> : !status?.available ? <p className="notice">{t('Esta función necesita Android 14 o posterior y Health Connect disponible.')}</p> : <p className="footnote">{t(status.onDeviceCounting ? 'Tu teléfono admite el conteo automático de Health Connect.' : 'Conecta una aplicación que registre pasos en Health Connect. El conteo directo depende del teléfono y sus actualizaciones.')}</p>}
    <div className="list-row"><div><strong>{t('Sincronizar pasos')}</strong><span>{t('Al abrir la app y mientras la usas')}</span></div><button type="button" role="switch" aria-checked={data.settings.steps.enabled} aria-label={t('Sincronizar pasos')} className={`steps-switch ${data.settings.steps.enabled ? 'on' : ''}`} disabled={busy || demo || !status?.available} onClick={() => void toggle()}><span /></button></div>
    <p className="footnote">{t('Solo se completan registros de peso existentes de los últimos 30 días. Nunca se crea un pesaje automáticamente. Los pasos se incluyen si decides subir un respaldo.')}</p>
    {data.settings.steps.enabled && status && !status.granted && <p className="notice">{t('Puedes conceder acceso desde los ajustes de Health Connect.')}</p>}
    {nativeSteps() && status?.available && <button className="text-link" onClick={() => void openStepsSettings().catch(() => setError('No pudimos abrir Health Connect.'))}><Settings2 size={14} />Health Connect</button>}
    {error && <p className="notice" role="status">{t(error)}</p>}
  </section>;
}

export function StepsSummary({ data, onSettings }: { data: AppData; onSettings: () => void }) {
  const { t, locale } = useI18n();
  const record = data.records.find(entry => entry.date === dateKey());
  return <button type="button" className="steps-summary" onClick={onSettings} aria-label={t('Configurar pasos automáticos')}><span className="steps-icon"><Footprints size={18} /></span><span><strong>{typeof record?.steps === 'number' ? record.steps.toLocaleString(locale) : '—'} <small>{t('pasos de hoy')}</small></strong><span>{t(!record ? 'Guarda tu peso de hoy para asociar tus pasos.' : typeof record.steps === 'number' ? 'Health Connect · último total sincronizado' : data.settings.steps.enabled ? 'Esperando datos de Health Connect' : 'Conecta tus pasos')}</span></span><RefreshCw size={13} /></button>;
}
