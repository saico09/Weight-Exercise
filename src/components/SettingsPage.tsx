import { useState } from 'react';
import { Bell, Check, ChevronRight, Moon, ShieldCheck, Sparkles, Sun, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { AppData, Settings } from '../lib/model';
import { configureNotifications, testNotification } from '../lib/notifications';
import { EDITION, APP_VERSION } from '../lib/edition';
import { useI18n } from '../lib/i18n';
import { HeightSwitch, LanguageSwitch, SectionHeading, UnitSwitch } from './UI';
import ProTeaser from './ProTeaser';
import RewardThemes from './RewardThemes';
import BasicMigration from './BasicMigration';
import LockedProThemes from './LockedProThemes';
import Feedback from './Feedback';
import CreatorCredit from './CreatorCredit';

export default function SettingsPage({ data, demo, onSettings, onReset, notify }: { data: AppData; demo: boolean; onSettings: (settings: Partial<Settings>) => void; onReset: () => void; notify: (message: string) => void }) {
  const { t, language, locale } = useI18n();
  const [reminder, setReminder] = useState(data.settings.notifications);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const native = Capacitor.isNativePlatform();
  const applyReminder = async (enabled: boolean) => {
    if (demo) { setMessage(t('Estás explorando la demo. Configura tus recordatorios cuando comiences tu propio camino.')); return; }
    setBusy(true);
    try {
      const config = { ...reminder, enabled };
      const result = await configureNotifications(config, language);
      const next = { ...config, enabled: result.enabled };
      setReminder(next); onSettings({ notifications: next }); setMessage(result.message);
    } catch (e) { setMessage(e instanceof Error ? t(e.message) : t('No pudimos configurar los recordatorios.')); }
    finally { setBusy(false); }
  };
  return <><SectionHeading eyebrow={t('A TU MANERA')} title={t('Tu espacio, tus reglas.')} text={t('Unos pocos ajustes para sentirte en casa.')} />
    <div className="settings-layout">
      <section className="card appearance-card">
        <div className="card-head"><div><span className="eyebrow">{t('01 / TU ENERGÍA')}</span><h2>{t('Tu estilo, a tu manera.')}</h2></div><Sparkles size={20} /></div>
        <p className="muted">{t('Elige cómo quieres vivir tu progreso.')}</p>
        <div className="settings-themes">{(['dark', 'light'] as const).map(theme => <button key={theme} className={`settings-theme ${theme} ${data.settings.theme === theme ? 'selected' : ''}`} onClick={() => onSettings({ theme })} aria-pressed={data.settings.theme === theme}>
          <div className="theme-mini"><div className="mini-line" /><span>{theme === 'dark' ? 'Beast mode' : t('Minimalista')}</span><div className="mini-chart"><svg viewBox="0 0 160 44" aria-hidden="true"><path d="M0 3 18 11 35 8 52 20 70 17 87 29 104 26 122 34 140 32 160 42" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg></div></div>
          <div className="settings-theme-label"><span>{theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}{theme === 'dark' ? 'Dark' : 'Light'}</span><i>{data.settings.theme === theme && <Check size={13} />}</i></div><span className="theme-description">{t(theme === 'dark' ? 'Intenso. Enfocado. Premium.' : 'Ligero. Sereno. Muy tú.')}</span>
        </button>)}<LockedProThemes /></div>
        <RewardThemes data={data} onSelect={theme => onSettings({ theme })} />
        <div className="settings-language"><span>{t('Idioma')}</span><LanguageSwitch value={language} onChange={next => { onSettings({ language: next }); setMessage(''); }} /></div>
      </section>
      <section className="card notification-card">
        <div className="card-head"><div><span className="eyebrow">{t('02 / UN PEQUEÑO RECORDATORIO')}</span><h2>{t('¿Te damos un empujoncito?')}</h2></div><Bell size={21} /></div>
        <p className="muted">{t('Tú eliges cuándo. Te recordamos dedicarte un minuto.')}</p>
        {!native && <p className="notice">{t('Los recordatorios programados funcionan en la app instalada en Android. Aquí puedes configurar tu horario y probar una notificación del navegador.')}</p>}
        <div className="reminder-status"><span><span className={`dot ${data.settings.notifications.enabled ? '' : 'rest-dot'}`} />{t(data.settings.notifications.enabled ? 'Recordatorios activados' : 'Recordatorios desactivados')}</span></div>
        <label className="field time-field">{t('Tu mejor momento')}<input type="time" aria-label={t('Hora del recordatorio')} value={reminder.time} onChange={e => setReminder(r => ({ ...r, time: e.target.value }))} /></label>
        <span className="field-label">{t('Los días que tú quieras')}</span>
        <div className="weekday-picker">{[1, 2, 3, 4, 5, 6, 0].map(day => {
          const weekday = new Date(2024, 0, 7 + day, 12);
          return <button key={day} className={reminder.days.includes(day) ? 'active' : ''} aria-label={weekday.toLocaleDateString(locale, { weekday: 'long' })} aria-pressed={reminder.days.includes(day)} onClick={() => setReminder(r => ({ ...r, days: r.days.includes(day) ? r.days.filter(d => d !== day) : [...r.days, day] }))}>{weekday.toLocaleDateString(locale, { weekday: 'narrow' })}</button>;
        })}</div>
        <button className="primary-button full-width" disabled={busy || !reminder.days.length || !reminder.time} onClick={() => void applyReminder(true)}><Bell size={17} />{t(busy ? 'Configurando…' : data.settings.notifications.enabled ? 'Guardar recordatorio' : 'Activar y configurar')}</button>
        {data.settings.notifications.enabled && <button className="text-link centered" disabled={busy} onClick={() => void applyReminder(false)}>{t('Desactivar recordatorios')}</button>}
        <button className="text-link centered" disabled={busy} onClick={() => {
          if (demo) return notify(t('Las notificaciones no se activan en la demo.'));
          setBusy(true);
          void testNotification(language).then(r => setMessage(r.message)).catch(() => setMessage(t('No pudimos mostrar la notificación. Revisa los permisos.'))).finally(() => setBusy(false));
        }}>{t('Enviar una prueba')}<ChevronRight size={15} /></button>
        {message && <p className="notice" role="status">{message}</p>}
        <p className="footnote">{t('El permiso se pide al activar. Si lo rechazaste, puedes habilitarlo en los ajustes de tu dispositivo.')}</p>
        <ProTeaser feature="recaps" compact />
      </section>
      <section className="card units-card">
        <div className="card-head"><div><span className="eyebrow">{t('03 / TUS MEDIDAS')}</span><h2>{t('Como te acomode.')}</h2></div></div>
        <div className="list-row"><div><strong>{t('Peso')}</strong><span>{t('Kilogramos o libras')}</span></div><UnitSwitch value={data.settings.weightUnit} onChange={weightUnit => onSettings({ weightUnit })} /></div>
        <div className="list-row"><div><strong>{t('Altura')}</strong><span>{t('Centímetros o pies y pulgadas')}</span></div><HeightSwitch value={data.settings.heightUnit} onChange={heightUnit => onSettings({ heightUnit })} /></div>
      </section>
      <ProTeaser feature="backup" />
      <BasicMigration data={data} demo={demo} />
      <Feedback />
      <section className="card privacy-card"><div className="soft-icon"><ShieldCheck size={22} /></div><h3>{t('Tu historia se queda contigo.')}</h3><p>{t('Los registros se guardan solo en este dispositivo, sin cuenta ni respaldo en la nube. Si borras los datos de la app o la desinstalas, se perderán.')}</p><button className="reset-button" onClick={onReset}><Trash2 size={17} /><span>{t(demo ? 'Reiniciar la demo' : 'Empezar de cero')}</span><ChevronRight size={17} /></button><div className="app-signature"><span className="app-version">WEIGHT&EXERCISE · {EDITION.toUpperCase()} · V{APP_VERSION}</span><CreatorCredit /></div></section>
    </div></>;
}
