import {can} from '@/lib/auth';
import {listSupplierPrices} from '@/server/pricing';
import {guardPage} from '../guard';
import {SupplierPricesPage} from './SupplierPricesPage';

export default async function Page() {
  const {user, key, blocked} = await guardPage('gia-ncc');
  if (blocked) return blocked;
  const data = await listSupplierPrices();
  return (
    <SupplierPricesPage
      {...data}
      perms={{create: can(user, key, 'create'), edit: can(user, key, 'edit'), delete: can(user, key, 'delete')}}
    />
  );
}
