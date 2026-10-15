import { useI18n } from '../lib/i18n';
import './creator-credit.css';

/** Original transparent PNGs; the frame trims only their empty outer canvas. */
export default function CreatorCredit() {
  const { t } = useI18n();
  return <span className="creator-credit">
    <span className="creator-credit-mark" aria-hidden="true">
      <img className="creator-credit-on-dark" src="/images/greenbean-brand.png" alt="" width="1254" height="1254" decoding="async" />
      <img className="creator-credit-on-light" src="/images/greenbean-brand-on-light.png" alt="" width="1254" height="1254" decoding="async" />
    </span>
    <span>{t('Creada por')} <strong>GreenBean</strong></span>
  </span>;
}
