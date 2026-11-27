import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
export default function NotFoundPage() { const { t } = useTranslation(); return <div className="hr-card mt-4"><EmptyState title="404" hint={t('common.notFound')} action={<Button asChild><Link to="/">{t('common.goHome')}</Link></Button>} /></div>; }
