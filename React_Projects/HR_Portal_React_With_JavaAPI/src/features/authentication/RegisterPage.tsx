import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';
import { Info } from 'lucide-react';
/** The backend has no public self-registration (POST /auth/register is HR/SUPER_ADMIN only), so this is an informational page. */
export default function RegisterPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('auth.registerDisabled')}>
      <div className="d-flex gap-2 rounded-md bg-primary-soft p-3 text-[13px]"><Info size={18} className="shrink-0 text-primary" /><div>{t('auth.registerInfo')}<div className="mt-2 text-muted">{t('auth.verifyInfo')}</div></div></div>
      <div className="mt-3 text-center" style={{ fontSize: 13 }}><Link to="/login">{t('auth.backToLogin')}</Link></div>
    </AuthLayout>
  );
}
