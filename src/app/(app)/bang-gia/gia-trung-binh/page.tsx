import {can} from '@/lib/auth';
import {listAvgCosts} from '@/server/pricing';
import {guardPage} from '../guard';
import {AvgCostsPage} from './AvgCostsPage';

export default async function Page() {
  const {user, key, blocked} = await guardPage('gia-trung-binh');
  if (blocked) return blocked;
  const rows = await listAvgCosts();
  return <AvgCostsPage rows={rows} canEdit={can(user, key, 'edit')} />;
}
