import { ProfileIdentity } from './components/ProfileIdentity';
import ProMigration from './components/ProMigration';
import { mergeBasicTransfer } from './lib/migration';
import { isRewardTheme, isRewardThemeUnlocked, unlockedRewardThemes, type RewardTheme } from './lib/rewardThemes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IonApp } from '@ionic/react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Activity, ArrowRight, BarChart3, Check, CircleHelp, House, List, Settings2, ShieldCheck, Trash2, Trophy, X } from 'lucide-react';
import type { AppData, DailyRecord, Profile, Settings } from './lib/model';
import { dateKey, defaultData, demoData } from './lib/model';
import { clearData, loadData, saveData } from './lib/storage';
import { cancelNotifications, configureRecap } from './lib/notifications';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import { BmiPage, HistoryPage, StatsPage } from './components/Insights';
import SettingsPage from './components/SettingsPage';
import { ProfileEditor, RecordEditor } from './components/Editors';
import { Brand, Modal, UnitSwitch } from './components/UI';
import { I18nProvider, translate } from './lib/i18n';
import { accentStyle } from './lib/accent';
import { isLightTheme, themeInfo } from './lib/themes';
import { mergeSteps, nativeSteps, readSteps, stepDates } from './lib/steps';
import { getAchievements, getNewlyEarnedAchievements, type Achievement } from './lib/achievements';
import AchievementsPage from './components/AchievementsPage';
import { AchievementCelebration } from './components/AchievementCelebration';

import { IS_PRO, EDITION } from './lib/edition';
import { CloudAccountProvider, CloudAccountPanel, ProWelcome } from './components/CloudAccount';
import { ProAccessGate, LicenseStatusPanel } from './components/ProAccessGate';
import { ThemeAtmosphere } from './components/ThemeAtmosphere';

type Page = 'home' | 'stats' | 'bmi' | 'history' | 'achievements' | 'settings';
// Existing milestones are visible immediately, but updates never replay old celebrations.
const acknowledgeExisting = (data: AppData): AppData => ({ ...data, settings: { ...data.settings, theme: isRewardTheme(data.settings.theme) && !isRewardThemeUnlocked(data, data.settings.theme) ? 'dark' : data.settings.theme }, celebratedAchievementIds: [...new Set([...data.celebratedAchievementIds, ...getAchievements(data).filter(item => item.earned).map(item => item.id)])] });
export default function App() {
  return IS_PRO ? <CloudAccountProvider><ProAccessGate><AppContent /></ProAccessGate></CloudAccountProvider> : <AppContent />;
}
function AppContent() {
  const [data, setData] = useState<AppData | null>(null);
  const language = data?.settings.language || 'es';
  const locale = language === 'en' ? 'en-US' : 'es-CL';
  const t = (source: string) => translate(source, language);
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [welcomePassed, setWelcomePassed] = useState(false);
  const [demo, setDemo] = useState(false);
  const settingsEpochRef = useRef(0);
  const settingsEpoch = settingsEpochRef.current;
  const beforeDemo = useRef<AppData | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [today, setToday] = useState(dateKey());
  const [recordEditor, setRecordEditor] = useState<{ record?: DailyRecord; daily: boolean; initialDate?: string } | null>(null);
  const [profileEditor, setProfileEditor] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [unlocked, setUnlocked] = useState<Achievement[]>([]);
  const [rewardUnlocked, setRewardUnlocked] = useState<RewardTheme[]>([]);
  const [dialogRevision, setDialogRevision] = useState(0);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const dataOperation = useRef(false);
  const [dataOperationBusy, setDataOperationBusy] = useState(false);
  const openMigration = useCallback((open: boolean) => {
    setMigrationOpen(open);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notify = useCallback((text: string) => setToast(text), []);
  useEffect(() => { let live = true; loadData().then(d => { if (live) setData(acknowledgeExisting(d)); }).catch(e => { if (live) setLoadError(e instanceof Error ? e.message : 'No pudimos leer tus datos.'); }); return () => { live = false; }; }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 5500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const refresh = () => setToday(dateKey()); const timer = setInterval(refresh, 30_000); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); }; }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { const closed = () => setDialogRevision(value => value + 1); document.addEventListener('close', closed, true); return () => document.removeEventListener('close', closed, true); }, []);
  const commit = useCallback((next: AppData) => { dataRef.current = next; setData(next); if (!demo) void saveData(next).then(() => setSaveError('')).catch(e => setSaveError(e instanceof Error ? e.message : 'No pudimos guardar tus cambios.')); }, [demo]);
  useEffect(() => { if (!data?.profile || demo || migrationOpen || recordEditor || profileEditor || resetConfirm || unlocked.length || document.querySelector('dialog[open]') || data.lastPromptDate === today || data.records.some(r => r.date === today)) return; setRecordEditor({ daily: true }); commit({ ...data, lastPromptDate: today }); }, [data, demo, today, commit, recordEditor, profileEditor, resetConfirm, unlocked, dialogRevision, migrationOpen]);
  useEffect(() => { const theme = data?.settings.theme || 'dark'; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeInfo[theme].background); document.documentElement.style.colorScheme = isLightTheme(theme) ? 'light' : 'dark'; }, [data?.settings.theme]);
  useEffect(() => { if (Capacitor.isNativePlatform()) void SystemBars.setStyle({ style: isLightTheme(data?.settings.theme || 'dark') ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => { /* Older Android versions retain the native default. */ }); }, [data?.settings.theme]);
  async function reset() { if (dataOperation.current) return; dataOperation.current = true; setDataOperationBusy(true); settingsEpochRef.current += 1; setResetBusy(true); try { if (demo) setData(acknowledgeExisting(demoData())); else { await cancelNotifications(); await clearData(); setData(defaultData()); } setWelcomePassed(false); setUnlocked([]); setLoadError(''); setSaveError(''); setResetConfirm(false); setPage('home'); setRecordEditor(null); setProfileEditor(false); notify(demo ? 'La demo volvió a su inicio.' : 'Listo. Puedes comenzar un nuevo camino.'); } catch (e) { notify(e instanceof Error ? e.message : 'No pudimos restablecer la app.'); } finally { setResetBusy(false); dataOperation.current = false; setDataOperationBusy(false); } }
  useEffect(() => { if (data && !demo) void configureRecap(data).catch(() => { /* Keep data usable when notification services are unavailable. */ }); }, [data?.records, data?.settings.recap, data?.settings.language, data?.settings.weightUnit, demo]);
  useEffect(() => {
    const refresh = () => { const current = dataRef.current; if (!demo && current && document.visibilityState === 'visible') void configureRecap(current).catch(() => undefined); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [demo]);
  const setSettings = (settings: Partial<Settings>) => { if (settingsEpoch !== settingsEpochRef.current) return; const latest = dataRef.current; if (latest && settings.theme && isRewardTheme(settings.theme) && !isRewardThemeUnlocked(latest, settings.theme)) return; if (latest) commit({ ...latest, settings: { ...latest.settings, ...settings } }); };
  const stepSyncBusy = useRef(false);
  useEffect(() => {
    if (!IS_PRO || demo || !data?.settings.steps.enabled || !nativeSteps()) return;
    let live = true, lastRead = 0;
    const sync = async () => {
      const current = dataRef.current;
      const epoch = settingsEpochRef.current;
      if (!live || dataOperation.current || stepSyncBusy.current || !current?.settings.steps.enabled || document.visibilityState !== 'visible' || Date.now() - lastRead < 60000) return;
      const dates = stepDates(current);
      if (!dates.length) return;
      stepSyncBusy.current = true; lastRead = Date.now();
      try {
        const days = await readSteps(dates);
        const latest = dataRef.current;
        if (!live || epoch !== settingsEpochRef.current || !latest?.settings.steps.enabled) return;
        const next = mergeSteps(latest, days);
        if (next !== latest) commit(next);
      } catch { /* Permission revocation or unavailable data must not invent zeros or discard records. */ }
      finally { stepSyncBusy.current = false; }
    };
    void sync();
    const refresh = () => { void sync(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { live = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [demo, data?.settings.steps.enabled, data?.records.map(record => `${record.id}:${record.date}`).join('|'), commit]);
  const startDemo = () => { settingsEpochRef.current += 1; beforeDemo.current = data; const next = acknowledgeExisting(demoData()); next.settings.theme = data?.settings.theme || 'dark'; next.settings.language = language; next.settings.accentColor = data?.settings.accentColor || null; setData(next); setDemo(true); setUnlocked([]); setPage('home'); };
  const endDemo = () => { settingsEpochRef.current += 1; setData(beforeDemo.current || defaultData()); setDemo(false); setUnlocked([]); setPage('home'); setRecordEditor(null); };
  const saveRecord = (record: DailyRecord, initial: boolean) => {
    const current = dataRef.current;
    if (!current) return;
    // A Health Connect refresh may finish while this editor is open.
    const freshRecord = current.records.find(entry => entry.id === record.id && entry.date === record.date);
    if (freshRecord?.steps !== undefined) record = { ...record, steps: freshRecord.steps, stepsSource: freshRecord.stepsSource, stepsSyncedAt: freshRecord.stepsSyncedAt };
    const isFirst = !current.records.length && !current.initialRecordId;
    const initialRecordId = initial || isFirst ? record.id : current.initialRecordId;
    const profile = initialRecordId === record.id && current.profile ? { ...current.profile, initialWeightKg: record.weightKg, initialDate: record.date } : current.profile;
    const next = { ...current, profile, records: [...current.records.filter(r => r.id !== record.id), record].sort((a, b) => a.date.localeCompare(b.date)), initialRecordId, lastPromptDate: record.date === today ? today : current.lastPromptDate };
    const earned = getNewlyEarnedAchievements(getAchievements(next), current.celebratedAchievementIds);
    next.celebratedAchievementIds = [...new Set([...current.celebratedAchievementIds, ...earned.map(item => item.id)])];
    const priorRewards = unlockedRewardThemes(current);
    setRewardUnlocked(unlockedRewardThemes(next).filter(theme => !priorRewards.includes(theme)));
    commit(next); setRecordEditor(null);
    if (earned.length) { setToast(''); setUnlocked(earned); }
    else notify(initial ? 'Tu nuevo punto de partida está listo.' : 'Guardado. Un día más que cuenta.');
  };
  const openDaily = () => setRecordEditor({ record: data?.records.find(r => r.date === today), daily: true });
  const importBasic = async (incoming: AppData, policy: 'keep-pro' | 'use-basic') => {
    const current = dataRef.current;
    if (demo || !current) throw new Error('No se pudo guardar la transferencia. Puedes volver a intentarlo.');
    if (dataOperation.current) throw new Error('Espera a que termine la operación actual e inténtalo de nuevo.');
    dataOperation.current = true; setDataOperationBusy(true);
    try {
    // Invalidate in-flight native step reads before the durable import write.
    settingsEpochRef.current += 1;
    const next = acknowledgeExisting(mergeBasicTransfer(current, incoming, policy));
    await saveData(next);
    dataRef.current = next; setData(next); setSaveError('');
    setRecordEditor(null); setProfileEditor(false); setUnlocked([]); setRewardUnlocked([]);
    setWelcomePassed(true); setPage('home');
    } finally { dataOperation.current = false; setDataOperationBusy(false); }
  };
  const restoreBackup = async (restored: AppData) => {
    if (demo) return;
    if (dataOperation.current) throw new Error('Espera a que termine la operación actual e inténtalo de nuevo.');
    dataOperation.current = true; setDataOperationBusy(true);
    try {
    settingsEpochRef.current += 1;
    const safe = acknowledgeExisting({ ...restored, settings: { ...restored.settings, steps: { enabled: false }, notifications: { ...restored.settings.notifications, enabled: false }, recap: { ...restored.settings.recap, enabled: false } } });
    await cancelNotifications();
    await saveData(safe);
    dataRef.current = safe; setData(safe); setRecordEditor(null); setProfileEditor(false); setUnlocked([]); setWelcomePassed(true); setPage('home');
    } finally { dataOperation.current = false; setDataOperationBusy(false); }
  };
  const nav = [{ key: 'home', label: 'Inicio', icon: House }, { key: 'stats', label: 'Estadísticas', icon: BarChart3 }, { key: 'bmi', label: 'Tu IMC', icon: Activity }, { key: 'history', label: 'Historial', icon: List }, { key: 'achievements', label: 'Logros', icon: Trophy }] as const;
  return <I18nProvider language={language}><IonApp data-theme={data?.settings.theme || 'dark'} data-custom-accent={!!data?.settings.accentColor} style={accentStyle(data?.settings.theme || 'dark', IS_PRO ? data?.settings.accentColor || null : null)}><div className="app-root">
    {IS_PRO && <ThemeAtmosphere theme={data?.settings.theme || 'dark'} />}
    {loadError ? <div className="loading-screen"><Brand /><h1>{t("Tu historia está a salvo.")}</h1><p className="notice" role="alert">{t(loadError)}</p><p>{t("No reemplazamos tus datos. Puedes volver a intentar abrirlos.")}</p><button className="primary-button" onClick={() => location.reload()}>{t("Volver a intentar")}</button><button className="danger-link" onClick={() => setResetConfirm(true)}>{t("Borrar datos y empezar de cero")}</button></div> : !data ? <div className="loading-screen"><Brand /><span className="loading-dot" /><p>{t("Un momento para ti…")}</p></div> : IS_PRO && !data.profile && !welcomePassed ? <ProWelcome onMigration={() => openMigration(true)} onLanguage={language => setSettings({ language })} data={data} onRestore={restoreBackup} notify={notify} onContinue={() => setWelcomePassed(true)} /> : !data.profile ? <Onboarding settings={data.settings} onTheme={theme => setSettings({ theme })} onAccentColor={accentColor => setSettings({ accentColor })} onLanguage={language => setSettings({ language })} onFinish={(profile: Profile, settings: Settings) => { commit({ ...data, profile, settings }); setPage('home'); }} onDemo={startDemo} /> : <>
      {demo && <div className="demo-banner"><span><CircleHelp size={14} /> {t("Estás en la demo · datos de ejemplo")}</span><button onClick={endDemo}>{t("Comenzar mi camino")} <ArrowRight size={14} /></button></div>}
      <div ref={scrollRef} className="app-scroll"><header className="app-header"><button className="brand-button" aria-label={t("Ir al inicio")} onClick={() => setPage('home')}><Brand /><span className="edition-badge">{EDITION}</span></button><div className="header-right"><span className="header-date">{new Date(`${today}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })}</span><UnitSwitch value={data.settings.weightUnit} onChange={weightUnit => setSettings({ weightUnit })} /><ProfileIdentity data={data} onProfile={() => setProfileEditor(true)} onAchievements={() => setPage('achievements')} /><button className={`header-settings icon-button ${page === 'settings' ? 'active' : ''}`} aria-label={t('Configuración')} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => setPage('settings')}><Settings2 size={20} /></button></div></header>
      {saveError && <div className="save-error" role="alert"><span>{t(saveError)} {t("Tus cambios siguen en pantalla.")}</span><button onClick={() => commit(data)}>{t("Reintentar guardado")}</button></div>}
      <main className="main-content" key={page}>{page === 'home' ? <Dashboard data={data} onChartStyle={chartStyle => setSettings({ chartStyle })} onGoalChartStyle={goalChartStyle => setSettings({ goalChartStyle })} onSettings={() => setPage('settings')} onMotivationChange={motivation => setSettings({ motivation })} onDaily={openDaily} onEditDay={date => setRecordEditor({ record: data.records.find(r => r.date === date), initialDate: date, daily: false })} onProfile={() => setProfileEditor(true)} onHistory={() => setPage('history')} /> : page === 'achievements' ? <AchievementsPage data={data} onRecord={openDaily} /> : page === 'settings' ? <>{IS_PRO && <LicenseStatusPanel />}{IS_PRO && <CloudAccountPanel data={data} onRestore={restoreBackup} notify={notify} demo={demo} />}<SettingsPage onMigration={() => openMigration(true)} data={data} demo={demo} onSettings={setSettings} onReset={() => setResetConfirm(true)} notify={notify} /></> : (() => { const props = { data, demo, onProfile: () => setProfileEditor(true), onAchievements: () => setPage('achievements'), onRecord: (record: DailyRecord) => setRecordEditor({ record, daily: false }), onNewRecord: () => setRecordEditor({ daily: false }), onHeightUnit: (heightUnit: Settings['heightUnit']) => setSettings({ heightUnit }) }; return page === 'stats' ? <StatsPage {...props} /> : page === 'bmi' ? <BmiPage {...props} /> : <HistoryPage {...props} />; })()}</main>
      <footer className="app-footer"><span><ShieldCheck size={13} /> {t(IS_PRO ? "GUARDADO LOCAL · RESPALDO OPCIONAL" : "SOLO EN TU DISPOSITIVO")}</span><span>{t("UN DÍA A LA VEZ.")}</span></footer></div>
      <nav className="bottom-nav" aria-label={t("Navegación principal")}>{nav.map(({ key, label, icon: Icon }) => <button key={key} aria-label={t(label)} aria-current={page === key ? 'page' : undefined} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><Icon size={21} strokeWidth={1.65} /><span className="nav-tooltip">{t(label)}</span><i /></button>)}</nav>
    </>}
    {data && !loadError && <ProMigration blocked={dataOperationBusy || resetBusy || resetConfirm || !!recordEditor || profileEditor || unlocked.length > 0} data={data} demo={demo} open={migrationOpen} onOpenChange={openMigration} onImport={importBasic} />}
    {data?.profile && recordEditor && <RecordEditor onMotivationChange={motivation => setSettings({ motivation })} key={recordEditor.record?.id || `new-${recordEditor.daily}`} data={data} record={recordEditor.record} daily={recordEditor.daily} initialDate={recordEditor.initialDate} onClose={() => setRecordEditor(null)} onSave={saveRecord} onDelete={id => { const latest = dataRef.current; if (!latest) return; commit({ ...latest, records: latest.records.filter(r => r.id !== id), initialRecordId: latest.initialRecordId === id ? null : latest.initialRecordId }); setRecordEditor(null); notify('Registro eliminado.'); }} />}
    {data?.profile && profileEditor && <ProfileEditor data={data} onClose={() => setProfileEditor(false)} onSave={profile => { const latest = dataRef.current; if (!latest) return; commit({ ...latest, profile }); setProfileEditor(false); notify('Tu perfil está actualizado.'); }} />}
    {unlocked.length > 0 && !recordEditor && !profileEditor && !resetConfirm && <AchievementCelebration rewardThemes={rewardUnlocked} onViewThemes={() => { setUnlocked([]); setRewardUnlocked([]); setPage('settings'); }} achievements={unlocked} onClose={() => setUnlocked([])} onViewAll={() => { setUnlocked([]); setPage('achievements'); }} />}
    {resetConfirm && <Modal title={t(demo ? '¿Reiniciar la demo?' : '¿Empezar de cero?')} subtitle={t(demo ? 'Los datos de ejemplo volverán a su estado original.' : IS_PRO ? 'Esto borra los datos y ajustes de este dispositivo. El respaldo de tu cuenta se administra por separado en Cuenta y respaldo.' : 'Esto elimina todos tus registros, tu perfil, tus preferencias y tus recordatorios. No se puede deshacer.')} onClose={() => { if (!resetBusy) setResetConfirm(false); }}><div className="reset-illustration"><Trash2 size={32} /></div><button className="danger-button full-width" disabled={resetBusy} onClick={() => void reset()}>{t(resetBusy ? 'Borrando…' : demo ? 'Reiniciar demo' : 'Sí, borrar todos mis datos')}</button><button className="secondary-button full-width" disabled={resetBusy} onClick={() => setResetConfirm(false)}>{t("Volver")}</button></Modal>}
    {toast && <div className="toast" role="status"><Check size={17} /><span>{t(toast)}</span><button aria-label={t("Cerrar aviso")} onClick={() => setToast('')}><X size={16} /></button></div>}
  </div></IonApp></I18nProvider>;
}
