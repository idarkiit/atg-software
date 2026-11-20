'use client';

import {useMemo, useState} from 'react';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Selector} from '@astryxdesign/core/Selector';
import {Token} from '@astryxdesign/core/Token';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {DOC_KINDS} from '@/lib/stock/kinds';
import type {CustomerOption, CustomerTx, TxRow} from '@/server/reports';
import {ReportShell, ReportTable, useUrlParams} from '@/components/reports/ReportShell';
import {DocLink} from '@/components/reports/DocLink';
import {dateVN, money, qty} from '@/components/reports/format';

type Top = CustomerTx['top'][number];

const kindLabel = (k: TxRow['kind']) => (k === 'payment' ? 'Thu nợ' : DOC_KINDS[k].title);

function Stat({label, value, hint, tone}: {label: string; value: string; hint?: string; tone?: 'warning'}) {
  return (
    <Card padding={3} variant={tone === 'warning' ? 'orange' : 'default'}>
      <VStack gap={1}>
        <Text type="body" size="sm" color="secondary">{label}</Text>
        <Heading level={4}>{value}</Heading>
        {hint && <Text type="body" size="sm" color="secondary">{hint}</Text>}
      </VStack>
    </Card>
  );
}

export function GiaoDichKhPage({
  customers,
  selected,
  data,
  tu,
  den,
}: {
  customers: CustomerOption[];
  selected: string | null;
  data: CustomerTx | null;
  tu: string;
  den: string;
}) {
  const {set} = useUrlParams();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.rows ?? []).filter(r => {
      if (kind && r.kind !== kind) return false;
      return !q || `${r.code} ${r.note} ${kindLabel(r.kind)}`.toLowerCase().includes(q);
    });
  }, [data, query, kind]);

  const columns: TableColumn<TxRow>[] = [
    {key: 'date', header: 'Ngày', width: pixel(100), renderCell: r => <Text type="body">{dateVN(r.date)}</Text>},
    {key: 'kind', header: 'Loại', width: proportional(1, {minWidth: 170}), renderCell: r => <Text type="body">{kindLabel(r.kind)}</Text>},
    {key: 'code', header: 'Số chứng từ', width: pixel(130), renderCell: r => <DocLink kind={r.kind} id={r.docId} code={r.code} />},
    {key: 'amount', header: 'Giá trị', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body">{r.amount ? money(r.amount) : '—'}</Text>},
    {key: 'paid', header: 'Đã thanh toán', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body">{r.paid ? money(r.paid) : '—'}</Text>},
    {key: 'note', header: 'Ghi chú', width: proportional(2, {minWidth: 180}), renderCell: r => <Text type="body">{r.note || '—'}</Text>},
  ];
  const topColumns: TableColumn<Top>[] = [
    {key: 'product', header: 'Sản phẩm', width: proportional(2, {minWidth: 220}), renderCell: t => <Text type="body">{t.code} · {t.name}</Text>},
    {key: 'qty', header: 'Số lượng', align: 'end', renderCell: t => <Text type="body">{qty(t.qty)}</Text>},
    {key: 'amount', header: 'Thành tiền', align: 'end', renderCell: t => <Text type="body" weight="semibold">{money(t.amount)}</Text>},
  ];

  const over = data && data.customer.debtLimit && data.balance > data.customer.debtLimit;

  return (
    <ReportShell
      title="Giao dịch khách hàng"
      description="Chọn khách hàng để xem tổng mua, công nợ và toàn bộ phiếu, lần thu nợ trong kỳ."
      tu={tu}
      den={den}
      toolbar={
        <Selector
          label="Khách hàng"
          placeholder="Chọn khách hàng…"
          hasSearch
          searchPlaceholder="Tìm theo tên, mã, điện thoại"
          hasClear
          value={selected}
          onChange={(v: string | null) => set({kh: v})}
          options={customers}
        />
      }
      search={data ? {value: query, onChange: setQuery, placeholder: 'Tìm theo số chứng từ, ghi chú…'} : undefined}
      filterCount={kind ? 1 : 0}
      filters={
        data ? (
          <Selector
            label="Loại chứng từ"
            placeholder="Tất cả"
            hasClear
            value={kind}
            onChange={(v: string | null) => setKind(v)}
            options={[
              {value: 'sale', label: DOC_KINDS.sale.title},
              {value: 'sale_vat', label: DOC_KINDS.sale_vat.title},
              {value: 'sale_return', label: DOC_KINDS.sale_return.title},
              {value: 'payment', label: 'Thu nợ'},
            ]}
          />
        ) : undefined
      }>
      {!data ? (
        <EmptyState title="Chưa chọn khách hàng" description="Chọn một khách hàng ở trên để xem giao dịch." />
      ) : (
        <VStack gap={4}>
          <HStack gap={2} vAlign="center">
            <Heading level={3}>{data.customer.name}</Heading>
            <Text type="body" color="secondary">{data.customer.code}{data.customer.phone ? ` · ${data.customer.phone}` : ''}</Text>
            {over && <Token label="Vượt hạn mức" color="red" size="sm" />}
          </HStack>
          <Grid columns={{minWidth: 200}} gap={3}>
            <Stat label="Tổng mua" value={money(data.totalBought)} hint={data.totalReturned ? `Hàng trả lại ${money(data.totalReturned)}` : undefined} />
            <Stat label="Đã trả" value={money(data.totalPaid)} />
            <Stat
              label="Còn nợ (đến hết kỳ)"
              value={money(data.balance)}
              hint={data.customer.debtLimit ? `Hạn mức ${money(data.customer.debtLimit)}` : undefined}
              tone={over ? 'warning' : undefined}
            />
            <Stat label="Số phiếu" value={qty(data.docCount)} />
            <Stat label="Lần mua gần nhất" value={dateVN(data.lastPurchase)} />
          </Grid>
          <VStack gap={2}>
            <Heading level={4}>Top 5 sản phẩm mua nhiều nhất trong kỳ</Heading>
            {data.top.length ? (
              <Table<Top> data={data.top} columns={topColumns} idKey="productId" density="compact" textOverflow="truncate" />
            ) : (
              <Text type="body" color="secondary">Không có hàng mua trong kỳ.</Text>
            )}
          </VStack>
          <VStack gap={2}>
            <Heading level={4}>Phiếu và thanh toán trong kỳ</Heading>
            <ReportTable<TxRow>
              key={`${query}|${kind}|${selected}`}
              rows={rows}
              columns={columns}
              idKey="key"
              countLabel="chứng từ"
              totals={[
                {label: 'Tổng giá trị', value: money(rows.reduce((s, r) => s + r.amount, 0))},
                {label: 'Đã thanh toán', value: money(rows.reduce((s, r) => s + r.paid, 0)), strong: true},
              ]}
            />
          </VStack>
        </VStack>
      )}
    </ReportShell>
  );
}
