import { useEffect, useState } from 'react';
import { Check, Footprints, Settings2 } from 'lucide-react';
import type { AppData, Settings } from '../lib/model';
import { dateKey } from '../lib/model';
import { nativeSteps, openStepsSettings, requestStepsAccess, stepsStatus, type StepsStatus } from '../lib/steps';
import { useI18n } from '../lib/i18n';
import { dailyStepTarget, stepProgress } from '../lib/stepGoal';
import './steps.css';

export function StepsSettings({ data, demo, onSettings }: { data: AppData; demo: boolean; onSettings: (settings: Partial<Settings>) => void }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<StepsStatus | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [goal, setGoal] = useState(String(dailyStepTarget(data) ?? ''));
  const [goalSaved, setGoalSaved] = useState(false);
  useEffect(() => { setGoal(String(dailyStepTarget(data) ?? '')); }, [data.settings.stepGoal, data.profile]);
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
    <form className="steps-goal-form" onSubmit={event => {
      event.preventDefault();
      const value = Number(goal);
      if (!Number.isInteger(value) || value < 100 || value > 50000) { setError('Elige una meta entre 100 y 50.000 pasos.'); return; }
      onSettings({ stepGoal: value }); setError(''); setGoalSaved(true);
    }}>
      <label htmlFor="daily-step-goal">{t('Tu meta diaria de pasos')}</label>
      <div><input id="daily-step-goal" type="number" inputMode="numeric" min="100" max="50000" step="1" required value={goal} onChange={event => { setGoal(event.target.value); setGoalSaved(false); }} /><button type="submit" className="secondary-button">{t('Guardar meta')}</button></div>
      {goalSaved && <span role="status" className="steps-goal-saved"><Check size={13} />{t('Meta guardada')}</span>}
      <p className="footnote">{t('7.000 pasos es una referencia orientativa para adultos. Puedes adaptarla a tu capacidad y a tu rutina; no es una recomendación individual.')}</p>
      <a className="text-link" href="https://www.sydney.edu.au/news-opinion/news/2025/07/24/rethink-the-10000-a-day-step-goal-study-suggests.html" target="_blank" rel="noreferrer">{t('Sobre esta referencia')}</a>
      {data.settings.stepGoal !== null && <button type="button" className="text-link" onClick={() => onSettings({ stepGoal: null })}>{t('Usar referencia por edad')}</button>}
    </form>
    {error && <p className="notice" role="status">{t(error)}</p>}
  </section>;
}

export function StepsSummary({ data, onSettings }: { data: AppData; onSettings: () => void }) {
  const { t, locale } = useI18n();
  const record = data.records.find(entry => entry.date === dateKey());
  const target = dailyStepTarget(data), progress = stepProgress(record?.steps, target);
  const percent = progress === null ? null : Math.round(progress * 100);
  const summaryLabel = [t('Configurar pasos y meta diaria'), record?.steps === undefined ? t('Sin datos de pasos') : `${record.steps.toLocaleString(locale)} ${t('pasos')}`, target ? `${t('Meta diaria')}: ${target.toLocaleString(locale)}` : t('Elige tu meta'), percent === null ? '' : `${percent}%`].filter(Boolean).join('. ');
  const detail = !record ? 'Guarda tu peso de hoy para asociar tus pasos.' : record.steps === undefined ? data.settings.steps.enabled ? 'Esperando datos de Health Connect' : 'Conecta tus pasos' : progress === 1 ? 'Meta diaria alcanzada' : 'Cada paso suma';
  return <button type="button" className="steps-summary" onClick={onSettings} aria-label={summaryLabel}>
    <span className="steps-ring" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" className="steps-ring-track" />{percent !== null && percent > 0 && <circle cx="24" cy="24" r="20" pathLength="100" strokeDasharray={`${percent} 100`} className="steps-ring-fill" />}</svg><Footprints size={18} /></span>
    <span className="steps-summary-copy"><strong>{record?.steps === undefined ? '—' : record.steps.toLocaleString(locale)} <small>{target ? `/ ${target.toLocaleString(locale)} ${t('pasos')}` : t('pasos de hoy')}</small></strong><span>{t(detail)}</span></span>
    <span className="steps-summary-progress"><strong>{percent === null ? '—' : `${percent}%`}</strong><small>{t(target ? data.settings.stepGoal === null ? 'Referencia diaria' : 'Meta personal' : 'Elige tu meta')}</small></span>
  </button>;
}
