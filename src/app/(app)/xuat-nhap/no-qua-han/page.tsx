import {can} from '@/lib/auth';
import {guardReport} from '@/server/report-guard';
import {overdueReport} from '@/server/reports';
import {NoQuaHanPage} from './NoQuaHanPage';

export default async function Page() {
  const g = await guardReport('no-qua-han');
  if (!g.ok) return g.page;
  const {rows, today} = await overdueReport(g.user);
  return <NoQuaHanPage rows={rows} today={today} canPay={can(g.user, 'xuat-nhap/cong-no-kh', 'create')} />;
}
