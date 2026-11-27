import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@mui/material';
import { Card, CardBody } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Detail } from '@/components/common/Detail';
import { OpView } from '@/components/op/OpView';
import { OpButton } from '@/components/op/OpButton';
import { useOp } from '@/components/op/useOp';
import { useAppSelector, useAppDispatch } from '@/store/redux';
import { updateSettings } from '@/store/redux/settingsSlice';
import { ChangePasswordForm } from '@/features/authentication/ChangePasswordPage';
import { useFormat } from '@/contexts/LanguageContext';
import { NativeSelect } from '@/components/ui/input';
import { initials } from '@/utils/format';
import { LoadingBlock } from '@/components/feedback/states';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { t } = useTranslation(); const nav = useNavigate(); const [sp] = useSearchParams(); const f = useFormat(); const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user); const settings = useAppSelector((s) => s.settings);
  const me = useOp<any>('auth.me'); const emp = useOp<any>('employee.me', undefined, { enabled: !!user?.employeeId, retry: false });
  const u = me.data ?? user;
  if (!u) return <LoadingBlock />;
  return (
    <>
      <Card className="mb-3"><CardBody className="d-flex align-items-center gap-3"><Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>{initials(u.username)}</Avatar>
        <div><h1 className="page-title">{u.username}</h1><div className="text-muted" style={{ fontSize: 13 }}>{u.email} · {t('auth.lastLogin')}: {f.dateTime(u.lastLoginAt)}</div><div className="mt-1 d-flex gap-1 flex-wrap">{u.roles?.map((r: string) => <Badge key={r} tone="primary">{r}</Badge>)}</div></div></CardBody></Card>
      <Tabs initial={sp.get('tab') ?? undefined} tabs={[
        { key: 'account', label: t('auth.accountStatus'), content: <Card><CardBody><Detail data={u} hide={['id', 'roles', 'permissions']} /><div className="mt-3"><div className="field-label">{t('auth.permissions')} ({u.permissions?.length ?? 0})</div><div className="d-flex gap-1 flex-wrap">{u.permissions?.map((p: string) => <Badge key={p}>{p}</Badge>)}</div></div></CardBody></Card> },
        { key: 'security', label: t('auth.security'), content: <div className="row g-3"><div className="col-lg-6"><Card><CardBody><h3 className="fs-6 mb-3">{t('auth.changeTitle')}</h3><ChangePasswordForm onDone={() => nav('/login', { replace: true })} /></CardBody></Card></div>
          <div className="col-lg-6"><Card><CardBody><h3 className="fs-6">{t('auth.sessions')}</h3><p className="text-muted" style={{ fontSize: 13 }}>Access tokens last 30 minutes and refresh silently. Changing your password signs you out everywhere. {t('auth.verifyInfo')}</p></CardBody></Card></div></div> },
        { key: 'employee', label: t('nav.employees'), hidden: !user?.employeeId, content: <div className="d-grid gap-3"><OpView op="employee.me" title="My employee profile" actions={<><OpButton op="employee.updateMyContact" label={t('common.edit')} initial={emp.data?.contact} variant="default" /><Link to={`/employees/${user?.employeeId}`} className="btn btn-sm">360° →</Link></>} /></div> },
        { key: 'prefs', label: t('common.settings'), content: <Card><CardBody style={{ maxWidth: 420 }}>
          <label className="field-label">Currency</label><NativeSelect value={settings.currency} onChange={(e) => dispatch(updateSettings({ currency: e.target.value }))}>{['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => <option key={c}>{c}</option>)}</NativeSelect>
          <label className="field-label mt-3">Week starts on</label><NativeSelect value={settings.weekStartsOn} onChange={(e) => dispatch(updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 }))}><option value={1}>Monday</option><option value={0}>Sunday</option></NativeSelect></CardBody></Card> },
      ]} />
    </>
  );
}
