import { requirePermission } from '@/lib/auth/session';
import { authService } from '@/services/backend/auth';
import { load } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserToggle } from '@/features/UserToggle';
import { humanize } from '@/lib/utilities/format';

export const metadata = { title: 'User accounts', robots: { index: false } };
export default async function UsersPage() {
  const s = await requirePermission('users:manage');
  const users = await load(authService.users());
  return <><PageHeader title="User accounts" description={`${users.length} accounts. Disabling an account blocks sign-in (backend rule).`} /><Table><THead><TR><TH>ID</TH><TH>Username</TH><TH>E-mail</TH><TH>Role</TH><TH>Access</TH></TR></THead><TBody>{users.map((u) => <TR key={u.id}><TD className="num">{u.id}</TD><TD className="font-medium">{u.username}</TD><TD>{u.email}</TD><TD><Badge>{humanize(u.role)}</Badge></TD><TD><UserToggle id={u.id} enabled={u.enabled} self={u.id === s.userId} /></TD></TR>)}</TBody></Table></>;
}
