import 'server-only';
import {notFound} from 'next/navigation';
import {createElement} from 'react';
import {can, requireUser, type CurrentUser, type PermissionAction} from '@/lib/auth';
import {featureKey, findFeature} from '@/lib/features';
import {docKindByFeature, type DocKindDef} from '@/lib/stock/kinds';
import {getToggles} from './toggles';
import {PageState} from '@/components/PageState';

export type DocGuard =
  | {ok: true; user: CurrentUser; def: DocKindDef; key: string; route: string}
  | {ok: false; page: React.ReactElement};

/** Shared checks of the voucher routes: 404 for non-voucher features, toggles and permission. */
export async function guardDocPage(module: string, fn: string, action: PermissionAction): Promise<DocGuard> {
  const found = findFeature(module, fn);
  if (!found) notFound();
  const key = featureKey(module, fn);
  const def = docKindByFeature(key);
  if (!def) notFound();
  const user = await requireUser();
  const toggles = await getToggles();
  if (toggles[module] === false || toggles[key] === false) {
    return {
      ok: false,
      page: createElement(PageState, {title: 'Chức năng đang tắt', description: 'Quản trị viên đã tắt chức năng này trong Cài đặt.'}),
    };
  }
  if (!can(user, key, action)) {
    return {
      ok: false,
      page: createElement(PageState, {
        title: 'Bạn chưa được cấp quyền',
        description: `Liên hệ quản trị để được cấp quyền ${action === 'create' ? 'tạo' : 'xem'} "${found.fn.title}".`,
      }),
    };
  }
  return {ok: true, user, def, key, route: `/${module}/${fn}`};
}
