import {desc, eq} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {can, requireUser} from '@/lib/auth';
import {getToggles} from '@/server/toggles';
import {PageState} from '@/components/PageState';
import {NotificationsPage, type NotificationRow} from './NotificationsPage';

export default async function Page() {
  const user = await requireUser();
  const toggles = await getToggles();
  if (toggles['canh-bao'] === false || toggles['canh-bao/thong-bao'] === false) {
    return <PageState title="Chức năng đang tắt" description="Quản trị viên đã tắt chức năng này trong Cài đặt." />;
  }
  if (!can(user, 'canh-bao/thong-bao', 'view')) {
    return <PageState title="Bạn chưa được cấp quyền" description='Liên hệ quản trị để được cấp quyền xem "Thông báo".' />;
  }
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(200);
  const items: NotificationRow[] = rows.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    link: r.link,
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
  }));
  return <NotificationsPage items={items} />;
}
