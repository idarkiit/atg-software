import {can} from '@/lib/auth';
import {guardReport} from '@/server/report-guard';
import {debtReport, resolvePeriod} from '@/server/reports';
import {todayISO} from '@/server/stock';
import {CongNoNccPage} from './CongNoNccPage';

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const g = await guardReport('cong-no-ncc');
  if (!g.ok) return g.page;
  const period = resolvePeriod(await searchParams);
  const rows = await debtReport(g.user, 'supplier', period);
  return <CongNoNccPage rows={rows} tu={period.tu} den={period.den} today={todayISO()} canPay={can(g.user, g.key, 'create')} />;
}
