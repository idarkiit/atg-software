import {can, requireUser} from '@/lib/auth';
import {getToggles} from '@/server/toggles';
import {PageState} from '@/components/PageState';

const TITLES: Record<string, string> = {
  'gia-ban': 'Bảng giá bán',
  'gia-ncc': 'Bảng giá NCC',
  'so-sanh-gia-ncc': 'Thống kê giá các NCC',
  'gia-trung-binh': 'Bảng giá trung bình',
  'tinh-lai': 'Tính lãi giá bán',
  'de-xuat-gia': 'Đề xuất giá bán',
};

/** Shared checks of the bang-gia screens: login, feature switch, view permission. */
export async function guardPage(fn: string) {
  const user = await requireUser();
  const key = `bang-gia/${fn}`;
  const toggles = await getToggles();
  if (toggles['bang-gia'] === false || toggles[key] === false) {
    return {
      user,
      key,
      blocked: <PageState title="Chức năng đang tắt" description="Quản trị viên đã tắt chức năng này trong Cài đặt." />,
    };
  }
  if (!can(user, key, 'view')) {
    return {
      user,
      key,
      blocked: <PageState title="Bạn chưa được cấp quyền" description={`Liên hệ quản trị để được cấp quyền xem "${TITLES[fn]}".`} />,
    };
  }
  return {user, key, blocked: null};
}
