import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Heart, Pencil, RotateCcw } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { DEFAULT_MOTIVATION_IMAGE, defaultMotivation, normalizeMotivation, prepareMotivationImage, type MotivationPreferences } from '../lib/motivation';
import { Modal } from './UI';
import './motivation.css';

export default function Motivation({ value, onChange, compact = false }: { value: MotivationPreferences; onChange: (value: MotivationPreferences) => void; compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={`motivation-trigger ${compact ? 'compact' : ''}`} onClick={() => setOpen(true)}>
      <Heart size={16} /><span>{t('Necesito Motivación')}</span>
    </button>
    {open && <MotivationDialog value={value} onChange={onChange} onClose={() => setOpen(false)} />}
  </>;
}

function MotivationDialog({ value, onChange, onClose }: { value: MotivationPreferences; onChange: (value: MotivationPreferences) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = editing ? draft : value;
  const defaultMessage = current.message === 'Hazlo por él';
  return <Modal title={t(editing ? 'Tu motivo, a tu manera.' : 'Ese pequeño impulso.')} onClose={onClose}>
    <div className={`motivation-photo ${current.message.length > 80 ? 'long-message' : ''}`}><img src={current.image || DEFAULT_MOTIVATION_IMAGE} alt={t(current.image ? 'Tu imagen de motivación' : 'Un pequeño gatito')} /><div className="motivation-photo-shade" /><span className="motivation-heart"><Heart size={21} /></span><p>{defaultMessage ? t('Hazlo por él') : current.message}</p></div>
    {editing ? <div className="motivation-edit">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={t('Elegir mi foto de motivación')} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        setBusy(true); setError('');
        try { const image = await prepareMotivationImage(file); if (alive.current) setDraft(previous => ({ ...previous, image })); }
        catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'No pudimos preparar la foto. Inténtalo de nuevo.'); }
        finally { if (alive.current) setBusy(false); }
      }} />
      <div className="motivation-image-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => input.current?.click()}><Camera size={17} />{t(busy ? 'Preparando foto…' : 'Cambiar foto')}</button><button type="button" className="text-link" disabled={busy} onClick={() => { setDraft(defaultMotivation()); setError(''); }}><RotateCcw size={15} />{t('Volver al gatito')}</button></div>
      <label className="field">{t('Tu mensaje')}<textarea maxLength={180} rows={3} value={draft.message} onChange={event => setDraft(previous => ({ ...previous, message: event.target.value }))} /><small className="muted">{draft.message.length}/180</small></label>
      <p className="input-hint">{t('La foto se prepara en tu dispositivo, sin enviar el original.')}</p>
      {error && <p className="error-message" role="alert">{t(error)}</p>}
      <div className="motivation-edit-actions"><button type="button" className="secondary-button" onClick={() => { setEditing(false); setError(''); }} disabled={busy}>{t('Cancelar')}</button><button type="button" className="primary-button" disabled={busy || !draft.message.trim()} onClick={() => { onChange(normalizeMotivation(draft)); setEditing(false); }}><Check size={17} />{t('Guardar mi motivación')}</button></div>
    </div> : <div className="motivation-footer"><p>{t('Tu razón para volver a intentarlo. A tu ritmo.')}</p><button type="button" className="text-link" onClick={() => { setDraft(value); setEditing(true); }}><Pencil size={15} />{t('Personalizar mensaje y foto')}</button></div>}
  </Modal>;
}
