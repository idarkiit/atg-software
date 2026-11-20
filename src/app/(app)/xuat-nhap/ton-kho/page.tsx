import {guardReport} from '@/server/report-guard';
import {resolvePeriod, stockReport} from '@/server/reports';
import {TonKhoPage} from './TonKhoPage';

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const g = await guardReport('ton-kho');
  if (!g.ok) return g.page;
  const period = resolvePeriod(await searchParams);
  const data = await stockReport(g.user, period);
  return <TonKhoPage data={data} tu={period.tu} den={period.den} />;
}
