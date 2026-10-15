import type { CSSProperties } from 'react';
import type { Theme } from './model';
import { themeInfo } from './themes';
export type AccentStyle = CSSProperties & Record<`--${string}`, string>;
/** Basic includes fixed standard and earned palettes. Custom colors belong to Pro. */
export function accentStyle(theme: Theme): AccentStyle {
  const palette = themeInfo[theme];
  const color = palette.accent.toUpperCase();
  const channels = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16)).join(', ');
  return {
    '--accent': color, '--accent-ink': palette.ink,
    '--accent-soft': `rgba(${channels}, ${palette.light ? .16 : .09})`,
    '--accent-contrast': '#101411', '--accent-glow': `rgba(${channels}, .16)`,
    '--accent-wash': `rgba(${channels}, .19)`,
    '--chart-accent': theme === 'light' ? '#38b6c5' : palette.ink,
    '--accent-dark-ink': '#42FF85', '--accent-light-ink': '#187D87',
  };
}
