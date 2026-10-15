import { useI18n } from '../lib/i18n';
import './creator-credit.css';

/** A quiet attribution; the original brand artwork stays local and unmodified. */
export default function CreatorCredit() {
  const { t } = useI18n();
  return <span className="creator-credit">
    <span className="creator-credit-mark" aria-hidden="true"><img src="/images/greenbean-brand.png" alt="" width="1254" height="1254" decoding="async" /></span>
    <span>{t('Creada por')} <strong>GreenBean</strong></span>
  </span>;
}
