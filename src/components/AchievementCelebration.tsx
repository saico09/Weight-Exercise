import { ArrowUpRight, Sparkles } from 'lucide-react';
import { ACHIEVEMENT_TIERS, TIER_LABELS, type Achievement } from '../lib/achievements';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import { TrophyMark } from './AchievementsPage';
import './achievements.css';

/** Multiple milestones earned by one save share one dismissible celebration. */
export function AchievementCelebration({ achievements, onClose, onViewAll }: { achievements: Achievement[]; onClose: () => void; onViewAll: () => void }) {
  const { t } = useI18n();
  if (!achievements.length) return null;
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
