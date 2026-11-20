import {can} from '@/lib/auth';
import {listProposalProducts, listSalePrices} from '@/server/pricing';
import {guardPage} from '../guard';
import {SalePricesPage} from './SalePricesPage';

export default async function Page() {
  const {user, blocked} = await guardPage('gia-ban');
  if (blocked) return blocked;
  const canPropose = can(user, 'bang-gia/de-xuat-gia', 'create') || can(user, 'bang-gia/de-xuat-gia', 'propose');
  const [data, products] = await Promise.all([listSalePrices(), canPropose ? listProposalProducts() : Promise.resolve([])]);
  return <SalePricesPage rows={data.rows} groups={data.groups} types={data.types} products={products} canPropose={canPropose} />;
}
