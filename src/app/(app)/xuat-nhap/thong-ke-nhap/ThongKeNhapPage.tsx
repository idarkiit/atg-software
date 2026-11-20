'use client';

import {DocStatsView} from '@/components/reports/DocStatsView';
import type {DocStats} from '@/server/reports';

export function ThongKeNhapPage({data, tu, den}: {data: DocStats; tu: string; den: string}) {
  return <DocStatsView mode="purchase" data={data} tu={tu} den={den} />;
}
