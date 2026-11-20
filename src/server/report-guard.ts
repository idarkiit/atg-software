import 'server-only';
import {createElement} from 'react';
import {can, requireUser, type CurrentUser} from '@/lib/auth';
import {featureKey, findFeature} from '@/lib/features';
import {getToggles} from './toggles';
import {PageState} from '@/components/PageState';

export type ReportGuard = {ok: true; user: CurrentUser; key: string; title: string} | {ok: false; page: React.ReactElement};

/** Shared checks of the report routes /xuat-nhap/<fn>: login, feature toggle, view permission. */
export async function guardReport(fn: string): Promise<ReportGuard> {
  const found = findFeature('xuat-nhap', fn);
  const key = featureKey('xuat-nhap', fn);
  const title = found?.fn.title ?? fn;
  const user = await requireUser();
  const toggles = await getToggles();
  if (toggles['xuat-nhap'] === false || toggles[key] === false) {
    return {ok: false, page: createElement(PageState, {title: 'Chức năng đang tắt', description: 'Quản trị viên đã tắt chức năng này trong Cài đặt.'})};
  }
  if (!can(user, key, 'view')) {
    return {ok: false, page: createElement(PageState, {title: 'Bạn chưa được cấp quyền', description: `Liên hệ quản trị để được cấp quyền xem "${title}".`})};
  }
  return {ok: true, user, key, title};
}
