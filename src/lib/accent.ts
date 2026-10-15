import type { CSSProperties } from 'react';
import type { Theme } from './model';
import { isLightTheme, themeInfo } from './themes';

export const accentPresets = [
  { name: 'Eléctrico', color: '#42FF85' },
  { name: 'Solar', color: '#F6D85C' },
  { name: 'Glaciar', color: '#91F8FF' },
  { name: 'Lavanda', color: '#BB9BFF' },
  { name: 'Coral', color: '#FF9D8F' },
] as const;

type RGB = [number, number, number];
export type AccentStyle = CSSProperties & Record<`--${string}`, string>;
const rgb = (hex: string): RGB => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)) as RGB;
const hex = (color: RGB) => `#${color.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
const luminance = (color: string) => rgb(color).map(channel => {
  const value = channel / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0);

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Preserve the selected hue, while making text legible on the theme's surfaces. */
function readableAccent(color: string, theme: Theme): string {
  const base = rgb(color);
  const light = isLightTheme(theme);
  const surfaces = theme === 'aurora' ? ['#12152a', '#1b203b', '#252b49'] : theme === 'sand' ? ['#f5efe5', '#fffaf2', '#ede3d6'] : !light ? ['#101411', '#191e1a', '#202721', '#1c251f'] : ['#edf5f5', '#f1f8f9', '#ffffff', '#e6f0f0'];
  const alpha = light ? .16 : .09;
  // Selected pills and rows add a translucent tint over the normal surface.
  // Checking both avoids contrast loss for custom mid-tone colors.
  const backgrounds = [...surfaces, ...surfaces.map(surface => hex(rgb(surface).map((channel, index) => channel * (1 - alpha) + base[index] * alpha) as RGB))];
  const readable = (candidate: string) => backgrounds.every(background => contrastRatio(candidate, background) >= 4.5);
  if (readable(color)) return color;
  const destination = light ? 0 : 255;
  // Test rounded output too, so channel rounding cannot drop below the threshold.
  for (let step = 1; step <= 255; step++) {
    const adjusted = hex(base.map(channel => channel + (destination - channel) * step / 255) as RGB);
    if (readable(adjusted)) return adjusted;
  }
  return light ? '#000000' : '#ffffff';
}

export function accentStyle(theme: Theme, selectedColor: string | null): AccentStyle {
  const custom = selectedColor !== null && /^#[0-9a-f]{6}$/i.test(selectedColor);
  const color = custom ? selectedColor.toUpperCase() : themeInfo[theme].accent.toUpperCase();
  const darkInk = readableAccent(custom ? color : '#42FF85', 'dark');
  const lightInk = readableAccent(custom ? color : '#91F8FF', 'light');
  const ink = custom ? readableAccent(color, theme) : themeInfo[theme].ink;
  const channels = rgb(color).join(', ');
  const buttonInk = contrastRatio(color, '#101411') >= 4.5 ? '#101411' : contrastRatio(color, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
  return {
    '--accent': color,
    '--accent-ink': ink,
    '--accent-soft': `rgba(${channels}, ${isLightTheme(theme) ? .16 : .09})`,
    '--accent-contrast': buttonInk,
    '--accent-glow': `rgba(${channels}, .16)`,
    '--accent-wash': `rgba(${channels}, .19)`,
    '--chart-accent': custom ? ink : theme === 'light' ? '#38b6c5' : ink,
    '--accent-dark-ink': darkInk,
    '--accent-light-ink': lightInk,
  };
}
