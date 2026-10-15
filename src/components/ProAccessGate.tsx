import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { IonApp } from '@ionic/react';
import { Download, LoaderCircle, ShieldCheck } from 'lucide-react';
import { AccountAccess, CloudAccountPanel, useCloudAccount } from './CloudAccount';
import { Brand } from './UI';
import { ThemeAtmosphere } from './ThemeAtmosphere';
import { activateProLicense, canAccessPro, getProLicenseStatus, LICENSE_CHANGED, type ProLicenseStatus } from '../lib/proLicense';
import { cloudErrorMessage, CloudError } from '../lib/cloud';
import { loadData } from '../lib/storage';
import { exportLocalData } from '../lib/localDataExport';
import { defaultData } from '../lib/model';
import { accentStyle } from '../lib/accent';
import { I18nProvider, useI18n } from '../lib/i18n';
import './pro-access.css';

type AccessContext = { status: ProLicenseStatus | null; busy: boolean; message: string; verify: () => Promise<void> };
const Access = createContext<AccessContext | null>(null);

/** The web preview/debug APK is intentionally separate from signed release access.
 * Native signature/expiry verification is repeated on foreground and while open. */
export function ProAccessGate({ children }: { children: ReactNode }) {
  const account = useCloudAccount();
  const [status, setStatus] = useState<ProLicenseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const accountRef = useRef(account.user?.id);
  accountRef.current = account.user?.id;
  const generation = useRef(0);
  const verifying = useRef(false);
  const refresh = useCallback(async () => {
    const revision = ++generation.current;
    try { const next = await getProLicenseStatus(); if (revision === generation.current) setStatus(next); }
    catch { if (revision === generation.current) setStatus({ mode: 'required', configured: false, valid: false, reason: 'verification_failed' }); }
  }, []);
  useEffect(() => {
    const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const timer = window.setInterval(resume, 60_000);
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    window.addEventListener(LICENSE_CHANGED, resume);
    return () => { generation.current++; clearInterval(timer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); window.removeEventListener(LICENSE_CHANGED, resume); };
  }, [refresh]);
  const verify = useCallback(async () => {
    const owner = accountRef.current;
    if (!owner || verifying.current) return;
    verifying.current = true; setBusy(true); setMessage('');
    try {
      await activateProLicense(owner, () => accountRef.current === owner);
      await refresh();
    } catch (error) {
      if (accountRef.current === owner) setMessage(error instanceof CloudError ? cloudErrorMessage(error) : cloudErrorMessage(new CloudError('license_invalid')));
    } finally { verifying.current = false; setBusy(false); }
  }, [refresh]);
  const access = { status, busy, message, verify };
  return <Access.Provider value={access}>{canAccessPro(status, account.user?.id || null) ? children : <LockedAccess />}</Access.Provider>;
}

function LockedAccess() {
  const [data, setData] = useState(defaultData);
  useEffect(() => { let live = true; void loadData().then(next => { if (live) setData(next); }).catch(() => undefined); return () => { live = false; }; }, []);
  return <I18nProvider language={data.settings.language}><IonApp data-theme={data.settings.theme} style={accentStyle(data.settings.theme, data.settings.accentColor)}><div className="app-root"><ThemeAtmosphere theme={data.settings.theme} /><main className="pro-access-page"><LockedContent data={data} /></main></div></IonApp></I18nProvider>;
}

function LockedContent({ data }: { data: ReturnType<typeof defaultData> }) {
  const { t } = useI18n();
  const account = useCloudAccount();
  const access = useContext(Access)!;
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const saveData = async () => { setExporting(true); setNotice(''); try { await exportLocalData(); } catch { setNotice(t('No pudimos exportar tus datos. Inténtalo nuevamente.')); } finally { setExporting(false); } };
  return <><Brand /><section className="card pro-access-card"><span className="soft-icon"><ShieldCheck size={30} /></span><span className="eyebrow">WEIGHT&EXERCISE PRO</span><h1>{t('Tu espacio Pro, protegido.')}</h1>
    {!access.status ? <p role="status"><LoaderCircle className="cloud-spinner" size={18} /> {t('Verificando acceso…')}</p> : <><p className="muted">{t('Entra con tu correo y verifica tu compra en Google Play para activar este dispositivo.')}</p>
      {account.user ? <><p className="pro-license-owner">{account.user.email}</p><button className="primary-button full-width" disabled={access.busy} onClick={() => void access.verify()}>{access.busy ? <LoaderCircle size={18} className="cloud-spinner" /> : <ShieldCheck size={18} />}{t(access.busy ? 'Verificando acceso…' : 'Verificar mi licencia')}</button></> : account.loading ? <p role="status">{t('Conectando…')}</p> : <AccountAccess />}
      {access.message && <p className="notice" role="alert">{t(access.message)}</p>}
      <p className="footnote">{t('La verificación requiere conexión. Después podrás usar Pro sin conexión hasta 7 días; tus registros siempre se conservan.')}</p>
      {!access.status.configured && !access.message && <p className="notice">{t('La activación de Pro aún no está configurada. Tus datos locales se conservan.')}</p>}
    </>}
    <button className="text-link pro-data-export" disabled={exporting} onClick={() => void saveData()}><Download size={16} />{t(exporting ? 'Un momento…' : 'Guardar mis datos')}</button>
    {notice && <p role="status" className="notice">{notice}</p>}
  </section>{account.user && <CloudAccountPanel data={data} restricted onRestore={() => {}} notify={setNotice} />}</>;
}

export function LicenseStatusPanel() {
  const access = useContext(Access);
  const { t, locale } = useI18n();
  const account = useCloudAccount();
  if (!access?.status) return null;
  const preview = access.status.mode === 'development';
  return <section className="pro-license-status"><ShieldCheck size={18} /><div><strong>{t(preview ? 'Vista previa de Pro' : 'Acceso Pro verificado')}</strong><p>{preview ? t('La licencia de Google Play se activará en la versión publicada.') : t('Sin conexión hasta {date}', { date: new Date(access.status.expiresAt!).toLocaleDateString(locale) })}</p>{access.message && <p role="alert">{t(access.message)}</p>}</div>{!preview && account.user && <button className="text-link" disabled={access.busy} onClick={() => void access.verify()}>{t(access.busy ? 'Verificando acceso…' : 'Renovar acceso')}</button>}</section>;
}
