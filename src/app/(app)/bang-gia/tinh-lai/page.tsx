import {can} from '@/lib/auth';
import {listForReview} from '@/server/pricing';
import {guardPage} from '../guard';
import {ReviewPage} from './ReviewPage';

export default async function Page() {
  const {user, key, blocked} = await guardPage('tinh-lai');
  if (blocked) return blocked;
  const rows = await listForReview(user);
  return <ReviewPage rows={rows} canApprove={can(user, key, 'approve')} />;
}
