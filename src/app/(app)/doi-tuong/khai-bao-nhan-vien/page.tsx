import {can, requireUser} from '@/lib/auth';
import {getToggles} from '@/server/toggles';
import {listPending} from '@/server/proposals';
import {PageState} from '@/components/PageState';
import {OnboardingPage} from './OnboardingPage';

const KEY = 'doi-tuong/khai-bao-nhan-vien';

export default async function Page() {
  const user = await requireUser();
  const toggles = await getToggles();
  if (toggles['doi-tuong'] === false || toggles[KEY] === false) {
    return <PageState title="Chức năng đang tắt" description="Quản trị viên đã tắt chức năng này trong Cài đặt." />;
  }
  if (!can(user, KEY, 'view')) {
    return <PageState title="Bạn chưa được cấp quyền" description='Liên hệ quản trị để được cấp quyền xem "Khởi tạo thông tin nhân viên".' />;
  }
  const all = await listPending(user);
  const mine = all.filter(
    p => p.kind === 'proposal' && p.resource === 'doi-tuong/nhan-vien' && p.action === 'create' && p.requestedById === user.id,
  );
  return <OnboardingPage submitted={mine} defaultName={user.fullName} />;
}
