import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getAchievements } from '../lib/achievements';
import { defaultData, demoData } from '../lib/model';
import { I18nProvider } from '../lib/i18n';
import { AchievementCelebration } from './AchievementCelebration';
import { AchievementsPage } from './AchievementsPage';

const onClose = () => undefined;
const goldAchievement = { ...getAchievements(defaultData()).find(achievement => achievement.id === 'records-gold')!, earned: true };

describe('collection cup celebrations', () => {
  it('keeps a single gold family achievement separate from the global gold cup', () => {
    const html = renderToStaticMarkup(<AchievementCelebration achievements={[goldAchievement]} onClose={onClose} onViewAll={onClose} />);
    expect(html).toContain('¡Felicitaciones!');
    expect(html).toContain('¡Lo lograste!');
    expect(html).not.toContain('cup-unlock-celebration');
    expect(html).not.toContain('Nuevo estilo desbloqueado');
  });

  it('celebrates the global gold milestone and its unlocked style', () => {
    const html = renderToStaticMarkup(<AchievementCelebration achievements={[goldAchievement]} rewardThemes={['gold']} onClose={onClose} onViewAll={onClose} onViewThemes={onClose} />);
    expect(html).toContain('¡La copa de Oro es tuya!');
    expect(html).toContain('¡Felicitaciones por este gran logro!');
    expect(html).toContain('20 logros. Una gran historia.');
    expect(html).toContain('Estrenar mi estilo');
  });

  it('gives platinum precedence if one save unlocks both collection cups', () => {
    const html = renderToStaticMarkup(<AchievementCelebration achievements={[goldAchievement]} rewardThemes={['gold', 'platinum']} onClose={onClose} onViewAll={onClose} />);
    expect(html).toContain('¡La copa de Platino es tuya!');
    expect(html).toContain('Eres el auténtico pro');
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

  it('congratulates every achievement across all five tiers in one grouped dialog', () => {
    const achievements = getAchievements(demoData());
    expect(achievements.every(achievement => achievement.earned)).toBe(true);
    const html = renderToStaticMarkup(<AchievementCelebration achievements={achievements} onClose={onClose} onViewAll={onClose} />);
    expect(html.match(/<dialog\b/g)).toHaveLength(1);
    expect(html.match(/¡Lo lograste!/g)).toHaveLength(30);
    for (const achievement of achievements) expect(html).toContain(achievement.name);
    expect(html).toContain('30 nuevas victorias para tu colección.');
  });

  it('recognizes the completed cup collection without awarding it to a new user', () => {
    expect(renderToStaticMarkup(<AchievementsPage data={demoData()} />)).toContain('Eres el auténtico pro');
    expect(renderToStaticMarkup(<AchievementsPage data={defaultData()} />)).not.toContain('Eres el auténtico pro');
  });

  it('translates the platinum recognition and each congratulations message into English', () => {
    const html = renderToStaticMarkup(<I18nProvider language="en"><AchievementCelebration achievements={[goldAchievement]} rewardThemes={['platinum']} onClose={onClose} onViewAll={onClose} /></I18nProvider>);
    expect(html).toContain('You are the true pro');
    expect(html).toContain('Congratulations on this great achievement!');
    expect(html).toContain('You did it!');
    expect(html).not.toContain('Eres el auténtico pro');
  });
});
