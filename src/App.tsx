import { useCallback, useEffect, useRef, useState } from 'react';
import { IonApp } from '@ionic/react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Activity, ArrowRight, BarChart3, Check, CircleHelp, House, LayoutDashboard, List, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import type { AppData, DailyRecord, Profile, Settings } from './lib/model';
import { dateKey, defaultData, demoData } from './lib/model';
import { clearData, loadData, saveData } from './lib/storage';
import { cancelNotifications } from './lib/notifications';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import { BmiPage, HistoryPage, StatsPage } from './components/Insights';
import SettingsPage from './components/SettingsPage';
import { ProfileEditor, RecordEditor } from './components/Editors';
import { Brand, Modal, UnitSwitch } from './components/UI';

type Page = 'home' | 'stats' | 'bmi' | 'history' | 'settings';
export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [demo, setDemo] = useState(false);
  const settingsEpochRef = useRef(0);
  const settingsEpoch = settingsEpochRef.current;
  const beforeDemo = useRef<AppData | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [today, setToday] = useState(dateKey());
  const [recordEditor, setRecordEditor] = useState<{ record?: DailyRecord; daily: boolean } | null>(null);
  const [profileEditor, setProfileEditor] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [toast, setToast] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const notify = useCallback((text: string) => setToast(text), []);
  useEffect(() => { let live = true; loadData().then(d => { if (live) setData(d); }).catch(e => { if (live) setLoadError(e instanceof Error ? e.message : 'No pudimos leer tus datos.'); }); return () => { live = false; }; }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 5500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const refresh = () => setToday(dateKey()); const timer = setInterval(refresh, 30_000); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); }; }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);
  const commit = useCallback((next: AppData) => { dataRef.current = next; setData(next); if (!demo) void saveData(next).then(() => setSaveError('')).catch(e => setSaveError(e instanceof Error ? e.message : 'No pudimos guardar tus cambios.')); }, [demo]);
  useEffect(() => { if (!data?.profile || demo || recordEditor || profileEditor || resetConfirm || data.lastPromptDate === today || data.records.some(r => r.date === today)) return; setRecordEditor({ daily: true }); commit({ ...data, lastPromptDate: today }); }, [data, demo, today, commit, recordEditor, profileEditor, resetConfirm]);
  useEffect(() => { document.querySelector('meta[name="theme-color"]')?.setAttribute('content', data?.settings.theme === 'light' ? '#edf5f5' : '#101311'); document.documentElement.style.colorScheme = data?.settings.theme === 'light' ? 'light' : 'dark'; }, [data?.settings.theme]);
  useEffect(() => { if (Capacitor.isNativePlatform()) void SystemBars.setStyle({ style: data?.settings.theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => { /* Older Android versions retain the native default. */ }); }, [data?.settings.theme]);
  async function reset() { settingsEpochRef.current += 1; setResetBusy(true); try { if (demo) setData(demoData()); else { await cancelNotifications(); await clearData(); setData(defaultData()); } setLoadError(''); setSaveError(''); setResetConfirm(false); setPage('home'); setRecordEditor(null); setProfileEditor(false); notify(demo ? 'La demo volvió a su inicio.' : 'Listo. Puedes comenzar un nuevo camino.'); } catch (e) { notify(e instanceof Error ? e.message : 'No pudimos restablecer la app.'); } finally { setResetBusy(false); } }
  const setSettings = (settings: Partial<Settings>) => { if (settingsEpoch !== settingsEpochRef.current) return; const latest = dataRef.current; if (latest) commit({ ...latest, settings: { ...latest.settings, ...settings } }); };
  const startDemo = () => { settingsEpochRef.current += 1; beforeDemo.current = data; const next = demoData(); next.settings.theme = data?.settings.theme || 'dark'; setData(next); setDemo(true); setPage('home'); };
  const endDemo = () => { settingsEpochRef.current += 1; setData(beforeDemo.current || defaultData()); setDemo(false); setPage('home'); setRecordEditor(null); };
  const saveRecord = (record: DailyRecord, initial: boolean) => { if (!data) return; const isFirst = !data.records.length && !data.initialRecordId; const initialRecordId = initial || isFirst ? record.id : data.initialRecordId; const profile = initialRecordId === record.id && data.profile ? { ...data.profile, initialWeightKg: record.weightKg, initialDate: record.date } : data.profile; commit({ ...data, profile, records: [...data.records.filter(r => r.id !== record.id), record].sort((a, b) => a.date.localeCompare(b.date)), initialRecordId, lastPromptDate: record.date === today ? today : data.lastPromptDate }); setRecordEditor(null); notify(initial ? 'Tu nuevo punto de partida está listo.' : 'Guardado. Un día más que cuenta.'); };
  const openDaily = () => setRecordEditor({ record: data?.records.find(r => r.date === today), daily: true });
  const nav = [{ key: 'home', label: 'Inicio', icon: House }, { key: 'stats', label: 'Estadísticas', icon: BarChart3 }, { key: 'bmi', label: 'Tu IMC', icon: Activity }, { key: 'history', label: 'Historial', icon: List }, { key: 'settings', label: 'Configuración', icon: Settings2 }] as const;
  return <IonApp data-theme={data?.settings.theme || 'dark'}><div className="app-root">
    {loadError ? <div className="loading-screen"><Brand /><h1>Tu historia está a salvo.</h1><p className="notice" role="alert">{loadError}</p><p>No reemplazamos tus datos. Puedes volver a intentar abrirlos.</p><button className="primary-button" onClick={() => location.reload()}>Volver a intentar</button><button className="danger-link" onClick={() => setResetConfirm(true)}>Borrar datos y empezar de cero</button></div> : !data ? <div className="loading-screen"><Brand /><span className="loading-dot" /><p>Un momento para ti…</p></div> : !data.profile ? <Onboarding settings={data.settings} onTheme={theme => setSettings({ ...data.settings, theme })} onFinish={(profile: Profile, settings: Settings) => { commit({ ...data, profile, settings }); setPage('home'); }} onDemo={startDemo} /> : <>
      {demo && <div className="demo-banner"><span><CircleHelp size={14} /> Estás en la demo · datos de ejemplo</span><button onClick={endDemo}>Comenzar mi camino <ArrowRight size={14} /></button></div>}
      <div ref={scrollRef} className="app-scroll"><header className="app-header"><button className="brand-button" aria-label="Ir al inicio" onClick={() => setPage('home')}><Brand /></button><div className="header-center"><span className="header-divider" /><span>WEIGHT & EXERCISE</span></div><div className="header-right"><span className="header-date">{new Date(`${today}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'long' })}</span><UnitSwitch value={data.settings.weightUnit} onChange={weightUnit => setSettings({ ...data.settings, weightUnit })} /><button className="avatar-button" title="Tu perfil" aria-label="Editar altura, edad y meta" onClick={() => setProfileEditor(true)}><span>TÚ</span><i /></button></div></header>
      {saveError && <div className="save-error" role="alert"><span>{saveError} Tus cambios siguen en pantalla.</span><button onClick={() => commit(data)}>Reintentar guardado</button></div>}
      <main className="main-content" key={page}>{page === 'home' ? <Dashboard data={data} onDaily={openDaily} onProfile={() => setProfileEditor(true)} onHistory={() => setPage('history')} /> : page === 'settings' ? <SettingsPage data={data} demo={demo} onSettings={setSettings} onReset={() => setResetConfirm(true)} notify={notify} /> : (() => { const props = { data, onProfile: () => setProfileEditor(true), onRecord: (record: DailyRecord) => setRecordEditor({ record, daily: false }), onNewRecord: () => setRecordEditor({ daily: false }), onHeightUnit: (heightUnit: Settings['heightUnit']) => setSettings({ ...data.settings, heightUnit }) }; return page === 'stats' ? <StatsPage {...props} /> : page === 'bmi' ? <BmiPage {...props} /> : <HistoryPage {...props} />; })()}</main>
      <footer className="app-footer"><span><ShieldCheck size={13} /> SOLO EN TU DISPOSITIVO</span><span>UN DÍA A LA VEZ.</span></footer></div>
      <nav className="bottom-nav" aria-label="Navegación principal">{nav.map(({ key, label, icon: Icon }) => <button key={key} aria-label={label} aria-current={page === key ? 'page' : undefined} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><Icon size={21} strokeWidth={1.65} /><span className="nav-tooltip">{label}</span><i /></button>)}</nav>
    </>}
    {data?.profile && recordEditor && <RecordEditor key={recordEditor.record?.id || `new-${recordEditor.daily}`} data={data} record={recordEditor.record} daily={recordEditor.daily} onClose={() => setRecordEditor(null)} onSave={saveRecord} onDelete={id => { commit({ ...data, records: data.records.filter(r => r.id !== id) }); setRecordEditor(null); notify('Registro eliminado.'); }} />}
    {data?.profile && profileEditor && <ProfileEditor data={data} onClose={() => setProfileEditor(false)} onSave={profile => { commit({ ...data, profile }); setProfileEditor(false); notify('Tu perfil está actualizado.'); }} />}
    {resetConfirm && <Modal title={demo ? '¿Reiniciar la demo?' : '¿Empezar de cero?'} subtitle={demo ? 'Los datos de ejemplo volverán a su estado original.' : 'Esto elimina todos tus registros, tu perfil, tus preferencias y tus recordatorios. No se puede deshacer.'} onClose={() => { if (!resetBusy) setResetConfirm(false); }}><div className="reset-illustration"><Trash2 size={32} /></div><button className="danger-button full-width" disabled={resetBusy} onClick={() => void reset()}>{resetBusy ? 'Borrando…' : demo ? 'Reiniciar demo' : 'Sí, borrar todos mis datos'}</button><button className="secondary-button full-width" disabled={resetBusy} onClick={() => setResetConfirm(false)}>Volver</button></Modal>}
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button aria-label="Cerrar aviso" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div></IonApp>;
}
