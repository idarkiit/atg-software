import {notFound} from 'next/navigation';
import {can} from '@/lib/auth';
import {guardDocPage} from '@/server/doc-guard';
import {getDoc} from '@/server/stock';
import {DocView} from '@/components/stock/DocView';
import {PageState} from '@/components/PageState';

/** Voucher detail and print view: /{module}/{fn}/{id}. */
export default async function DocDetailPage({params}: {params: Promise<{module: string; fn: string; id: string}>}) {
  const {module, fn, id} = await params;
  const g = await guardDocPage(module, fn, 'view');
  if (!g.ok) return g.page;
  const docId = Number(id);
  if (!Number.isInteger(docId) || docId <= 0) notFound();
  const doc = await getDoc(g.user, docId);
  if (!doc || doc.kind !== g.def.kind) {
    return <PageState title="Không tìm thấy phiếu" description="Phiếu không tồn tại hoặc không thuộc chi nhánh đang làm việc." />;
  }
  return (
    <DocView
      doc={doc}
      route={g.route}
      perms={{create: can(g.user, g.key, 'create'), delete: can(g.user, g.key, 'delete')}}
    />
  );
}
