import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import type { AppData } from '../lib/model';
import { getAchievements, getCupProgress, TIER_LABELS } from '../lib/achievements';
import { prepareProfilePhoto } from '../lib/profilePhoto';
import { useI18n } from '../lib/i18n';
import { TrophyMark } from './AchievementsPage';
import './profile-identity.css';

export function ProfileIdentity({ data, onProfile, onAchievements }: { data: AppData; onProfile: () => void; onAchievements: () => void }) {
  const { t } = useI18n();
  const cup = getCupProgress(getAchievements(data));
  return <div className="header-identity">
    <button className="profile-avatar" aria-label={t('Tu perfil: foto, altura, edad y meta')} onClick={onProfile}>
      {data.profile?.photo ? <img src={data.profile.photo} alt="" /> : <span>{t('TÚ')}</span>}
    </button>
    <button className="profile-cup" aria-label={cup.current ? t('Tu copa: {tier}. Ver logros', { tier: t(TIER_LABELS[cup.current.tier]) }) : t('Tu primera copa te espera. Ver logros')} onClick={onAchievements}>
      <TrophyMark tier={cup.current?.tier ?? null} size="small" />
    </button>
  </div>;
}

export function ProfilePhotoPicker({ value, onChange, onBusy }: { value: string | null; onChange: (photo: string | null) => void; onBusy: (busy: boolean) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { request.current += 1; }, []);
  return <div className="profile-photo-picker">
    <span className="profile-photo-preview">{value ? <img src={value} alt={t('Tu foto de perfil')} /> : <Camera size={25} />}</span>
    <div><strong>{t('Tu foto de perfil')}</strong><span>{t('Una foto que se sienta como tú.')}</span><div className="profile-photo-actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={15} />{t(busy ? 'Preparando foto…' : value ? 'Cambiar foto' : 'Elegir foto')}</button>
      {value && <button type="button" className="icon-button" disabled={busy} aria-label={t('Quitar foto de perfil')} onClick={() => onChange(null)}><X size={16} /></button>}
    </div></div>
    <input ref={input} className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('Elegir foto de perfil')} disabled={busy} onChange={async event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file) return;
      const id = ++request.current; setBusy(true); onBusy(true); setError('');
      try { const photo = await prepareProfilePhoto(file); if (id === request.current) onChange(photo); }
      catch (reason) { if (id === request.current) setError(reason instanceof Error ? reason.message : 'No pudimos preparar la foto. Inténtalo de nuevo.'); }
      finally { if (id === request.current) { setBusy(false); onBusy(false); } }
    }} />
    {error && <p className="error-message" role="alert">{t(error)}</p>}
  </div>;
}
