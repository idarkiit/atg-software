import {count, eq} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {requireUser} from '@/lib/auth';
import {countPendingForUser} from '@/server/proposals';
import {CURRENT_PHASE, MODULES} from '@/lib/features';
import {HomePage, type ModuleProgress} from './HomePage';

export default async function Page() {
  const user = await requireUser();
  const db = await getDb();
  const [[customers], [suppliers], [products], [employees], pending] = await Promise.all([
    db.select({n: count()}).from(schema.customers).where(eq(schema.customers.recordStatus, 'official')),
    db.select({n: count()}).from(schema.suppliers).where(eq(schema.suppliers.recordStatus, 'official')),
    db.select({n: count()}).from(schema.products),
    db.select({n: count()}).from(schema.employees).where(eq(schema.employees.recordStatus, 'official')),
    countPendingForUser(user),
  ]);

  const modules: ModuleProgress[] = MODULES.map(m => {
    const phases = m.functions.map(f => f.phase);
    const live = phases.filter(p => p <= CURRENT_PHASE).length;
    return {
      key: m.key,
      title: m.title,
      functionCount: m.functions.length,
      phase: Math.min(...phases),
      status: live === phases.length ? 'done' : live > 0 ? 'wip' : 'planned',
    };
  });

  return (
    <HomePage
      name={user.fullName}
      stats={[
        {label: 'Khách hàng', value: customers.n},
        {label: 'Nhà cung cấp', value: suppliers.n},
        {label: 'Sản phẩm', value: products.n},
        {label: 'Nhân viên', value: employees.n},
        {label: 'Mục chờ duyệt', value: pending},
      ]}
      modules={modules}
    />
  );
}
