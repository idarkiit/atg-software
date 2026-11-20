import {desc, eq} from 'drizzle-orm';
import {getDb, isDemoDatabase, schema} from '@/db';
import {can, requireUser} from '@/lib/auth';
import {CURRENT_PHASE, MODULES, featureHref, featureKey} from '@/lib/features';
import {getToggles, isTaxMode} from '@/server/toggles';
import {countPendingForUser} from '@/server/proposals';
import {AppFrame, type NavModule} from '@/components/AppFrame';

export default async function AppLayout({children}: {children: React.ReactNode}) {
  const user = await requireUser();
  const db = await getDb();
  const toggles = await getToggles();

  // Side navigation: only modules/functions the user may view and that are switched on.
  const modules: NavModule[] = MODULES.filter(m => toggles[m.key] !== false)
    .map(m => ({
      key: m.key,
      title: m.title,
      icon: m.icon,
      functions: m.functions
        .filter(f => toggles[featureKey(m.key, f.key)] !== false)
        .filter(f => can(user, featureKey(m.key, f.key), 'view'))
        .map(f => ({
          key: f.key,
          title: f.title,
          href: featureHref(m.key, f.key),
          isReady: f.phase <= CURRENT_PHASE,
        })),
    }))
    .filter(m => m.functions.length > 0);

  const branches = await db
    .select({id: schema.branches.id, name: schema.branches.name})
    .from(schema.branches)
    .where(eq(schema.branches.isActive, true));

  const notifications = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(30);

  const pendingApprovals = await countPendingForUser(user);

  return (
    <AppFrame
      modules={modules}
      user={{fullName: user.fullName, roleName: user.roleName}}
      branches={branches.map(b => ({value: String(b.id), label: b.name}))}
      branchId={user.branchId}
      canSwitchBranch={user.allBranches}
      notifications={notifications.map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      }))}
      pendingApprovals={pendingApprovals}
      isDemo={isDemoDatabase}
      isTaxMode={isTaxMode}>
      {children}
    </AppFrame>
  );
}
