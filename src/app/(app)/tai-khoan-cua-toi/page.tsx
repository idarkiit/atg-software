import {eq} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {requireUser} from '@/lib/auth';
import {AccountPage} from './AccountPage';

export default async function Page() {
  const user = await requireUser();
  let branchName: string | null = null;
  if (user.branchId) {
    const db = await getDb();
    const [b] = await db.select({name: schema.branches.name}).from(schema.branches).where(eq(schema.branches.id, user.branchId));
    branchName = b?.name ?? null;
  }
  return (
    <AccountPage
      fullName={user.fullName}
      username={user.username}
      roleName={user.isAdmin ? `${user.roleName ?? 'Quản trị'} (toàn quyền)` : (user.roleName ?? '—')}
      branchName={branchName ?? 'Tất cả chi nhánh'}
    />
  );
}
