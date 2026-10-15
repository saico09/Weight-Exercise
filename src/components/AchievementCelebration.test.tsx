import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getAchievements } from '../lib/achievements';
import { defaultData } from '../lib/model';
import { AchievementCelebration } from './AchievementCelebration';

const onClose = () => undefined;
const goldAchievement = { ...getAchievements(defaultData()).find(achievement => achievement.id === 'records-gold')!, earned: true };

describe('collection cup celebrations', () => {
  it('keeps a single gold family achievement separate from the global gold cup', () => {
    const html = renderToStaticMarkup(<AchievementCelebration achievements={[goldAchievement]} onClose={onClose} onViewAll={onClose} />);
    expect(html).toContain('¡Bien hecho!');
    expect(html).not.toContain('cup-unlock-celebration');
    expect(html).not.toContain('Nuevo estilo desbloqueado');
  });

  it('celebrates the global gold milestone and its unlocked style', () => {
    const html = renderToStaticMarkup(<AchievementCelebration achievements={[goldAchievement]} rewardThemes={['gold']} onClose={onClose} onViewAll={onClose} onViewThemes={onClose} />);
    expect(html).toContain('¡La copa de Oro es tuya!');
    expect(html).toContain('20 logros. Una gran historia.');
    expect(html).toContain('Estrenar mi estilo');
  });

  it('gives platinum precedence if one save unlocks both collection cups', () => {
    const html = renderToStaticMarkup(<AchievementCelebration achievements={[goldAchievement]} rewardThemes={['gold', 'platinum']} onClose={onClose} onViewAll={onClose} />);
    expect(html).toContain('¡La copa de Platino es tuya!');
    expect(html).toContain('30 logros. Una gran historia.');
    expect(html.match(/Nuevo estilo desbloqueado/g)).toHaveLength(2);
  });

  it('allows a replay without new achievements and labels the reward as already earned', () => {
    const html = renderToStaticMarkup(<AchievementCelebration achievements={[]} rewardThemes={['platinum']} replay onClose={onClose} onViewAll={onClose} />);
    expect(html).toContain('¡La copa de Platino es tuya!');
    expect(html).toContain('Tu estilo de recompensa');
    expect(html).not.toContain('Nuevo estilo desbloqueado');
    expect(html).not.toContain('Ver los logros de este momento');
    expect(renderToStaticMarkup(<AchievementCelebration achievements={[]} onClose={onClose} onViewAll={onClose} />)).toBe('');
  });
});
