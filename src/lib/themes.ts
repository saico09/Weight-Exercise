import type { Theme } from './model';

export const themeInfo = {
  dark: { name: 'Dark', tagline: 'Beast mode', description: 'Intenso. Enfocado. Premium.', light: false, background: '#101411', surface: '#191e1a', text: '#f5f8f3', muted: '#8e9b91', accent: '#42ff85', ink: '#42ff85', headingFont: 'Barlow Condensed', bodyFont: 'DM Sans' },
  light: { name: 'Light', tagline: 'Minimalista', description: 'Ligero. Sereno. Muy tú.', light: true, background: '#edf5f5', surface: '#f5fafb', text: '#203b40', muted: '#6f858a', accent: '#91f8ff', ink: '#187d87', headingFont: 'Manrope', bodyFont: 'Manrope' },
  aurora: { name: 'Aurora', tagline: 'smart modern', description: 'Nocturno. Fluido. Magnético.', light: false, background: '#12152a', surface: '#1b203b', text: '#eef0ff', muted: '#a0a9ca', accent: '#c4b5ff', ink: '#c4b5ff', headingFont: 'Space Grotesk', bodyFont: 'Space Grotesk' },
  sand: { name: 'Sand', tagline: 'Tranquilidad', description: 'Cálido. Editorial. En equilibrio.', light: true, background: '#f5efe5', surface: '#fffaf2', text: '#3a3028', muted: '#807063', accent: '#cc774f', ink: '#995032', headingFont: 'Fraunces', bodyFont: 'DM Sans' },
} satisfies Record<Theme, { name: string; tagline: string; description: string; light: boolean; background: string; surface: string; text: string; muted: string; accent: string; ink: string; headingFont: string; bodyFont: string }>;
export const isLightTheme = (theme: Theme) => themeInfo[theme].light;
export const availableThemes = (pro: boolean): Theme[] => pro ? ['dark', 'light', 'aurora', 'sand'] : ['dark', 'light'];
