import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Download, LoaderCircle, ShieldCheck, Smartphone } from 'lucide-react';
import type { AppData } from '../lib/model';
import { useI18n } from '../lib/i18n';
import { buildBasicTransfer } from '../lib/migration';
import { getMigrationStatus, nativeMigration, sendBasicTransfer } from '../lib/migrationNative';
import { Modal } from './UI';
import './migration.css';

type Availability = Awaited<ReturnType<typeof getMigrationStatus>>;

/** Basic can send a local copy; Pro owns validation, preview and import. */
export default function BasicMigration({ data, demo }: { data: AppData; demo: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const latest = useRef({ data, demo });
  latest.current = { data, demo };
  const request = useRef(0);
  const sending = useRef(false);
  const mounted = useRef(true);
  const native = nativeMigration();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current += 1; };
  }, []);

  const checkAvailability = async () => {
    const id = ++request.current;
    setChecking(true); setAvailability(null); setError('');
    try {
      const result = await getMigrationStatus();
      if (mounted.current && id === request.current) setAvailability(result);
    } catch {
      if (mounted.current && id === request.current) setError('No pudimos comprobar Pro. Vuelve a intentarlo.');
    } finally {
      if (mounted.current && id === request.current) setChecking(false);
    }
  };

  const close = () => {
    if (sending.current) return;
    request.current += 1;
    setOpen(false); setChecking(false);
  };

  const begin = () => {
    if (latest.current.demo || !latest.current.data.profile) return;
    setSent(false); setError(''); setOpen(true);
    if (native) void checkAvailability();
  };

  const transfer = async () => {
    if (sending.current || latest.current.demo || !latest.current.data.profile || (native && !availability?.available)) return;
    sending.current = true;
    setBusy(true); setError('');
    try {
      const payload = buildBasicTransfer(latest.current.data);
      if (native) await sendBasicTransfer(payload);
      else {
        const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'WeightExercise.we-transfer';
        document.body.appendChild(link); link.click(); link.remove();
        // Give the browser time to acquire the Blob before releasing it.
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
      if (mounted.current) setSent(true);
    } catch (cause) {
      const validationMessage = cause instanceof Error && [
        'Primero completa tu perfil en Basic.',
        'No pudimos preparar tus datos. Revisa los registros de Basic.',
        'La transferencia supera el límite de 4 MB.',
      ].includes(cause.message) ? cause.message : null;
      if (mounted.current) setError(validationMessage ?? (native
        ? 'No pudimos abrir la transferencia. Comprueba que ambas apps estén actualizadas e inténtalo de nuevo.'
        : 'No pudimos preparar el archivo. Vuelve a intentarlo.'));
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const unavailableMessage = availability?.reason === 'outdated'
    ? 'Actualiza Pro para recibir tu progreso. Mantén ambas apps instaladas en este teléfono.'
    : availability?.reason === 'signature'
      ? 'Las instalaciones de Basic y Pro no son compatibles. Instala ambas desde la misma fuente oficial para transferir con seguridad.'
      : 'Instala Weight&Exercise Pro en este mismo teléfono y vuelve aquí. Basic debe seguir instalada durante la transferencia.';

  return <>
    <section className="card migration-card">
      <div className="migration-card-heading"><span className="migration-symbol"><Smartphone size={21} /></span><div><span className="eyebrow">BASIC → PRO</span><h3>{t('Lleva tu progreso a Pro')}</h3></div></div>
      <p>{t('Tu historia sigue contigo. Copia tus datos directamente entre las dos apps.')}</p>
      <button type="button" className="secondary-button full-width" onClick={begin} disabled={demo || !data.profile}><span>{t('Transferir a Pro')}</span><ArrowRight size={16} /></button>
      {demo && <p className="migration-footnote">{t('La transferencia estará disponible con tus propios registros.')}</p>}
    </section>
    {open && <Modal title={t('Lleva tu progreso a Pro')} subtitle={t('Un nuevo espacio. La misma historia.')} onClose={close}>
      <div className="migration-route" aria-hidden="true"><span>Basic</span><ArrowRight size={20} /><strong>Pro</strong></div>
      {sent ? <div className="migration-success" role="status"><span className="migration-symbol"><Check size={23} /></span><h3>{t(native ? 'Pro se abrió.' : 'Transferencia preparada.')}</h3><p>{t(native
        ? 'Revisa y confirma allí la importación. Tus datos de Basic siguen intactos.'
        : 'Abre Pro en el navegador y elige «Importar desde Basic». Selecciona el archivo descargado y revisa los datos antes de confirmar.')}</p><button type="button" className="primary-button full-width" onClick={close}>{t('Entendido')}</button></div> : <>
        <p className="migration-intro">{t(native
          ? 'Mantén Basic y Pro instaladas en el mismo teléfono. Al continuar, Pro se abrirá para que revises y confirmes la copia.'
          : 'Descarga una copia de tus datos para abrirla en Pro. Allí podrás revisarla y confirmar la importación.')}</p>
        <div className="migration-summary"><strong>{t(data.records.length === 1 ? '1 registro para llevar contigo' : '{count} registros para llevar contigo', { count: data.records.length.toLocaleString(locale) })}</strong><span>{t('Perfil y foto · pesos y hábitos · logros y temas ganados · preferencias')}</span></div>
        <div className="migration-privacy"><ShieldCheck size={17} /><p>{t('La copia es local, sin cuenta ni internet. No borra ni cambia tus datos de Basic.')}</p></div>
        {!native && <p className="notice">{t('Estás en la vista del navegador: descarga un archivo de transferencia y selecciónalo en Pro. En Android, las apps se comunican directamente.')}</p>}
        {!native && <p className="migration-footnote">{t('El archivo contiene tus datos personales. Guárdalo en un lugar privado.')}</p>}
        {native && checking && <p className="migration-status" role="status"><LoaderCircle size={16} className="migration-spinner" />{t('Buscando Pro…')}</p>}
        {native && availability && !availability.available && <p className="notice" role="status">{t(unavailableMessage)}</p>}
        {error && <p className="error-message" role="alert">{t(error)}</p>}
        {native && !checking && !availability?.available && <button type="button" className="secondary-button full-width" disabled={busy} onClick={() => void checkAvailability()}>{t('Comprobar de nuevo')}</button>}
        <button type="button" className="primary-button full-width migration-confirm" disabled={busy || checking || (native && !availability?.available)} onClick={() => void transfer()}>{busy ? <LoaderCircle size={17} className="migration-spinner" /> : native ? <ArrowRight size={17} /> : <Download size={17} />}<span>{t(busy ? 'Preparando transferencia…' : native ? 'Copiar y abrir Pro' : 'Descargar transferencia')}</span></button>
      </>}
    </Modal>}
  </>;
}
