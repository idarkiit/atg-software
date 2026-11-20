import {guardReport} from '@/server/report-guard';
import {customerOptions, customerTransactions, resolvePeriod} from '@/server/reports';
import {GiaoDichKhPage} from './GiaoDichKhPage';

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const g = await guardReport('giao-dich-kh');
  if (!g.ok) return g.page;
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const kh = Array.isArray(sp.kh) ? sp.kh[0] : sp.kh;
  const customerId = kh && /^\d+$/.test(kh) ? Number(kh) : null;
  const [customers, data] = await Promise.all([
    customerOptions(),
    customerId ? customerTransactions(g.user, customerId, period) : Promise.resolve(null),
  ]);
  return <GiaoDichKhPage customers={customers} selected={customerId ? String(customerId) : null} data={data} tu={period.tu} den={period.den} />;
}
