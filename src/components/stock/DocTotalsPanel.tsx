'use client';

import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Banner} from '@astryxdesign/core/Banner';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import type {DocKindDef} from '@/lib/stock/kinds';
import type {FormState} from './editorLogic';
import {fmtMoney} from './format';

type Props = {
  def: DocKindDef;
  f: FormState;
  totals: {subtotal: number; vatAmount: number; total: number; costOut: number; debt: number};
  /** Chosen customer may not be put into debt. */
  noDebtCustomer: boolean;
  set: (patch: Partial<FormState>) => void;
};

function Row({label, value, strong}: {label: string; value: string; strong?: boolean}) {
  return (
    <HStack hAlign="between" gap={3}>
      <Text type="body" weight={strong ? 'semibold' : 'normal'}>{label}</Text>
      <Text type="body" weight={strong ? 'semibold' : 'normal'}>{value}</Text>
    </HStack>
  );
}

/** Totals and payment block of the voucher editor. */
export function DocTotalsPanel({def, f, totals, noDebtCustomer, set}: Props) {
  const isReturn = def.debt?.sign === -1;
  if (!def.priced) {
    return (
      <VStack gap={2}>
        <Row label={def.direction === 'convert' ? 'Giá trị xuất (chuyển sang dòng nhập)' : 'Tổng giá vốn'} value={fmtMoney(totals.costOut)} strong />
        <Text type="body" color="secondary" size="sm">Giá vốn tính theo giá vốn bình quân hiện tại của từng sản phẩm.</Text>
      </VStack>
    );
  }
  return (
    <VStack gap={2}>
      <Row label="Tổng tiền hàng" value={fmtMoney(totals.subtotal)} />
      <NumberInput label="Giảm giá phiếu" min={0} units="đ" value={f.discountAmount} onChange={v => set({discountAmount: v})} />
      {def.vat && <Row label={`VAT (${f.vatRate}%)`} value={fmtMoney(totals.vatAmount)} />}
      <Divider />
      <Row label="Tổng thanh toán" value={fmtMoney(totals.total)} strong />
      {def.payment && (
        <>
          <Divider />
          <HStack gap={2} vAlign="end">
            <NumberInput
              label={isReturn ? 'Hoàn tiền ngay' : 'Thanh toán ngay'}
              min={0}
              max={totals.total}
              units="đ"
              value={f.paidAmount}
              onChange={v => set({paidAmount: v})}
            />
            <Button label="Trả đủ" variant="secondary" onClick={() => set({paidAmount: totals.total})} />
          </HStack>
          <Selector
            label="Hình thức"
            options={[
              {value: 'cash', label: 'Tiền mặt'},
              {value: 'bank', label: 'Chuyển khoản'},
            ]}
            value={f.method}
            onChange={(v: string) => set({method: v === 'bank' ? 'bank' : 'cash'})}
          />
          <Row label={isReturn ? 'Ghi giảm công nợ' : 'Ghi công nợ'} value={fmtMoney(totals.debt)} strong />
          {noDebtCustomer && (
            <Banner
              status="warning"
              title="Khách thuộc loại không được ghi nợ"
              description="Khách này phải thanh toán đủ ngay khi lập phiếu."
              container="card"
              collapsible={false}
            />
          )}
        </>
      )}
    </VStack>
  );
}
