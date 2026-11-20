import {getCompare} from '@/server/pricing';
import {guardPage} from '../guard';
import {ComparePage} from './ComparePage';

export default async function Page({searchParams}: {searchParams: Promise<{nhom?: string}>}) {
  const {blocked} = await guardPage('so-sanh-gia-ncc');
  if (blocked) return blocked;
  const {nhom} = await searchParams;
  const groupId = nhom && Number.isInteger(Number(nhom)) ? Number(nhom) : null;
  const data = await getCompare(groupId);
  return <ComparePage data={data} />;
}
