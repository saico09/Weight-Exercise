import { useState } from 'react';
import { Check, Palette, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Theme } from '../lib/model';
import { themeInfo } from '../lib/themes';
import { accentPresets, accentStyle } from '../lib/accent';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './accent-picker.css';

export default function AccentPicker({ theme, value, onChange }: { theme: Theme; value: string | null; onChange: (color: string | null) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="accent-customize-button" aria-label={t('Personalizar color')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <span className="accent-button-swatch" aria-hidden="true" /><span>{t('Personalizar')}</span><SlidersHorizontal size={13} aria-hidden="true" />
    </button>
    {open && <AccentEditor theme={theme} value={value} onClose={() => setOpen(false)} onApply={color => { onChange(color); setOpen(false); }} />}
  </>;
}

function AccentEditor({ theme, value, onClose, onApply }: { theme: Theme; value: string | null; onClose: () => void; onApply: (color: string | null) => void }) {
  const { t } = useI18n();
  // This draft is isolated from saved settings; Escape, backdrop and Cancel discard it.
  const [draft, setDraft] = useState(value);
  const selectedPreset = accentPresets.find(preset => preset.color === draft?.toUpperCase());
  const custom = Boolean(draft && !selectedPreset);
  return <Modal title={t('Hazlo tuyo.')} subtitle={t('Tu color, en todos tus estilos.')} onClose={onClose}>
    <div className="accent-editor" style={accentStyle(theme, draft)}>
      <div className="accent-previews" aria-label={t('Vista previa de color')}>
        {(['dark', 'light'] as const).map(mode => <div key={mode} className={`accent-preview ${mode}`} style={accentStyle(mode, draft)}>
          <span className="accent-preview-label">{mode === 'dark' ? 'Dark' : 'Light'}<span /></span>
          <div className="accent-preview-number">72<span>kg</span></div>
          <svg viewBox="0 0 144 43" aria-hidden="true"><path d="M0 5 18 9 36 7 54 20 72 16 90 28 108 25 126 34 142 30" fill="none" stroke="var(--chart-accent)" strokeWidth="2.5" strokeLinecap="round" /><circle cx="142" cy="30" r="3" fill="var(--chart-accent)" /></svg>
          <span className="accent-preview-pill"><Check size={12} />{t('Tu progreso.')}</span>
        </div>)}
      </div>
      <p className="accent-picker-description">{t('Elige un tono o encuentra tu propia mezcla.')}</p>
      <div className="accent-options" role="group" aria-label={t('Color principal')}>
        {accentPresets.map(preset => <button type="button" key={preset.color} className={`accent-option ${selectedPreset === preset ? 'selected' : ''}`} aria-pressed={selectedPreset === preset} onClick={() => setDraft(preset.color)}>
          <span className="accent-swatch" style={{ background: preset.color, color: accentStyle(theme, preset.color)['--accent-contrast'] }}>{selectedPreset === preset && <Check size={16} aria-hidden="true" />}</span>
          <span>{t(preset.name)}</span>
        </button>)}
        <label className={`accent-option accent-spectrum-option ${custom ? 'selected' : ''}`}>
          <span className="accent-swatch spectrum-swatch"><Palette size={16} aria-hidden="true" /></span><span>{t('A tu gusto')}</span>
          <input type="color" aria-label={t('Todo el espectro')} value={draft || themeInfo[theme].accent} onChange={event => setDraft(event.target.value.toUpperCase())} />
        </label>
      </div>
      <div className="accent-current-color"><span>{draft ? selectedPreset ? t(selectedPreset.name) : t('Color personalizado') : t('Colores originales')}</span>{draft && <code>{draft.toUpperCase()}</code>}</div>
      <button type="button" className="accent-restore" onClick={() => setDraft(null)} disabled={draft === null}><RotateCcw size={16} />{t('Restaurar originales')}{draft === null && <Check size={15} aria-hidden="true" />}</button>
      <p className="accent-accessibility-note">{t('El texto se adapta para que siempre se lea bien.')}</p>
      <div className="accent-picker-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Cancelar')}</button><button type="button" className="primary-button" onClick={() => onApply(draft)}>{t('Aplicar color')}<Check size={16} /></button></div>
    </div>
  </Modal>;
}
