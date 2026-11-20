'use client';

import {DebtView} from '@/components/reports/DebtView';
import type {DebtRow} from '@/server/reports';

export function CongNoNccPage(props: {rows: DebtRow[]; tu: string; den: string; today: string; canPay: boolean}) {
  return <DebtView party="supplier" {...props} />;
}
