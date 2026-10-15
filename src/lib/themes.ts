import type { Theme } from './model';

export const themeInfo = {
  dark: { name: 'Dark', tagline: 'Beast mode', description: 'Intenso. Enfocado. Premium.', light: false, background: '#101411', surface: '#191e1a', text: '#f5f8f3', muted: '#8e9b91', accent: '#42ff85', ink: '#42ff85', headingFont: 'Barlow Condensed', bodyFont: 'DM Sans' },
  light: { name: 'Light', tagline: 'Minimalista', description: 'Ligero. Sereno. Muy tú.', light: true, background: '#edf5f5', surface: '#f5fafb', text: '#203b40', muted: '#6f858a', accent: '#91f8ff', ink: '#187d87', headingFont: 'Manrope', bodyFont: 'Manrope' },
  gold: { name: 'Oro', tagline: 'Tu constancia brilla', description: 'Dorado. Elegante. Ganado por ti.', light: false, background: '#19160f', surface: '#242017', text: '#fff5df', muted: '#b7a78b', accent: '#efd080', ink: '#efd080', headingFont: 'Barlow Condensed', bodyFont: 'DM Sans' },
  platinum: { name: 'Platino', tagline: 'Una historia extraordinaria', description: 'Plata. Precisión. Tu colección completa.', light: true, background: '#edf0f4', surface: '#fafbfd', text: '#293443', muted: '#657489', accent: '#becbdd', ink: '#526981', headingFont: 'Manrope', bodyFont: 'Manrope' },
} satisfies Record<Theme, { name: string; tagline: string; description: string; light: boolean; background: string; surface: string; text: string; muted: string; accent: string; ink: string; headingFont: string; bodyFont: string }>;

export const isLightTheme = (theme: Theme) => themeInfo[theme].light;
export type BaseTheme = 'dark' | 'light';
export const availableThemes = (): BaseTheme[] => ['dark', 'light'];
