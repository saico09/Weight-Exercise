import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, Mail, RefreshCw } from 'lucide-react';
import { cloud, CLOUD_NATIVE_UNAVAILABLE, CloudError, cloudErrorMessage, type EmailSummarySettings } from '../lib/cloud';
import { useI18n } from '../lib/i18n';
import { useCloudAccount } from './CloudAccount';
import { Modal } from './UI';
import './email-summary.css';

export function EmailSummaryControl({ demo = false, workbook = false }: { demo?: boolean; workbook?: boolean }) {
  const { t, locale } = useI18n();
  const account = useCloudAccount();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [config, setConfig] = useState<EmailSummarySettings | null>(null);
  const [consent, setConsent] = useState(false), [saved, setSaved] = useState(false);
  const currentUser = useRef(account.user?.id); currentUser.current = account.user?.id;
  const requestRevision = useRef(0);
  const load = async () => {
    const userId = currentUser.current;
    if (!userId) return;
    const revision = ++requestRevision.current;
    setBusy(true); setError('');
    try { const result = await cloud.emailSummary(userId); if (userId === currentUser.current && revision === requestRevision.current) { setConfig(result); setConsent(result.enabled); } }
    catch (reason) { if (userId === currentUser.current && revision === requestRevision.current) setError(t(cloudErrorMessage(reason))); }
    finally { if (userId === currentUser.current && revision === requestRevision.current) setBusy(false); }
  };
  useEffect(() => {
    currentUser.current = account.user?.id;
    setConfig(null); setConsent(false); setError(''); setSaved(false); setOpen(false); setBusy(false);
    if (account.user) void load();
    return () => { currentUser.current = undefined; requestRevision.current++; };
  }, [account.user?.id]);
  const save = async (enabled: boolean) => {
    const userId = currentUser.current;
    if (!userId || !config || busy || (enabled && (!consent || !config.recordCount))) return;
    const revision = ++requestRevision.current;
    setBusy(true); setError(''); setSaved(false);
    try {
      const result = await cloud.saveEmailSummary(enabled ? { enabled: true, consent: true, cadence: config.cadence, timezone: config.timezone.trim(), time: config.time, weekday: config.weekday, monthDay: config.monthDay } : { enabled: false }, userId);
      if (userId === currentUser.current && revision === requestRevision.current) { setConfig(result); setConsent(result.enabled); setSaved(true); }
    } catch (reason) {
      if (userId === currentUser.current && revision === requestRevision.current) setError(t(reason instanceof CloudError && reason.code === 'invalid_input' ? 'Revisa la hora y la zona horaria del envío.' : cloudErrorMessage(reason)));
      if (reason instanceof CloudError && (reason.code === 'account_changed' || reason.code === 'unauthorized')) await account.refresh();
    } finally { if (userId === currentUser.current && revision === requestRevision.current) setBusy(false); }
  };
  const dateLabel = (date: string) => new Date(date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return <><button type="button" className={`email-summary-toggle${workbook ? ' workbook-email-toggle' : ''}`} aria-label={t(workbook ? 'Configurar envío periódico de Excel' : 'Configurar resumen por correo')} aria-haspopup="dialog" onClick={() => { setOpen(true); setSaved(false); if (account.user) void load(); }}>{workbook && <CalendarClock size={16} aria-hidden="true" />}<span className={`email-summary-switch ${config?.enabled ? 'enabled' : ''}`} aria-hidden="true"><i /></span><span>{t(workbook ? 'Envío periódico' : 'Correo')}</span></button>
    {open && <Modal title={t(workbook ? 'Tu Excel, por correo.' : 'Tu progreso llega a ti.')} subtitle={t('Un resumen periódico y tu historial en Excel.')} onClose={() => { if (!busy) setOpen(false); }}>
      {workbook && <p className="muted email-summary-shared">{t('Cada semana o cada mes, recibe tu historial completo en Excel junto a tu resumen. Es la misma programación que aparece en Estadísticas.')}</p>}
      {demo && <p className="notice">{t('Los correos usan el respaldo de tu cuenta, no los datos de ejemplo. Solo se activan cuando tú lo confirmas.')}</p>}
      {CLOUD_NATIVE_UNAVAILABLE ? <p className="notice">{t(cloudErrorMessage(new CloudError('native_unconfigured')))}</p> : account.loading && !account.user ? <p className="muted" role="status">{t('Conectando…')}</p> : !account.user ? <div className="email-summary-empty"><span className="soft-icon"><Mail size={24} /></span><p>{t(account.unavailable ? cloudErrorMessage(new CloudError('unavailable')) : demo ? 'Sal de la demo e inicia sesión en Ajustes → Cuenta y respaldo para configurar los envíos con tus registros reales.' : 'Inicia sesión en Ajustes → Cuenta y respaldo para configurar los envíos.')}</p>{account.unavailable && <button type="button" className="secondary-button full-width" onClick={() => void account.refresh()}><RefreshCw size={16} />{t('Volver a intentar')}</button>}</div> : <>
        <div className="email-summary-destination"><Mail size={19} /><div><span>{t('Lo enviaremos a')}</span><strong>{account.user.email}</strong></div></div>
        {config && <><div className="email-summary-source"><span>{t('Respaldo disponible')}</span><strong>{config.recordCount} {t('registros')}</strong><small>{config.backupUpdatedAt ? dateLabel(config.backupUpdatedAt) : t('Todavía no tienes un respaldo.')}</small></div>
          <div className="segmented email-summary-cadence" role="group" aria-label={t('Frecuencia del correo')}>{(['weekly', 'monthly'] as const).map(cadence => <button key={cadence} type="button" disabled={busy} className={config.cadence === cadence ? 'active' : ''} aria-pressed={config.cadence === cadence} onClick={() => { setConfig(previous => previous && ({ ...previous, cadence })); setSaved(false); }}>{t(cadence === 'weekly' ? 'Semanal' : 'Mensual')}</button>)}</div>
          <div className="email-summary-schedule"><label className="field">{t(config.cadence === 'weekly' ? 'Día de la semana' : 'Día del mes')}{config.cadence === 'weekly' ? <select value={config.weekday} disabled={busy} onChange={event => { setConfig(previous => previous && ({ ...previous, weekday: Number(event.target.value) })); setSaved(false); }}>{[1, 2, 3, 4, 5, 6, 0].map(day => <option key={day} value={day}>{new Date(2024, 0, 7 + day, 12).toLocaleDateString(locale, { weekday: 'long' })}</option>)}</select> : <select value={config.monthDay} disabled={busy} onChange={event => { setConfig(previous => previous && ({ ...previous, monthDay: Number(event.target.value) })); setSaved(false); }}>{Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select>}</label><label className="field">{t('Hora del envío')}<input type="time" value={config.time} disabled={busy} onChange={event => { setConfig(previous => previous && ({ ...previous, time: event.target.value })); setSaved(false); }} /></label></div>
          <label className="field">{t('Zona horaria')}<input value={config.timezone} disabled={busy} maxLength={80} onChange={event => { setConfig(previous => previous && ({ ...previous, timezone: event.target.value })); setSaved(false); }} /></label><button type="button" className="text-link" disabled={busy} onClick={() => { setConfig(previous => previous && ({ ...previous, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })); setSaved(false); }}>{t('Usar la zona de este dispositivo')}</button>
          <p className="notice">{t('El correo usa tu último respaldo, aunque la app esté cerrada. Para incluir nuevos registros, actualiza el respaldo desde Ajustes.')}</p>
          {config.mailMode === 'mailpit' && <p className="notice">{t('Modo de prueba: el envío llegará a Mailpit, no a tu correo real.')}</p>}
          <label className="email-summary-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>{t('Quiero recibir el resumen y un Excel con todos mis registros respaldados, incluidas las notas, en este correo.')}</span></label>
          {!config.recordCount && <p className="input-hint">{t('Guarda primero un respaldo con registros desde Ajustes.')}</p>}
          {config.nextSendAt && config.enabled && <p className="email-summary-next"><CalendarClock size={16} /><span>{t('Próximo envío')}: {dateLabel(config.nextSendAt)}<small>{t('Horario mostrado en la zona de este dispositivo.')}</small></span></p>}
          {saved && <p className="notice" role="status"><Check size={14} /> {t(config.enabled ? 'Envíos programados. Puedes desactivarlos aquí cuando quieras.' : 'Envíos por correo desactivados.')}</p>}
          <button type="button" className="primary-button full-width" disabled={busy || !consent || !config.recordCount || !config.time || !config.timezone.trim()} onClick={() => void save(true)}><Mail size={16} />{t(busy ? 'Guardando…' : config.enabled ? 'Guardar programación' : 'Activar envíos por correo')}</button>
          {config.enabled && <button type="button" className="text-link centered" disabled={busy} onClick={() => void save(false)}>{t('Desactivar envíos por correo')}</button>}
        </>}
        {!config && !busy && <button type="button" className="secondary-button full-width" onClick={() => void load()}><RefreshCw size={16} />{t('Volver a intentar')}</button>}
      </>}{busy && !config && <p className="muted" role="status">{t('Conectando…')}</p>}{error && <p className="error-message" role="alert">{error}</p>}
    </Modal>}
  </>;
}
