import type { CSSProperties } from 'react';
import { ArrowUpRight, Check, Orbit, Sparkles, Sprout, Zap } from 'lucide-react';
import type { Theme } from '../lib/model';
import { useI18n } from '../lib/i18n';
import { themeInfo } from '../lib/themes';
import './theme-showcase.css';

const styles = [
  { theme: 'dark', badge: 'Beast mode', caption: 'Enfoque. Energía. Sin límites.', alt: 'Atleta entrenando con una mancuerna', Icon: Zap },
  { theme: 'light', badge: 'Minimalista', caption: 'Respira. Muévete. Fluye.', alt: 'Una pausa tranquila frente al mar', Icon: Sparkles },
  { theme: 'aurora', badge: 'smart modern', caption: 'Tu energía, en sintonía.', alt: 'Corredora de perfil con ropa deportiva negra', Icon: Orbit },
  { theme: 'sand', badge: 'quiet vibes', caption: 'Tranquilidad', alt: 'Una pausa de meditación bajo la luz cálida del sol', Icon: Sprout },
] as const;

export default function ThemeShowcase({ value, onChange }: { value: Theme | null; onChange: (theme: Theme) => void }) {
  const { t } = useI18n();
  return <div className="theme-showcase" role="group" aria-label={t('Tu estilo')}>
    {styles.map(({ theme, badge, caption, alt, Icon }, index) => <button
      key={theme}
      type="button"
      className={`theme-showcase-card showcase-${theme} ${value === theme ? 'is-selected' : ''}`}
      aria-label={t('Seleccionar {theme}', { theme: themeInfo[theme].name })}
      aria-pressed={value === theme}
      onClick={() => onChange(theme)}
      style={{ '--showcase-order': index } as CSSProperties}
    >
      <img className="showcase-photo" src={`/images/${theme}-fitness.jpg`} alt={t(alt)} decoding="async" />
      <span className="showcase-atmosphere" aria-hidden="true" />
      <span className="showcase-badge"><Icon size={12} aria-hidden="true" />{t(badge)}</span>
      <span className="showcase-content">
        <span className="showcase-title">{themeInfo[theme].name}<span className="showcase-select" aria-hidden="true">{value === theme ? <Check size={17} /> : <ArrowUpRight size={17} />}</span></span>
        <span className="showcase-caption">{t(caption)}</span>
        <span className="showcase-palette" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </button>)}
  </div>;
}
