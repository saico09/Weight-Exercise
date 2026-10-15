import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, FileInput, Smartphone, ShieldCheck } from 'lucide-react';
import type { AppData } from '../lib/model';
import { MAX_BASIC_TRANSFER_BYTES, parseBasicTransfer, summarizeBasicTransfer } from '../lib/migration';
import { clearPendingTransfer, getPendingTransfer, listenForTransfer, nativeMigration, openBasicForTransfer } from '../lib/migrationNative';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './migration.css';

type Policy = 'keep-pro' | 'use-basic';
type Pending = { id: string; payload: string };

export function MigrationEntry({ onClick, disabled = false, compact = false }: { onClick: () => void; disabled?: boolean; compact?: boolean }) {
  const { t } = useI18n();
  return <button className={`migration-entry ${compact ? 'compact' : 'card'}`} disabled={disabled} onClick={onClick}>
    <span className="soft-icon"><Smartphone size={21} /></span><span><strong>{t('¿Vienes de Basic?')}</strong><span>{t('Importar desde Basic')}</span></span><ArrowRight size={18} />
  </button>;
}

/** Receives data privately, then waits for explicit confirmation before any storage write. */
export default function ProMigration({ data, demo, open, blocked, onOpenChange, onImport }: {
  data: AppData; demo: boolean; open: boolean; blocked: boolean; onOpenChange: (open: boolean) => void;
  onImport: (incoming: AppData, policy: Policy) => Promise<void>;
}) {
  const { t } = useI18n();
  const [incoming, setIncoming] = useState<AppData | null>(null);
  const [policy, setPolicy] = useState<Policy>('keep-pro');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  const [openingBasic, setOpeningBasic] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingId = useRef<string | null>(null);
  const suppressReceive = useRef(false);
  const fileRequest = useRef(0);
  const openChange = useRef(onOpenChange); openChange.current = onOpenChange;
  const blockedRef = useRef(blocked); blockedRef.current = blocked;
  const openRef = useRef(open); openRef.current = open;
  const native = nativeMigration();
  const receive = useCallback((pending: Pending | null) => {
    if (!pending || blockedRef.current || suppressReceive.current || pendingId.current || (!openRef.current && document.querySelector('dialog[open]'))) return;
    pendingId.current = pending.id;
    setError(''); setDone(false); setPolicy('keep-pro');
    try { setIncoming(parseBasicTransfer(pending.payload)); }
    catch (reason) { setIncoming(null); setError(reason instanceof Error ? reason.message : 'No pudimos leer la transferencia.'); }
    openChange.current(true);
  }, []);

  useEffect(() => {
    if (!native || demo || blocked) return;
    let live = true;
    const listener = listenForTransfer(pending => { if (live) receive(pending); });
    const refresh = () => { if (document.visibilityState === 'visible') void getPendingTransfer().then(pending => { if (live) receive(pending); }).catch(() => undefined); };
    void listener.then(() => getPendingTransfer()).then(pending => { if (live) receive(pending); }).catch(() => {
      // No changes are made if the native inbox is temporarily unavailable.
    });
    document.addEventListener('close', refresh, true);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { live = false; document.removeEventListener('close', refresh, true); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); void listener.then(handle => handle.remove()).catch(() => undefined); };
  }, [native, demo, blocked, receive]);
  useEffect(() => () => { fileRequest.current += 1; }, []);

  const close = async () => {
    if (busy) return;
    setBusy(true); suppressReceive.current = true; fileRequest.current += 1;
    try {
      if (pendingId.current) await clearPendingTransfer(pendingId.current);
      pendingId.current = null; setIncoming(null); setError(''); setDone(false); setPolicy('keep-pro'); onOpenChange(false);
    } catch { setError('No pudimos cerrar la transferencia. Inténtalo de nuevo.'); }
    finally { setBusy(false); suppressReceive.current = false; }
    if (native && !pendingId.current) void getPendingTransfer().then(receive).catch(() => undefined);
  };
  if (!open || demo) return null;
  const summary = incoming ? summarizeBasicTransfer(data, incoming) : null;
  return <Modal title={t(done ? 'Tu historia ya está en Pro' : 'De Basic a Pro')} subtitle={t(done ? 'Todo listo para seguir avanzando.' : 'Tu progreso viene contigo.')} onClose={() => { if (!busy && !openingBasic) void close(); }}>
    {done ? <div className="migration-success"><span className="soft-icon"><Check size={29} /></span><p>{t('La transferencia se guardó en este dispositivo. Los datos originales siguen en Basic.')}</p><p className="footnote">{t('El respaldo en la nube es opcional; puedes hacerlo después desde Cuenta y respaldo.')}</p><button className="primary-button full-width" disabled={busy} onClick={() => void close()}>{t('Ver mi progreso')}<ArrowRight size={17} /></button></div> : incoming && summary ? <>
      <div className="migration-summary" aria-label={t('Resumen de la transferencia')}>
        <div><strong>{summary.incomingRecords}</strong><span>{t('Registros recibidos')}</span></div><div><strong>{summary.newRecords}</strong><span>{t('Días nuevos')}</span></div><div><strong>{summary.conflicts}</strong><span>{t('Días con diferencias')}</span></div>
      </div>
      <p className="migration-copy">{t(data.profile ? 'Conservaremos tu perfil, tus preferencias y tu punto de partida de Pro. Se añadirán los días nuevos de Basic.' : 'Se importarán tu perfil, foto, registros, hábitos, preferencias y logros. Activa los recordatorios cuando quieras desde Ajustes.')}</p>
      {summary.identicalRecords > 0 && <p className="footnote">{t(summary.identicalRecords === 1 ? '1 registro ya coincide. No se duplicará.' : '{count} registros ya coinciden. No se duplicarán.', { count: summary.identicalRecords })}</p>}
      {summary.conflicts > 0 && <fieldset className="migration-conflicts"><legend>{t('Para los días con diferencias')}</legend>
        <label><input type="radio" name="migration-conflict" checked={policy === 'keep-pro'} disabled={busy} onChange={() => setPolicy('keep-pro')} /><span><strong>{t('Conservar los de Pro')}</strong><span>{t('La opción inicial. No reemplaza tus registros actuales.')}</span></span></label>
        <label><input type="radio" name="migration-conflict" checked={policy === 'use-basic'} disabled={busy} onChange={() => setPolicy('use-basic')} /><span><strong>{t('Usar los de Basic')}</strong><span>{t('Reemplaza peso, hábitos y notas en esos días. Conserva los pasos de Pro.')}</span></span></label>
      </fieldset>}
      <p className="migration-local"><ShieldCheck size={16} />{t('Transferencia local. Basic conserva sus datos.')}</p>
      <button className="primary-button full-width" disabled={busy} onClick={async () => {
        if (busy) return; setBusy(true); setError('');
        try { await onImport(incoming, policy); setDone(true); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la transferencia. Puedes volver a intentarlo.'); }
        finally { setBusy(false); }
      }}>{t(busy ? 'Guardando tu historia…' : 'Confirmar importación')}<ArrowRight size={17} /></button>
      <button className="text-link centered" disabled={busy} onClick={() => void close()}>{t('Cancelar transferencia')}</button>
    </> : <>
      <div className="migration-route" aria-hidden="true"><span>Basic</span><ArrowRight size={22} /><span>Pro</span></div>
      <p className="migration-copy">{t('Mantén Basic y Pro instaladas en el mismo teléfono. En Basic, abre Ajustes y toca Transferir a Pro. Aquí podrás revisar lo recibido antes de confirmar.')}</p>
      <p className="migration-local"><ShieldCheck size={16} />{t('No necesitas cuenta ni conexión a internet.')}</p>
      {native ? <button className="primary-button full-width" disabled={openingBasic || busy || !!pendingId.current} onClick={async () => {
        setOpeningBasic(true); setError('');
        try { await openBasicForTransfer(); }
        catch (reason) {
          const code = reason instanceof Error ? reason.message : '';
          setError(code.includes('MIGRATION_MISSING') ? 'Primero instala Basic en este teléfono.' : code.includes('MIGRATION_OUTDATED') ? 'Actualiza Basic para poder transferir tus datos.' : code.includes('MIGRATION_SIGNATURE') ? 'Las dos apps deben ser versiones oficiales compatibles del mismo desarrollador.' : 'No pudimos abrir Basic. Ábrela y entra en Ajustes para transferir tus datos.');
        } finally { setOpeningBasic(false); }
      }}><Smartphone size={17} />{t(openingBasic ? 'Abriendo Basic…' : 'Abrir Basic')}</button> : <>
        <p className="notice">{t('Vista previa en PC: descarga la transferencia desde Ajustes de Basic y elige ese archivo aquí. En Android, la transferencia abre Pro directamente.')}</p>
        <button className="secondary-button full-width" disabled={busy} onClick={() => fileInput.current?.click()}><FileInput size={18} />{t(busy ? 'Leyendo transferencia…' : 'Elegir archivo de Basic')}</button>
        <input ref={fileInput} className="migration-file" type="file" accept=".we-transfer,application/json" aria-label={t('Archivo de transferencia de Basic')} onChange={async event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
          const request = ++fileRequest.current; setBusy(true); setError('');
          try {
            if (file.size > MAX_BASIC_TRANSFER_BYTES) throw new Error('La transferencia supera el tamaño permitido.');
            const parsed = parseBasicTransfer(await file.text());
            if (request === fileRequest.current) { setIncoming(parsed); setPolicy('keep-pro'); setDone(false); }
          } catch (reason) { if (request === fileRequest.current) setError(reason instanceof Error ? reason.message : 'No pudimos leer la transferencia.'); }
          finally { if (request === fileRequest.current) setBusy(false); }
        }} />
      </>}
    </>}
    {error && <p className="notice error-message" role="alert">{t(error)}</p>}
  </Modal>;
}
