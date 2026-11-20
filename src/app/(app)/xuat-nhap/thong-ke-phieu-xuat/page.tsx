import {guardReport} from '@/server/report-guard';
import {resolvePeriod, saleStats} from '@/server/reports';
import {ThongKePhieuXuatPage} from './ThongKePhieuXuatPage';

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const g = await guardReport('thong-ke-phieu-xuat');
  if (!g.ok) return g.page;
  const period = resolvePeriod(await searchParams);
  const data = await saleStats(g.user, period);
  return <ThongKePhieuXuatPage data={data} tu={period.tu} den={period.den} />;
}
