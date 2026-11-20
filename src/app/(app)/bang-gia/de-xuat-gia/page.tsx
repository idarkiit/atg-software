import {can} from '@/lib/auth';
import {listProposalProducts, listProposals} from '@/server/pricing';
import {guardPage} from '../guard';
import {ProposalsPage} from './ProposalsPage';

export default async function Page() {
  const {user, key, blocked} = await guardPage('de-xuat-gia');
  if (blocked) return blocked;
  const canCreate = can(user, key, 'create') || can(user, key, 'propose');
  const [rows, products] = await Promise.all([listProposals(user), canCreate ? listProposalProducts() : Promise.resolve([])]);
  return (
    <ProposalsPage
      rows={rows}
      products={products}
      canCreate={canCreate}
      showAll={can(user, 'bang-gia/tinh-lai', 'approve')}
      currentUserId={user.id}
    />
  );
}
