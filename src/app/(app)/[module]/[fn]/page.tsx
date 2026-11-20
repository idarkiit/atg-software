import {notFound} from 'next/navigation';
import {can, requireUser} from '@/lib/auth';
import {CURRENT_PHASE, featureKey, findFeature} from '@/lib/features';
import {getResourceDef} from '@/lib/resources/definitions';
import {listRecords, loadRefOptions} from '@/server/resources';
import {getToggles} from '@/server/toggles';
import {docKindByFeature} from '@/lib/stock/kinds';
import {listDocs, todayISO} from '@/server/stock';
import {addDaysISO} from '@/components/stock/format';
import {DocListPage} from '@/components/stock/DocListPage';
import {ResourcePage} from '@/components/resource/ResourcePage';
import {PageState} from '@/components/PageState';

/**
 * Generic route for every function in the tree: /{module}/{function}.
 * Functions with their own screen have a static route that takes precedence.
 */
export default async function FunctionPage({
  params,
  searchParams,
}: {
  params: Promise<{module: string; fn: string}>;
  searchParams: Promise<{[k: string]: string | string[] | undefined}>;
}) {
  const {module, fn} = await params;
  const found = findFeature(module, fn);
  if (!found) notFound();
  const key = featureKey(module, fn);
  const user = await requireUser();

  const toggles = await getToggles();
  if (toggles[module] === false || toggles[key] === false) {
    return <PageState title="Chức năng đang tắt" description="Quản trị viên đã tắt chức năng này trong Cài đặt." />;
  }
  if (!can(user, key, 'view')) {
    return <PageState title="Bạn chưa được cấp quyền" description={`Liên hệ quản trị để được cấp quyền xem "${found.fn.title}".`} />;
  }

  const docDef = docKindByFeature(key);
  if (docDef) {
    const sp = await searchParams;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const pick = (v: string | string[] | undefined) => (typeof v === 'string' && iso.test(v) ? v : null);
    const today = todayISO();
    const to = pick(sp.den) ?? today;
    const from = pick(sp.tu) ?? addDaysISO(today, -90);
    const rows = await listDocs(user, {kinds: [docDef.kind], from, to});
    return (
      <DocListPage
        kind={docDef.kind}
        route={`/${module}/${fn}`}
        rows={rows}
        from={from}
        to={to}
        perms={{create: can(user, key, 'create'), delete: can(user, key, 'delete')}}
      />
    );
  }

  const def = getResourceDef(key);
  if (!def) {
    return (
      <PageState
        title={`${found.fn.title} · sắp có`}
        description={
          found.fn.phase > CURRENT_PHASE
            ? `Chức năng thuộc đợt ${found.fn.phase} trong kế hoạch, sẽ có ở bản cập nhật tiếp theo.`
            : 'Chức năng đang được hoàn thiện.'
        }
      />
    );
  }

  const [rows, refOptions] = await Promise.all([listRecords(key, user), loadRefOptions(def)]);
  return (
    <ResourcePage
      def={def}
      rows={rows}
      refOptions={refOptions}
      currentUserId={user.id}
      perms={{
        create: can(user, key, 'create'),
        edit: can(user, key, 'edit'),
        delete: can(user, key, 'delete'),
        propose: can(user, key, 'propose'),
        approve: can(user, key, 'approve'),
      }}
    />
  );
}
