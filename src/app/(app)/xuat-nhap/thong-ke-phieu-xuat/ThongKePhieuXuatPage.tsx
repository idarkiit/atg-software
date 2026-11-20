'use client';

import {DocStatsView} from '@/components/reports/DocStatsView';
import type {DocStats} from '@/server/reports';

export function ThongKePhieuXuatPage({data, tu, den}: {data: DocStats; tu: string; den: string}) {
  return <DocStatsView mode="sale" data={data} tu={tu} den={den} />;
}
