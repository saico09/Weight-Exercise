import { useId } from 'react';
import type { AchievementTier } from '../lib/achievements';
import './achievements.css';

/** One cup silhouette with real metal treatments shared by the gallery and unlock dialog. */
export function TrophyMark({ tier, size = 'normal' }: { tier: AchievementTier | null; size?: 'small' | 'normal' | 'large' }) {
  const id = useId();
  const precious = tier === 'gold' || tier === 'platinum';
  const bowl = tier === 'platinum' ? 'M23 20h42l-5 25-8 11H36l-8-11Z' : 'M23 17h42l-4 25c-2 11-9 17-17 17s-15-6-17-17Z';
  return <span className={`achievement-trophy ${size} metal-${tier ?? 'locked'}`} aria-hidden="true">
    <svg viewBox="0 0 88 88">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2=".65">{precious ? <><stop stopColor="var(--metal-shadow)" /><stop offset=".18" stopColor="var(--metal)" /><stop offset=".36" stopColor="var(--metal-shine)" /><stop offset=".43" stopColor="white" /><stop offset=".49" stopColor="var(--metal)" /><stop offset=".7" stopColor="var(--metal-shadow)" /><stop offset=".86" stopColor="var(--metal-shine)" /><stop offset="1" stopColor="var(--metal)" /></> : <><stop stopColor="var(--metal-shine)" /><stop offset=".45" stopColor="var(--metal)" /><stop offset="1" stopColor="var(--metal-shadow)" /></>}</linearGradient>
        <linearGradient id={`${id}-stem`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="var(--metal-shadow)" /><stop offset=".5" stopColor="var(--metal-shine)" /><stop offset="1" stopColor="var(--metal)" /></linearGradient>
        <linearGradient id={`${id}-sheen`}><stop stopColor="white" stopOpacity="0" /><stop offset=".5" stopColor="white" stopOpacity=".85" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
        <clipPath id={`${id}-clip`}><path d={bowl} /></clipPath>
      </defs>
      {tier === 'gold' && <g className="trophy-laurel" fill="var(--metal)" stroke="var(--metal-shine)" strokeWidth=".6"><path d="M20 57c-7-7-9-14-9-22M68 57c7-7 9-14 9-22" fill="none" /><path d="M17 53c-8 0-10-4-10-7 6 0 9 2 10 7ZM13 44c-7-2-8-6-7-9 5 2 7 5 7 9ZM17 48c0-6 3-9 6-10 1 5-1 8-6 10ZM71 53c8 0 10-4 10-7-6 0-9 2-10 7ZM75 44c7-2 8-6 7-9-5 2-7 5-7 9ZM71 48c0-6-3-9-6-10-1 5 1 8 6 10Z" /></g>}
      <path d="M26 24H15v9c0 11 9 18 19 18M62 24h11v9c0 11-9 18-19 18" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="5" strokeLinecap="round" />
      <path d={bowl} fill={`url(#${id}-metal)`} stroke={precious ? 'var(--metal-shine)' : 'none'} strokeWidth=".65" />
      {tier === 'platinum' ? <g><path d="m23 20 13 36 8-36 8 36 13-36M28 45h32M36 56h16" fill="none" stroke="white" strokeWidth=".7" opacity=".75" /><path d="m44 20 8 36 8-11Z" fill="var(--metal-shadow)" opacity=".26" /><path d="m23 17 2-9 10 6 9-9 9 9 10-6 2 9Z" fill={`url(#${id}-metal)`} stroke="var(--metal-shine)" strokeWidth=".8" /></g> : <path d="M28 21h4l3 20c1 7 3 10 5 12-6-3-9-7-10-14Z" fill="var(--metal-shine)" opacity=".65" />}
      {precious && <g clipPath={`url(#${id}-clip)`}><path className="trophy-metal-sheen" d="M-17 12H0L47 64H30Z" fill={`url(#${id}-sheen)`} /></g>}
      <path d="M40 57h8v12H40zM29 70h30l3 7H26Z" fill={`url(#${id}-stem)`} />
      {tier === 'platinum' ? <g><path d="m44 29 7 7-7 11-7-11Z" fill="#e7f5ff" stroke="#fff" strokeWidth="1" /><path d="m37 36 7-1 7 1-7 11Z" fill="#6e91be" /><path d="m44 29 0 18 7-11Z" fill="white" opacity=".8" /><path d="M27 79h34" stroke="var(--metal-shine)" strokeWidth="2" /></g> : <path d="m44 28 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9Z" fill="var(--metal-shadow)" stroke={tier === 'gold' ? 'var(--metal-shine)' : 'none'} strokeWidth=".8" opacity=".9" />}
      <path d={tier === 'platinum' ? 'M24 20h40' : 'M24 17h40'} stroke="var(--metal-shine)" strokeWidth="3" strokeLinecap="round" />
      {precious && <g className="trophy-glints" fill="white"><path d="m64 11 1.7 4.3L70 17l-4.3 1.7L64 23l-1.7-4.3L58 17l4.3-1.7Z" /><path d="m25 65 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" />{tier === 'platinum' && <path d="m15 15 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />}</g>}
    </svg>
  </span>;
}
