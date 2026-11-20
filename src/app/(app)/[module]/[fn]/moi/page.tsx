import {guardDocPage} from '@/server/doc-guard';
import {loadDocFormData} from '@/server/stock';
import {DocEditor} from '@/components/stock/DocEditor';

/** New voucher editor: /{module}/{fn}/moi (404 unless the function is a voucher kind). */
export default async function NewDocPage({params}: {params: Promise<{module: string; fn: string}>}) {
  const {module, fn} = await params;
  const g = await guardDocPage(module, fn, 'create');
  if (!g.ok) return g.page;
  const formData = await loadDocFormData(g.user, g.def.kind);
  return <DocEditor kind={g.def.kind} route={g.route} formData={formData} />;
}
