import { useId } from 'react';
import { Check, LockKeyhole, Trophy } from 'lucide-react';
import type { AppData } from '../lib/model';
import { getRewardThemes, type RewardTheme } from '../lib/rewardThemes';
import { useI18n } from '../lib/i18n';
import './reward-themes.css';

export default function RewardThemes({ data, onSelect }: { data: AppData; onSelect: (theme: RewardTheme) => void }) {
  const { t } = useI18n();
  const titleId = useId();
  return <section className="reward-themes" aria-labelledby={titleId}>
    <div className="reward-themes-heading"><h3 id={titleId}>{t('Estilos que te ganas')}</h3><Trophy size={16} aria-hidden="true" /></div>
    <p>{t('Tus copas de Oro y Platino desbloquean un estilo especial para siempre.')}</p>
    <div className="reward-themes-grid">
      {getRewardThemes(data).map(reward => {
        const selected = data.settings.theme === reward.theme;
        const name = t(reward.theme === 'gold' ? 'Oro' : 'Platino');
        const status = reward.unlocked ? t(selected ? 'Tu estilo actual' : 'Elegir este estilo') : t('A {count} logros de desbloquearlo', { count: reward.remaining });
        return <button type="button" key={reward.theme} className={`reward-theme reward-theme-${reward.theme} ${selected ? 'selected' : ''}`} aria-disabled={!reward.unlocked} aria-pressed={selected} aria-label={`${name}. ${status}.`} onClick={() => { if (reward.unlocked) onSelect(reward.theme); }}>
          <span className="reward-theme-preview" aria-hidden="true"><span className="reward-metal-medal"><Trophy size={26} strokeWidth={1.4} /></span><span className="reward-theme-edition">{reward.theme === 'gold' ? 'GOLD EDITION' : 'PLATINUM EDITION'}</span><span className="reward-theme-preview-line" /></span>
          <span className="reward-theme-title"><strong>{name}</strong>{selected ? <Check size={15} /> : !reward.unlocked ? <LockKeyhole size={13} /> : <span className="reward-theme-ready" />}</span>
          <span className="reward-theme-status">{status}</span>
          {!reward.unlocked && <span className="reward-theme-progress" aria-hidden="true"><span style={{ transform: `scaleX(${reward.progress})` }} /></span>}
          <span className="reward-theme-count">{reward.unlocked ? t('Copa conseguida') : t('{earned} de {target} logros', { earned: reward.earned, target: reward.target })}</span>
        </button>;
      })}
    </div>
  </section>;
}
