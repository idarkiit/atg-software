import {guardReport} from '@/server/report-guard';
import {priceHistoryReport, resolvePeriod} from '@/server/reports';
import {LichSuGiaPage} from './LichSuGiaPage';

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const g = await guardReport('lich-su-gia');
  if (!g.ok) return g.page;
  const period = resolvePeriod(await searchParams);
  const data = await priceHistoryReport(g.user, period);
  return <LichSuGiaPage data={data} tu={period.tu} den={period.den} />;
}
