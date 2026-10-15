import { useId, useState } from 'react';
import { ArrowUpRight, LockKeyhole, Orbit, Sprout } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './locked-pro-themes.css';

type PreviewStyle = 'aurora' | 'sand';
const styles = {
  aurora: { name: 'Aurora', tagline: 'smart modern', description: 'Nocturno. Fluido. Magnético.', title: 'Déjate llevar por Aurora.', heading: 'Cada paso cuenta', icon: Orbit, benefits: ['Ondas violetas que se mueven con calma.', 'Luces suaves dentro de tus tarjetas y un estilo moderno.'] },
  sand: { name: 'Sand', tagline: 'Tranquilidad', description: 'Cálido. Editorial. En equilibrio.', title: 'Encuentra tu calma con Sand.', heading: 'Ve a tu ritmo', icon: Sprout, benefits: ['Dunas y líneas de arena que se deslizan como el viento.', 'Tonos cálidos, tipografía editorial y un espacio sereno.'] },
} as const;

/** A decorative, bounded illustration: no Theme values, data access or settings writes. */
function ThemeSample({ style }: { style: PreviewStyle }) {
  const id = useId();
  const { t, locale } = useI18n();
  const info = styles[style];
  return <figure className="locked-theme-figure"><div className="locked-theme-scene" aria-hidden="true">
    <svg className="locked-theme-waves" viewBox="0 0 400 250" preserveAspectRatio="none" focusable="false">
      <defs><linearGradient id={`${id}-sample-wave`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".55" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <g className="locked-theme-wave-back"><path d={style === 'aurora' ? 'M-60 90C60 0 100 210 245 115S380 60 470 90V300H-60Z' : 'M-60 130C55 230 140 5 260 90S400 175 470 65V300H-60Z'} fill={`url(#${id}-sample-wave)`} /><path d={style === 'aurora' ? 'M-60 90C60 0 100 210 245 115S380 60 470 90' : 'M-60 130C55 230 140 5 260 90S400 175 470 65'} fill="none" stroke="currentColor" strokeWidth=".6" /></g>
      <g className="locked-theme-wave-front"><path d={style === 'aurora' ? 'M-60 190C60 110 150 100 245 180S380 215 470 135V300H-60Z' : 'M-60 220C45 100 120 170 235 150S360 110 470 190V300H-60Z'} fill={`url(#${id}-sample-wave)`} /></g>
      {style === 'sand' && <g className="locked-theme-wind" fill="none" stroke="currentColor" strokeWidth=".6"><path d="M-50 160C70 100 150 230 270 170S390 150 450 170M-50 167C70 107 150 237 270 177S390 157 450 177M-50 175C70 115 150 245 270 185S390 165 450 185M-50 184C70 124 150 254 270 194S390 174 450 194" /></g>}
    </svg>
    <div className="locked-theme-sample-heading"><span>Weight&Exercise <small>PRO</small></span><strong>{t(info.heading)}</strong></div>
    <div className="locked-theme-sample-card"><span>{t('Tu evolución')}</span><strong>{new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(79.8)}<small> kg</small></strong><svg viewBox="0 0 250 62" fill="none" focusable="false"><path className="locked-theme-sample-grid" d="M0 15H250M0 44H250" /><path d="M0 5L26 13L52 9L78 29L104 25L130 36L156 31L182 46L208 41L250 56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="250" cy="56" r="3" fill="currentColor" /></svg><div><span>{t('Pequeños avances, cada día.')}</span><info.icon size={15} /></div></div>
  </div><figcaption>{t('Una muestra de {theme}. Tu estilo actual no cambia.', { theme: info.name })}</figcaption></figure>;
}

/** Basic only advertises these styles. It cannot select or apply a Pro theme. */
export default function LockedProThemes() {
  const { t } = useI18n();
  const [preview, setPreview] = useState<PreviewStyle | null>(null);
  const active = preview ? styles[preview] : null;
  return <>{(['aurora', 'sand'] as const).map(style => {
    const info = styles[style], Icon = info.icon;
    return <button type="button" key={style} className={`settings-theme locked-theme-option locked-theme-option-${style}`} aria-haspopup="dialog" aria-label={t('{theme}. Exclusivo de Pro. Ver vista previa.', { theme: info.name })} onClick={() => setPreview(style)}>
      <div className="theme-mini"><div className="mini-line" /><small className="locked-theme-pro"><LockKeyhole size={9} />PRO</small><span>{t(info.tagline)}</span>{style === 'sand' && <small className="locked-theme-vibe">quiet vibes</small>}<div className="mini-chart"><svg viewBox="0 0 160 44" aria-hidden="true"><path d="M0 3 18 11 35 8 52 20 70 17 87 29 104 26 122 34 140 32 160 42" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg></div></div>
      <div className="settings-theme-label"><span><Icon size={16} />{info.name}</span><i><LockKeyhole size={11} /></i></div><span className="theme-description">{t(info.description)}</span>
    </button>;
  })}{preview && active && <Modal title={t(active.title)} subtitle={t('EXCLUSIVO DE WEIGHT&EXERCISE PRO')} onClose={() => setPreview(null)}><div className="locked-theme-preview" data-preview-style={preview}><ThemeSample style={preview} /><ul>{active.benefits.map(benefit => <li key={benefit}><ArrowUpRight size={15} /><span>{t(benefit)}</span></li>)}</ul><p className="locked-theme-note">{t('Este estilo está disponible en Weight&Exercise Pro, la app independiente de pago.')}</p><div className="locked-theme-coming"><LockKeyhole size={14} /><span>{t('Próximamente en Google Play')}</span></div><button type="button" className="secondary-button full-width locked-theme-dismiss" onClick={() => setPreview(null)}>{t('Seguir con Basic')}</button></div></Modal>}</>;
}
