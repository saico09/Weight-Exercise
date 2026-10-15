import type { RewardTheme } from '../lib/rewardThemes';
import { themeInfo } from '../lib/themes';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { ACHIEVEMENT_TIERS, CUP_LEVELS, TIER_LABELS, type Achievement } from '../lib/achievements';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import { TrophyMark } from './TrophyMark';
import './achievements.css';

/** Multiple milestones earned by one save share one dismissible celebration. */
export function AchievementCelebration({ achievements, onClose, onViewAll, rewardThemes = [], onViewThemes, replay = false }: { rewardThemes?: RewardTheme[]; onViewThemes?: () => void; achievements: Achievement[]; onClose: () => void; onViewAll: () => void; replay?: boolean }) {
  const { t } = useI18n();
  // A family achievement can be gold while the overall cup is still silver.
  // Only a newly unlocked reward from App's lifetime thresholds earns this scene.
  const specialCup = rewardThemes.includes('platinum') ? 'platinum' : rewardThemes.includes('gold') ? 'gold' : null;
  if (!achievements.length && !specialCup) return null;
  if (specialCup) {
    const target = CUP_LEVELS.find(level => level.tier === specialCup)!.target;
    return <Modal title={t('¡La copa de {tier} es tuya!', { tier: t(TIER_LABELS[specialCup]) })} onClose={onClose}>
      <div className={`achievement-celebration cup-unlock-celebration metal-${specialCup}`}>
        <div className="cup-unlock-art" aria-hidden="true">
          <div className="cup-unlock-rays" /><div className="cup-unlock-orbit" /><div className="cup-unlock-floor" />
          <div className="cup-unlock-particles">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--particle-angle': `${index * 30}deg`, '--particle-delay': `${(index % 4) * .18}s`, '--particle-distance': `${index % 2 ? 108 : 88}px` } as CSSProperties} />)}</div>
          <TrophyMark tier={specialCup} size="large" />
          <Sparkles className="cup-unlock-star first" size={23} /><Sparkles className="cup-unlock-star second" size={16} />
        </div>
        <span className="cup-unlock-rank">{t('COPA {tier}', { tier: t(TIER_LABELS[specialCup]) })}</span>
        <p className="cup-unlock-message">{t(specialCup === 'platinum' ? 'Cada paso te trajo hasta aquí. Tu colección está completa.' : 'Tu constancia merece brillar. Este momento es tuyo.')}</p>
        <span className="cup-unlock-count">{t('{count} logros. Una gran historia.', { count: target })}</span>
        <div className="cup-unlock-rewards">{rewardThemes.map(theme => <div key={theme} className={`cup-unlock-reward metal-${theme}`}><span className="cup-unlock-swatch"><Sparkles size={18} /></span><div><span>{t(replay ? 'Tu estilo de recompensa' : 'Nuevo estilo desbloqueado')}</span><strong>{t(themeInfo[theme].name)}</strong></div><span className="cup-unlock-earned">{t('Tuyo')}</span></div>)}</div>
        {!replay && achievements.length > 0 && <details className="cup-unlock-details"><summary>{t('Ver los logros de este momento')} <span>{achievements.length}</span></summary><div className="achievement-unlock-list">{achievements.map(achievement => <div key={achievement.id}><TrophyMark tier={achievement.tier} size="small" /><div><strong>{t(achievement.name)}</strong><span>{t(TIER_LABELS[achievement.tier])} · {t('Conseguido')}</span></div></div>)}</div></details>}
        {onViewThemes ? <button className="primary-button full-width" onClick={onViewThemes}>{t('Estrenar mi estilo')}<ArrowUpRight size={17} /></button> : <button className="primary-button full-width" onClick={onViewAll}>{t('Disfrutar mi colección')}<ArrowUpRight size={17} /></button>}
        <button className="text-link" onClick={onClose}>{t('Seguir con mi día')}</button>
      </div>
    </Modal>;
  }
  const highest = [...achievements].sort((a, b) => ACHIEVEMENT_TIERS.indexOf(b.tier) - ACHIEVEMENT_TIERS.indexOf(a.tier))[0];
  return <Modal title={t('¡Bien hecho!')} subtitle={achievements.length === 1 ? t('Una nueva victoria para tu colección.') : t('{count} nuevas victorias para tu colección.', { count: achievements.length })} onClose={onClose}>
    <div className="achievement-celebration">
      <div className="achievement-celebration-art"><i /><i /><i /><i /><TrophyMark tier={highest.tier} size="large" /><Sparkles size={19} /></div>
      <div className="achievement-unlock-list">{achievements.map(achievement => <div key={achievement.id} className={`metal-${achievement.tier}`}><TrophyMark tier={achievement.tier} size="small" /><div><strong>{t(achievement.name)}</strong><span>{t(TIER_LABELS[achievement.tier])} · {t('Conseguido')}</span></div></div>)}</div>
      <button className="primary-button full-width" onClick={onViewAll}>{t('Ver mis logros')}<ArrowUpRight size={17} /></button>
      <button className="text-link" onClick={onClose}>{t('Seguir con mi día')}</button>
    </div>
  </Modal>;
}
