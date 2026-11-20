import {can, requireUser} from '@/lib/auth';
import {getToggles} from '@/server/toggles';
import {listPending} from '@/server/proposals';
import {PageState} from '@/components/PageState';
import {ApprovalsPage} from './ApprovalsPage';

export default async function Page() {
  const user = await requireUser();
  const toggles = await getToggles();
  if (toggles['canh-bao'] === false || toggles['canh-bao/duyet-de-xuat'] === false) {
    return <PageState title="Chức năng đang tắt" description="Quản trị viên đã tắt chức năng này trong Cài đặt." />;
  }
  if (!can(user, 'canh-bao/duyet-de-xuat', 'view')) {
    return <PageState title="Bạn chưa được cấp quyền" description='Liên hệ quản trị để được cấp quyền xem "Duyệt đề xuất".' />;
  }
  const items = await listPending(user);
  return <ApprovalsPage items={items} currentUserId={user.id} />;
}
