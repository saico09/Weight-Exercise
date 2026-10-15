import { useId, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Check, Dumbbell, Flame, Leaf, LockKeyhole, Sparkles } from 'lucide-react';
import type { AppData } from '../lib/model';
import {
  CUP_LEVELS, FAMILY_DESCRIPTIONS, FAMILY_LABELS, TIER_LABELS,
  getAchievements, getCupProgress, type Achievement, type AchievementFamily, type AchievementTier,
} from '../lib/achievements';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './achievements.css';

const FAMILY_ICONS = { records: BookOpen, streak: Flame, exercise: Dumbbell, healthy: Leaf, balance: Sparkles, weeks: CalendarDays };
const FAMILIES = Object.keys(FAMILY_LABELS) as AchievementFamily[];

/** One cup silhouette with real metal treatments shared by the gallery and unlock dialog. */
export function TrophyMark({ tier, size = 'normal' }: { tier: AchievementTier | null; size?: 'small' | 'normal' | 'large' }) {
  const id = useId();
  return <span className={`achievement-trophy ${size} metal-${tier ?? 'locked'}`} aria-hidden="true">
    <svg viewBox="0 0 88 88">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--metal-shine)" /><stop offset=".45" stopColor="var(--metal)" /><stop offset="1" stopColor="var(--metal-shadow)" /></linearGradient>
        <linearGradient id={`${id}-stem`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="var(--metal-shadow)" /><stop offset=".5" stopColor="var(--metal-shine)" /><stop offset="1" stopColor="var(--metal)" /></linearGradient>
      </defs>
      <path d="M26 24H15v9c0 11 9 18 19 18M62 24h11v9c0 11-9 18-19 18" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="5" strokeLinecap="round" />
      <path d="M23 17h42l-4 25c-2 11-9 17-17 17s-15-6-17-17Z" fill={`url(#${id}-metal)`} />
      <path d="M28 21h4l3 20c1 7 3 10 5 12-6-3-9-7-10-14Z" fill="var(--metal-shine)" opacity=".65" />
      <path d="M40 57h8v12H40zM29 70h30l3 7H26Z" fill={`url(#${id}-stem)`} />
      <path d="m44 28 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9Z" fill="var(--metal-shadow)" opacity=".7" />
      <path d="M24 17h40" stroke="var(--metal-shine)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </span>;
}

function AchievementDetail({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const { t } = useI18n();
  const progress = Math.min(100, achievement.current / achievement.target * 100);
  return <Modal title={t(achievement.name)} onClose={onClose}>
    <div className={`achievement-detail metal-${achievement.tier}`}>
      <TrophyMark tier={achievement.tier} size="large" />
      <span className="achievement-metal-label">{t(TIER_LABELS[achievement.tier])} · {t(FAMILY_LABELS[achievement.family])}</span>
      <p>{t(achievement.description, { target: achievement.target })}</p>
      <div className="achievement-detail-progress"><strong>{Math.min(achievement.current, achievement.target)} <small>/ {achievement.target}</small></strong><span>{achievement.earned ? t('Conseguido') : t('En camino')}</span></div>
      <div className="achievement-progress" role="progressbar" aria-label={t(achievement.name)} aria-valuemin={0} aria-valuemax={achievement.target} aria-valuenow={Math.min(achievement.current, achievement.target)}><i style={{ width: `${progress}%` }} /></div>
      <p className="achievement-detail-note">{t(FAMILY_DESCRIPTIONS[achievement.family])}</p>
    </div>
  </Modal>;
}

function AchievementCard({ achievement, onSelect }: { achievement: Achievement; onSelect: () => void }) {
  const { t } = useI18n();
  const FamilyIcon = FAMILY_ICONS[achievement.family];
  const current = Math.min(achievement.current, achievement.target);
  return <button className={`achievement-badge metal-${achievement.tier} ${achievement.earned ? 'earned' : 'pending'}`} onClick={onSelect}
    aria-label={`${t(achievement.name)} · ${t(TIER_LABELS[achievement.tier])} · ${current}/${achievement.target} · ${achievement.earned ? t('Conseguido') : t('En camino')}`}>
    <span className="achievement-badge-top"><FamilyIcon size={13} /><span>{achievement.earned ? <Check size={13} /> : <LockKeyhole size={12} />}</span></span>
    <TrophyMark tier={achievement.tier} />
    <span className="achievement-metal-label">{t(TIER_LABELS[achievement.tier])}</span>
    <strong>{t(achievement.name)}</strong>
    <span className="achievement-badge-count">{current} <span>/ {achievement.target}</span></span>
    <span className="achievement-progress"><i style={{ width: `${current / achievement.target * 100}%` }} /></span>
  </button>;
}

export function AchievementsPage({ data, onRecord }: { data: AppData; onRecord?: () => void }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'pending' | 'earned'>('all');
  const [selected, setSelected] = useState<Achievement | null>(null);
  const achievements = getAchievements(data);
  const cup = getCupProgress(achievements);
  const visible = achievements.filter(item => filter === 'all' || (filter === 'earned' ? item.earned : !item.earned));
  const ringLength = 2 * Math.PI * 81;

  return <div className="achievement-page">
    <div className="compact-section-heading"><h1 className="eyebrow">{t('Tus logros')}</h1><span className="achievement-total">{cup.earned} / {cup.total}</span></div>

    <section className="card achievement-hero" aria-labelledby="achievement-cup-title">
      <div className="achievement-overall-ring" role="img" aria-label={t('{earned} de {total} logros, {percentage} por ciento', { earned: cup.earned, total: cup.total, percentage: cup.percentage })}>
        <svg viewBox="0 0 190 190" aria-hidden="true"><circle cx="95" cy="95" r="81" fill="none" stroke="var(--track)" strokeWidth="5" /><circle cx="95" cy="95" r="81" fill="none" stroke="var(--accent-ink)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${ringLength}`} strokeDashoffset={ringLength * (1 - cup.percentage / 100)} transform="rotate(-90 95 95)" /></svg>
        <div><TrophyMark tier={cup.current?.tier ?? null} size="large" /><strong>{cup.percentage}<small>%</small></strong><span>{t('de tu colección')}</span></div>
      </div>
      <div className="achievement-hero-copy">
        <span className="eyebrow">{t('TU VITRINA')}</span>
        <h2 id="achievement-cup-title">{cup.current ? t('Copa de {tier}', { tier: t(TIER_LABELS[cup.current.tier]) }) : t('Tu primera copa te espera')}</h2>
        <p>{cup.next ? t(cup.remaining === 1 ? 'A un logro de tu copa de {tier}.' : 'A {count} logros de tu copa de {tier}.', { count: cup.remaining, tier: t(TIER_LABELS[cup.next.tier]) }) : t('La colección completa. Cada copa cuenta tu historia.')}</p>
        <div className="achievement-cup-path" aria-label={t('Progresión de copas')}>
          {CUP_LEVELS.map(level => <div key={level.tier} className={`${cup.earned >= level.target ? 'reached' : ''} ${cup.current?.tier === level.tier ? 'current' : ''}`}>
            <span className={`achievement-cup-step metal-${level.tier}`}><TrophyMark tier={level.tier} size="small" />{cup.earned >= level.target && <i><Check size={8} /></i>}</span>
            <strong>{t(TIER_LABELS[level.tier])}</strong><small>{level.target}</small>
          </div>)}
        </div>
        <span className="achievement-lifetime-note">{t('Todo tu historial suma, sin importar tu registro inicial.')}</span>
      </div>
    </section>

    <div className="achievement-gallery-heading"><h2>{t('Pequeñas victorias')}</h2><div className="segmented" role="group" aria-label={t('Filtrar logros')}>
      {([['all', 'Todos'], ['pending', 'En camino'], ['earned', 'Conseguidos']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(label)}</button>)}
    </div></div>

    {!visible.length && <div className="card achievement-empty"><TrophyMark tier={cup.current?.tier ?? null} /><h3>{filter === 'earned' ? t('Todo comienza con un registro') : t('¡Colección completa!')}</h3><p>{filter === 'earned' ? t('Tus primeras copas están más cerca de lo que crees.') : t('Sigue cuidándote a tu ritmo.')}</p>{!cup.earned && onRecord && <button className="primary-button" onClick={onRecord}>{t('Registrar mi día')}<ArrowUpRight size={16} /></button>}</div>}

    {FAMILIES.map(family => {
      const familyAchievements = visible.filter(item => item.family === family);
      if (!familyAchievements.length) return null;
      const FamilyIcon = FAMILY_ICONS[family];
      return <section className="achievement-family" key={family} aria-labelledby={`achievement-family-${family}`}>
        <div className="achievement-family-heading"><h3 id={`achievement-family-${family}`}><FamilyIcon size={16} />{t(FAMILY_LABELS[family])}</h3><span>{achievements.filter(item => item.family === family && item.earned).length} / 5</span></div>
        <div className="achievement-badge-grid">{familyAchievements.map(achievement => <AchievementCard key={achievement.id} achievement={achievement} onSelect={() => setSelected(achievement)} />)}</div>
      </section>;
    })}
    {selected && <AchievementDetail achievement={selected} onClose={() => setSelected(null)} />}
  </div>;
}

export default AchievementsPage;
