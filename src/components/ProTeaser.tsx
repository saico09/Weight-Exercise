import { useState } from 'react';
import { ArrowUpRight, BellRing, Cloud, FileChartColumn, LockKeyhole, Palette, Sparkles } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './pro-teaser.css';

const previews = {
  reports: { icon: FileChartColumn, title: 'Tu progreso, en detalle', note: 'Informes PDF, Excel y análisis semanales.', benefits: ['Informes con tu estilo y tus colores', 'Comparación de registros y evolución semanal', 'Historial para descargar en Excel'] },
  style: { icon: Palette, title: 'Más formas de ser tú', note: 'Aurora, Sand y colores a tu medida.', benefits: ['Dos estilos exclusivos: Aurora y Sand', 'Ambientes con movimiento suave', 'Personaliza el color principal de tu espacio'] },
  recaps: { icon: BellRing, title: 'Avisos que cuentan tu historia', note: 'Recuentos semanales o mensuales de tu progreso.', benefits: ['Compara tus registros a lo largo del tiempo', 'Elige recuentos semanales o mensuales', 'Recibe un resumen de tus hábitos'] },
  connected: { icon: Cloud, title: 'Tu camino, más conectado', note: 'Respaldo con cuenta y pasos desde Health Connect.', benefits: ['Cuenta personal y respaldo opcional', 'Pasos de Health Connect junto a tu registro diario', 'Una meta de pasos que puedes adaptar'] },
} as const;

/** This is a description of a separate app, not a disabled implementation or an entitlement switch. */
export default function ProTeaser({ feature, compact = false }: { feature: keyof typeof previews; compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { icon: Icon, title, note, benefits } = previews[feature];
  return <>
    <button type="button" className={`pro-teaser ${compact ? 'pro-teaser-compact' : 'card'}`} onClick={() => setOpen(true)} aria-label={t('{feature} · Disponible en Pro', { feature: t(title) })}>
      <span className="pro-teaser-icon"><Icon size={19} /></span>
      <span className="pro-teaser-copy"><strong>{t(title)}</strong><span>{t(note)}</span></span>
      <span className="pro-teaser-lock"><LockKeyhole size={12} /><span>PRO</span></span>
    </button>
    {open && <Modal title={t(title)} subtitle={t('Un poco más de espacio para tu progreso.')} onClose={() => setOpen(false)}>
      <div className="pro-preview-mark"><Sparkles size={26} /><span>WEIGHT&EXERCISE PRO</span></div>
      <ul className="pro-preview-benefits">{benefits.map(benefit => <li key={benefit}><ArrowUpRight size={16} /><span>{t(benefit)}</span></li>)}</ul>
      <p className="pro-preview-explanation">{t('Esta función forma parte de Weight&Exercise Pro, una app independiente. Podrás comprarla en Google Play cuando esté disponible.')}</p>
      <div className="pro-preview-coming"><LockKeyhole size={15} /><span>{t('Próximamente en Google Play')}</span></div>
      <p className="pro-preview-basic">{t('Mientras tanto, tu versión Basic sigue siendo gratuita.')}</p>
      <button type="button" className="secondary-button full-width" onClick={() => setOpen(false)}>{t('Seguir con Basic')}</button>
    </Modal>}
  </>;
}
