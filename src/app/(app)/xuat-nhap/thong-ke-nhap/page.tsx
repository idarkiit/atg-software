import {guardReport} from '@/server/report-guard';
import {resolvePeriod, purchaseStats} from '@/server/reports';
import {ThongKeNhapPage} from './ThongKeNhapPage';

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const g = await guardReport('thong-ke-nhap');
  if (!g.ok) return g.page;
  const period = resolvePeriod(await searchParams);
  const data = await purchaseStats(g.user, period);
  return <ThongKeNhapPage data={data} tu={period.tu} den={period.den} />;
}
