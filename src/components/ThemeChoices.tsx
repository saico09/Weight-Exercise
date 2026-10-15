import { Check, Moon, Orbit, Sun, Sprout } from 'lucide-react';
import type { Theme } from '../lib/model';
import { availableThemes, themeInfo } from '../lib/themes';
import { IS_PRO } from '../lib/edition';
import { useI18n } from '../lib/i18n';
import './themes.css';

const icons = { dark: Moon, light: Sun, aurora: Orbit, sand: Sprout };
export default function ThemeChoices({ value, onChange, extrasOnly = false }: { value: Theme | null; onChange: (theme: Theme) => void; extrasOnly?: boolean }) {
  const { t } = useI18n();
  return <div className={`settings-themes ${extrasOnly ? 'extra-theme-choices' : ''}`} role="group" aria-label={t('Tu estilo')}>
    {availableThemes(IS_PRO).filter(theme => !extrasOnly || theme === 'aurora' || theme === 'sand').map(theme => {
      const info = themeInfo[theme], Icon = icons[theme];
      return <button type="button" key={theme} className={`settings-theme ${theme} ${value === theme ? 'selected' : ''}`} onClick={() => onChange(theme)} aria-pressed={value === theme}>
        <div className="theme-mini"><div className="mini-line" /><span>{t(info.tagline)}</span><div className="mini-chart"><svg viewBox="0 0 160 44" aria-hidden="true"><path d="M0 3 18 11 35 8 52 20 70 17 87 29 104 26 122 34 140 32 160 42" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg></div></div>
        <div className="settings-theme-label"><span><Icon size={16} />{info.name}</span><i>{value === theme && <Check size={13} />}</i></div><span className="theme-description">{t(info.description)}</span>
      </button>;
    })}
  </div>;
}
