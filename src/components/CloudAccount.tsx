import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Check, Cloud, CloudDownload, CloudUpload, Crown, ExternalLink, KeyRound, LoaderCircle, LogOut, Mail, Pencil, RefreshCw, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { cloud, CLOUD_NATIVE_UNAVAILABLE, CloudError, cloudErrorMessage, type CloudBackup, type CloudUser, type CloudMailMode } from '../lib/cloud';
import { useI18n } from '../lib/i18n';
import type { AppData, Language } from '../lib/model';
import { Brand, LanguageSwitch, Modal } from './UI';
import './cloud.css';

const usernamePattern = String.raw`[\p{L}\p{N}_\-]{3,30}`;

type AccountContext = {
  user: CloudUser | null; loading: boolean; localDevelopment: boolean; mailMode: CloudMailMode | null; unavailable: boolean;
  refresh: () => Promise<void>; setUser: (user: CloudUser | null) => void;
};
const Account = createContext<AccountContext | null>(null);

/** Mount once around the Pro UI. Accounts never automatically upload or restore data. */
export function CloudAccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [localDevelopment, setLocalDevelopment] = useState(false);
  const [mailMode, setMailMode] = useState<CloudMailMode | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const epoch = useRef(0);
  const updateUser = useCallback((next: CloudUser | null) => { epoch.current++; setUser(next); setUnavailable(false); }, []);
  const refresh = useCallback(async () => {
    const requestEpoch = epoch.current;
    setLoading(true);
    try {
      const result = await cloud.account();
      if (requestEpoch !== epoch.current) return;
      setUser(result.user); setLocalDevelopment(result.localDevelopment); setMailMode(result.mailMode || null); setUnavailable(false);
    } catch { if (requestEpoch === epoch.current) setUnavailable(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <Account.Provider value={{ user, loading, localDevelopment, mailMode, unavailable, refresh, setUser: updateUser }}>{children}</Account.Provider>;
}

export function useCloudAccount() {
  const value = useContext(Account);
  if (!value) throw new Error('CloudAccountProvider is required.');
  return value;
}

function LocalInbox() {
  const { mailMode } = useCloudAccount();
  const { t } = useI18n();
  return mailMode === 'mailpit' ? <div className="cloud-local-note"><span>{t('Prueba local: los códigos llegan a la bandeja de pruebas, no a tu correo real.')}</span><a href="http://127.0.0.1:8025" target="_blank" rel="noopener noreferrer">{t('Abrir bandeja local en este PC')}<ExternalLink size={13} /></a></div> : mailMode === 'real' ? <p className="cloud-security-note"><Mail size={14} />{t('El código llegará a tu correo real. Revisa también la carpeta de spam.')}</p> : null;
}

function AccountAccess({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const { setUser, refresh } = useCloudAccount();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => { if (sent) codeRef.current?.focus(); }, [sent]);
  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault(); setBusy(true); setMessage('');
    try { await cloud.requestCode(email); setSent(true); setCode(''); setCooldown(60); void refresh(); }
    catch (error) { setMessage(t(cloudErrorMessage(error))); }
    finally { setBusy(false); }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const result = await cloud.verifyCode(email, code, username); setUser(result.user); onDone?.(); }
    catch (error) { setMessage(t(cloudErrorMessage(error))); }
    finally { setBusy(false); }
  };
  if (CLOUD_NATIVE_UNAVAILABLE) return <p className="notice">{t(cloudErrorMessage(new CloudError('native_unconfigured')))}</p>;
  return <div className="cloud-access">
    <div className="cloud-access-heading"><span className="soft-icon"><KeyRound size={21} /></span><div><h3>{t(sent ? 'Revisa tu correo' : 'Tu cuenta, sin contraseña.')}</h3><p>{t(sent ? 'Introduce el código de 6 dígitos que enviamos a:' : 'Crea tu cuenta o entra con un código de un solo uso.')}{sent && <strong className="cloud-email">{email.trim()}</strong>}</p></div></div>
    <form onSubmit={sent ? verify : sendCode}>
      {!sent ? <>
        <label className="field">{t('Correo electrónico')}<input disabled={busy} type="email" autoComplete="email" name="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
        <label className="field">{t('Nombre de usuario')}<input disabled={busy} autoComplete="username" name="username" maxLength={30} minLength={3} pattern={usernamePattern} value={username} onChange={event => setUsername(event.target.value)} placeholder={t('Tu nombre en la app')} /><span className="cloud-field-help">{t('Opcional: 3 a 30 letras, números o guiones. Si ya tienes cuenta, conservaremos tu nombre.')}</span></label>
      </> : <label className="field">{t('Código de acceso')}<input disabled={busy} ref={codeRef} className="cloud-code-input" inputMode="numeric" autoComplete="one-time-code" name="code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>}
      <button type="submit" className="primary-button full-width" disabled={busy || (sent && code.length !== 6)}>{busy ? <LoaderCircle size={17} className="cloud-spinner" /> : sent ? <Check size={17} /> : <Mail size={17} />}{t(busy ? 'Un momento…' : sent ? 'Entrar a mi cuenta' : 'Enviar código')}</button>
    </form>
    {sent && <div className="cloud-access-links"><button className="text-link" disabled={busy} onClick={() => { setSent(false); setCode(''); setMessage(''); }}>{t('Cambiar correo o nombre')}</button><button className="text-link" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown > 0 ? t('Reenviar en {seconds}s', { seconds: cooldown }) : t('Reenviar código')}</button></div>}
    {message && <p className="notice" role="alert">{message}</p>}
    <LocalInbox />
    <p className="cloud-security-note"><ShieldCheck size={14} />{t('Solo quien tenga acceso a tu correo podrá entrar. El código por correo no es una verificación de dos factores.')}</p>
  </div>;
}

export function ProWelcome({ onContinue, data, onRestore, notify = () => {}, onLanguage }: { onContinue: () => void; data?: AppData; onRestore?: (data: AppData) => void | Promise<void>; notify?: (message: string) => void; onLanguage?: (language: Language) => void }) {
  const { t, language } = useI18n();
  const { user, loading } = useCloudAccount();
  return <main className="cloud-welcome">
    <div className="cloud-welcome-top"><Brand /><div className="cloud-welcome-tools">{onLanguage && <LanguageSwitch value={language} onChange={onLanguage} />}<span className="cloud-pro-badge"><Crown size={12} /> PRO</span></div></div>
    <div className="cloud-welcome-layout"><section className="cloud-welcome-story"><span className="eyebrow">{t('TU PRÓXIMO NIVEL')}</span><h1>{t('Cada avance.')}<br /><em>{t('Siempre contigo.')}</em></h1><p>{t('Más maneras de entender tu progreso. Un espacio que se adapta a ti.')}</p><div className="cloud-welcome-orbit" aria-hidden="true"><div><Cloud size={42} /><span>W&E</span></div><i /><b /></div><ul><li><Cloud size={18} />{t('Respaldo privado de tu historia')}</li><li><Crown size={18} />{t('Informes y recuentos de progreso')}</li><li><ShieldCheck size={18} />{t('Tus registros también funcionan sin conexión')}</li></ul></section>
      <section className="card cloud-welcome-card">{user ? <><div className="cloud-welcome-success"><span className="soft-icon"><Check size={26} /></span><h2>{t('Bienvenido, {name}', { name: user.username })}</h2><p>{t('Tu cuenta está lista. Tú eliges cuándo respaldar o restaurar tu historia desde Ajustes.')}</p><button className="primary-button full-width" onClick={onContinue}>{t('Comenzar mi camino')}<ArrowRight size={17} /></button></div>{data && onRestore && <CloudAccountPanel data={data} onRestore={onRestore} notify={notify} />}</> : <><AccountAccess /><button className="text-link cloud-offline-link" onClick={onContinue}>{t(loading ? 'Continuar mientras conectamos' : 'Continuar sin cuenta')}<ArrowRight size={15} /></button><p className="footnote">{t('Puedes crear tu cuenta más adelante desde Ajustes.')}</p></>}</section>
    </div>
  </main>;
}

function EditAccount({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const { t } = useI18n();
  const { user, setUser, refresh } = useCloudAccount();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const perform = async (action: () => Promise<void>) => { setBusy(true); setMessage(''); try { await action(); } catch (error) { setMessage(t(cloudErrorMessage(error))); if (error instanceof CloudError && error.code === 'account_changed') { notify(t(cloudErrorMessage(error))); await refresh(); } } finally { setBusy(false); } };
  if (!user) return null;
  return <Modal title={t('Tu cuenta')} onClose={onClose}>
    <form className="cloud-edit-form" onSubmit={event => { event.preventDefault(); void perform(async () => { const result = await cloud.rename(username, user.id); setUser(result.user); setMessage(t('Nombre actualizado.')); }); }}>
      <label className="field">{t('Nombre de usuario')}<input required disabled={busy} autoComplete="username" minLength={3} maxLength={30} pattern={usernamePattern} value={username} onChange={event => setUsername(event.target.value)} /></label><button className="secondary-button full-width" disabled={busy || username === user.username}>{t('Guardar nombre')}</button>
    </form>
    <div className="cloud-divider" />
    <form className="cloud-edit-form" onSubmit={event => { event.preventDefault(); void perform(async () => { if (sent) { const result = await cloud.verifyEmailChange(email, currentCode, newCode, user.id); setUser(result.user); setEmail(''); setCurrentCode(''); setNewCode(''); setSent(false); setMessage(t('Correo actualizado. Las otras sesiones se cerraron.')); } else { await cloud.requestEmailChange(email, user.id); setSent(true); } }); }}>
      <h3>{t('Cambiar correo')}</h3><p className="muted">{t('Confirmaremos el cambio con un código en tu correo actual y otro en el nuevo.')}</p>
      <label className="field">{t('Nuevo correo')}<input required disabled={busy} type="email" maxLength={254} autoComplete="email" readOnly={sent} value={email} onChange={event => setEmail(event.target.value)} /></label>
      {sent && <><label className="field">{t('Código enviado a tu correo actual')}<input inputMode="numeric" required pattern="[0-9]{6}" maxLength={6} value={currentCode} onChange={event => setCurrentCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><label className="field">{t('Código enviado al nuevo correo')}<input inputMode="numeric" required pattern="[0-9]{6}" maxLength={6} value={newCode} onChange={event => setNewCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label></>}
      <button className="primary-button full-width" disabled={busy || !email || (sent && (currentCode.length !== 6 || newCode.length !== 6))}>{t(busy ? 'Un momento…' : sent ? 'Confirmar nuevo correo' : 'Enviar códigos de confirmación')}</button>
      {sent && <button type="button" className="text-link" disabled={busy} onClick={() => { setSent(false); setCurrentCode(''); setNewCode(''); }}>{t('Cambiar dirección o pedir nuevos códigos')}</button>}
    </form>{message && <p className="notice" role="status">{message}</p>}<LocalInbox />
  </Modal>;
}

export function CloudAccountPanel({ data, onRestore, notify, demo = false }: { data: AppData; onRestore: (data: AppData) => void | Promise<void>; notify: (message: string) => void; demo?: boolean }) {
  const { t, locale } = useI18n();
  const account = useCloudAccount();
  const [dialog, setDialog] = useState<'login' | 'edit' | 'backup' | 'restore' | 'delete' | 'logout' | null>(null);
  const [backup, setBackup] = useState<CloudBackup | null>(null);
  const [backupOwner, setBackupOwner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const userRef = useRef(account.user?.id);
  userRef.current = account.user?.id;
  useEffect(() => { setBackup(null); setBackupOwner(null); setDialog(null); setMessage(''); }, [account.user?.id]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(t(cloudErrorMessage(error))); if (error instanceof CloudError && error.code === 'unauthorized') account.setUser(null); if (error instanceof CloudError && error.code === 'account_changed') { notify(t(cloudErrorMessage(error))); await account.refresh(); } }
    finally { setBusy(false); }
  };
  const loadBackup = async () => {
    const owner = userRef.current;
    if (!owner) return;
    const result = await cloud.backup(owner);
    if (owner !== userRef.current) return;
    setBackup(result); setBackupOwner(owner);
  };
  const openBackup = (action: 'backup' | 'restore') => { setDialog(action); setBackup(null); setBackupOwner(null); void run(loadBackup); };
  const confirmBackup = () => void run(async () => {
    if (!backup || backupOwner !== userRef.current) throw new CloudError('unauthorized');
    const owner = backupOwner;
    try {
      const result = await cloud.saveBackup(backup.revision, data, owner!);
      if (owner !== userRef.current) return;
      setBackup({ ...result, data }); setDialog(null); notify(t('Respaldo guardado. Tu historia está a salvo.'));
    } catch (error) {
      // A conflict never retries an overwrite. Reload, then require another explicit confirmation.
      if (error instanceof CloudError && error.code === 'conflict') { setBackup(null); await loadBackup(); }
      throw error;
    }
  });
  const confirmRestore = () => void run(async () => {
    if (!backup?.data || backupOwner !== userRef.current) throw new CloudError('unauthorized');
    const owner = backupOwner;
    const latest = await cloud.backup(owner!);
    if (owner !== userRef.current) return;
    if (latest.revision !== backup.revision) { setBackup(latest); throw new CloudError('conflict'); }
    if (!latest.data) throw new CloudError('invalid_backup');
    await onRestore(latest.data); setDialog(null); notify(t('Respaldo restaurado en este dispositivo.'));
  });
  const backupDate = backup?.updatedAt ? new Date(backup.updatedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const isOwner = !!backup && backupOwner === account.user?.id;
  return <section className="card cloud-account-card">
    <div className="card-head"><div><span className="eyebrow">{t('TU HISTORIA, CONTIGO')}</span><h2>{t('Cuenta y respaldo')}</h2></div><span className="soft-icon"><Cloud size={22} /></span></div>
    {demo ? <p className="notice">{t('Estás en la demo. Sal de ella para usar tu cuenta y respaldar tus registros reales.')}</p> : account.user ? <>
      <div className="cloud-profile"><span className="cloud-avatar"><UserRound size={24} /></span><div><strong>{account.user.username}</strong><span>{account.user.email}</span></div><button type="button" className="icon-button" onClick={() => setDialog('edit')} aria-label={t('Editar cuenta')}><Pencil size={16} /></button></div>
      <details className="cloud-identity"><summary>{t('ID de tu cuenta')}</summary><code>{account.user.id}</code></details>
      <p className="muted">{t('El respaldo es manual. Tú decides qué guardar y cuándo restaurarlo; iniciar sesión no mezcla tus registros.')}</p>
      <div className="cloud-action-grid"><button className="secondary-button" disabled={busy || !data.profile} onClick={() => openBackup('backup')}><CloudUpload size={18} /><span>{t('Respaldar ahora')}</span></button><button className="secondary-button" disabled={busy} onClick={() => openBackup('restore')}><CloudDownload size={18} /><span>{t('Restaurar respaldo')}</span></button></div>
      {!data.profile && <p className="footnote">{t('Completa tu perfil antes de crear un respaldo. Si ya tienes uno, puedes restaurarlo ahora.')}</p>}
      <div className="cloud-account-footer"><button className="text-link" disabled={busy} onClick={() => setDialog('logout')}><LogOut size={15} />{t('Cerrar sesión')}</button><button className="text-link cloud-delete-link" disabled={busy} onClick={() => { setDeleteConfirmation(''); setDialog('delete'); }}><Trash2 size={14} />{t('Eliminar cuenta')}</button></div>
    </> : <><p className="muted">{t('Crea una cuenta con tu correo para guardar una copia de tus preferencias y registros.')}</p><button className="primary-button full-width" disabled={account.loading || CLOUD_NATIVE_UNAVAILABLE} onClick={() => setDialog('login')}><KeyRound size={17} />{t(account.loading ? 'Conectando…' : 'Crear cuenta o iniciar sesión')}</button>{account.unavailable && <div className="cloud-offline-status"><p>{t(cloudErrorMessage(new CloudError(CLOUD_NATIVE_UNAVAILABLE ? 'native_unconfigured' : 'unavailable')))}</p>{!CLOUD_NATIVE_UNAVAILABLE && <button className="text-link" onClick={() => void account.refresh()}><RefreshCw size={13} />{t('Volver a conectar')}</button>}</div>}</>}
    {message && !dialog && <p className="notice" role="alert">{message}</p>}
    {account.localDevelopment && <span className="cloud-environment"><span className="dot" />{t('Entorno local · todavía no se envía a AWS')}</span>}
    {dialog === 'login' && <Modal title={t('Tu espacio Pro')} onClose={() => setDialog(null)}><AccountAccess onDone={() => { setDialog(null); notify(t('Sesión iniciada. Tus datos locales no cambiaron.')); }} /></Modal>}
    {dialog === 'edit' && <EditAccount notify={notify} onClose={() => setDialog(null)} />}
    {(dialog === 'backup' || dialog === 'restore') && <Modal title={t(dialog === 'backup' ? 'Guardar mi historia' : 'Recuperar mi historia')} onClose={() => { if (!busy) setDialog(null); }}>
      <p className="cloud-modal-account">{t('Cuenta de destino')}<strong>{account.user?.email}</strong></p>
      <div className="cloud-backup-summary"><div><span>{t('En este dispositivo')}</span><strong>{data.records.length}</strong><small>{t('registros')}</small></div><ArrowRight size={18} className={dialog === 'restore' ? 'cloud-reverse' : ''} /><div><span>{t('En tu respaldo')}</span><strong>{backup ? backup.data?.records.length ?? 0 : '—'}</strong><small>{backupDate || t('Sin respaldo')}</small></div></div>
      <p className="notice">{t(dialog === 'backup' ? 'Esto reemplaza el respaldo de esta cuenta con los datos de este dispositivo. Los registros de otras cuentas no se modifican.' : 'Esto reemplaza los registros y preferencias de este dispositivo con el respaldo. No se combinarán los historiales.')}</p>
      {message && <p className="notice" role="alert">{message}</p>}
      {!busy && !backup && <button className="text-link" onClick={() => void run(loadBackup)}><RefreshCw size={15} />{t('Actualizar respaldo')}</button>}
      {dialog === 'restore' && backup && !backup.data && <p className="muted">{t('Esta cuenta todavía no tiene un respaldo.')}</p>}
      <button className="primary-button full-width" disabled={busy || !isOwner || (dialog === 'restore' && !backup?.data)} onClick={dialog === 'backup' ? confirmBackup : confirmRestore}>{busy && <LoaderCircle className="cloud-spinner" size={16} />}{t(busy ? 'Un momento…' : dialog === 'backup' ? 'Confirmar y respaldar' : 'Confirmar y restaurar')}</button>
      <button className="text-link centered" disabled={busy} onClick={() => setDialog(null)}>{t('Cancelar')}</button>
    </Modal>}
    {dialog === 'logout' && <Modal title={t('Cerrar sesión')} onClose={() => { if (!busy) setDialog(null); }}><p className="notice">{t('Los registros de este dispositivo permanecerán aquí. Si lo compartes, usa «Empezar de cero» después de salir para borrarlos del dispositivo.')}</p>{message && <p role="alert" className="notice">{message}</p>}<button className="primary-button full-width" disabled={busy} onClick={() => void run(async () => { if (!account.user) throw new CloudError('unauthorized'); await cloud.logout(account.user.id); account.setUser(null); setDialog(null); notify(t('Sesión cerrada.')); })}>{t(busy ? 'Un momento…' : 'Confirmar cierre de sesión')}</button></Modal>}
    {dialog === 'delete' && <Modal title={t('Eliminar cuenta y respaldo')} onClose={() => { if (!busy) setDialog(null); }}><p className="notice">{t('Se borrarán tu cuenta, sus preferencias y todos sus registros del servidor. No se puede deshacer. Los datos guardados en este dispositivo se conservan.')}</p><label className="field">{t('Escribe ELIMINAR para confirmar')}<input autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} /></label>{message && <p role="alert" className="notice">{message}</p>}<button className="danger-button full-width" disabled={busy || deleteConfirmation !== 'ELIMINAR'} onClick={() => void run(async () => { if (!account.user) throw new CloudError('unauthorized'); await cloud.deleteAccount(account.user.id); account.setUser(null); setDialog(null); notify(t('Cuenta y respaldo eliminados.')); })}>{t(busy ? 'Un momento…' : 'Eliminar mi cuenta')}</button><button className="text-link centered" disabled={busy} onClick={() => setDialog(null)}>{t('Cancelar')}</button></Modal>}
  </section>;
}
