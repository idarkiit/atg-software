'use client';

import {useMemo, useState} from 'react';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {Selector} from '@astryxdesign/core/Selector';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import type {PriceChange, PriceLine} from '@/server/reports';
import {ReportShell, ReportTable} from '@/components/reports/ReportShell';
import {DocLink} from '@/components/reports/DocLink';
import {dateTimeVN, dateVN, money, pct, qty} from '@/components/reports/format';

type Data = {
  lines: PriceLine[];
  changes: PriceChange[];
  products: {value: string; label: string}[];
  customers: {value: string; label: string}[];
};

/** Difference of the real price against the current price list, in %. null when the product has no list price. */
const diffOf = (l: PriceLine) => (l.listPrice > 0 ? ((l.netPrice - l.listPrice) / l.listPrice) * 100 : null);

export function LichSuGiaPage({data, tu, den}: {data: Data; tu: string; den: string}) {
  const [tab, setTab] = useState('sales');
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState<string | null>(null);
  const [customer, setCustomer] = useState<string | null>(null);

  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.lines.filter(l => {
      if (product && String(l.productId) !== product) return false;
      if (customer && String(l.customerId) !== customer) return false;
      return !q || `${l.docCode} ${l.customerName} ${l.productCode} ${l.productName}`.toLowerCase().includes(q);
    });
  }, [data.lines, query, product, customer]);

  const changes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.changes.filter(c => {
      if (product && String(c.productId) !== product) return false;
      return !q || `${c.productCode} ${c.productName} ${c.changedByName}`.toLowerCase().includes(q);
    });
  }, [data.changes, query, product]);

  const salesTab = tab === 'sales';
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const weighted = lines.filter(l => l.listPrice > 0);
  const wQty = weighted.reduce((s, l) => s + l.qty, 0);
  const avgDiff = wQty ? weighted.reduce((s, l) => s + (diffOf(l) ?? 0) * l.qty, 0) / wQty : 0;

  const lineColumns: TableColumn<PriceLine>[] = [
    {key: 'date', header: 'Ngày', width: pixel(100), renderCell: l => <Text type="body">{dateVN(l.date)}</Text>},
    {key: 'code', header: 'Số phiếu', width: pixel(130), renderCell: l => <DocLink kind={l.kind} id={l.docId} code={l.docCode} />},
    {key: 'customer', header: 'Khách hàng', width: proportional(1, {minWidth: 160}), renderCell: l => <Text type="body">{l.customerName}</Text>},
    {key: 'product', header: 'Sản phẩm', width: proportional(2, {minWidth: 220}), renderCell: l => <Text type="body">{l.productCode} · {l.productName}</Text>},
    {key: 'qty', header: 'Số lượng', align: 'end', width: pixel(90), renderCell: l => <Text type="body">{qty(l.qty)}</Text>},
    {key: 'price', header: 'Đơn giá', align: 'end', width: proportional(1, {minWidth: 120}), renderCell: l => <Text type="body">{money(l.unitPrice)}</Text>},
    {key: 'discount', header: 'Giảm giá', align: 'end', width: proportional(1, {minWidth: 110}), renderCell: l => <Text type="body">{l.discount ? money(l.discount) : '—'}</Text>},
    {key: 'net', header: 'Đơn giá thực', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: l => <Text type="body" weight="semibold">{money(l.netPrice)}</Text>},
    {key: 'list', header: 'Giá bảng giá (giá 1)', align: 'end', width: proportional(1, {minWidth: 150}), renderCell: l => <Text type="body">{l.listPrice ? money(l.listPrice) : '—'}</Text>},
    {
      key: 'diff',
      header: 'Chênh lệch',
      align: 'end',
      width: pixel(120),
      renderCell: l => {
        const d = diffOf(l);
        if (d === null) return <Text type="body" color="secondary">—</Text>;
        const rounded = Math.round(d * 10) / 10;
        return <Token label={`${rounded > 0 ? '+' : ''}${pct(rounded)}`} size="sm" color={rounded < 0 ? 'red' : rounded > 0 ? 'green' : 'gray'} />;
      },
    },
  ];

  const changeColumns: TableColumn<PriceChange>[] = [
    {key: 'product', header: 'Sản phẩm', width: proportional(2, {minWidth: 240}), renderCell: c => <Text type="body">{c.productCode} · {c.productName}</Text>},
    {key: 'p1', header: 'Giá 1', align: 'end', renderCell: c => <Text type="body" weight="semibold">{money(c.price1)}</Text>},
    {key: 'p2', header: 'Giá 2', align: 'end', renderCell: c => <Text type="body">{money(c.price2)}</Text>},
    {key: 'p3', header: 'Giá 3', align: 'end', renderCell: c => <Text type="body">{money(c.price3)}</Text>},
    {key: 'by', header: 'Người đổi', width: proportional(1, {minWidth: 140}), renderCell: c => <Text type="body">{c.changedByName}</Text>},
    {key: 'at', header: 'Thời điểm', width: pixel(170), renderCell: c => <Text type="body">{dateTimeVN(c.changedAt)}</Text>},
  ];

  return (
    <ReportShell
      title="Thống kê lịch sử giá bán"
      description="Giá bán thực tế trên phiếu xuất so với bảng giá hiện tại, và các lần thay đổi bảng giá."
      tu={salesTab ? tu : undefined}
      den={salesTab ? den : undefined}
      search={{value: query, onChange: setQuery, placeholder: salesTab ? 'Tìm theo phiếu, khách, sản phẩm…' : 'Tìm theo sản phẩm, người đổi…'}}
      filterCount={(product ? 1 : 0) + (salesTab && customer ? 1 : 0)}
      filters={
        <>
          <Selector label="Sản phẩm" placeholder="Tất cả sản phẩm" hasClear hasSearch value={product} onChange={(v: string | null) => setProduct(v)} options={data.products} />
          {salesTab && (
            <Selector label="Khách hàng" placeholder="Tất cả khách hàng" hasClear hasSearch value={customer} onChange={(v: string | null) => setCustomer(v)} options={data.customers} />
          )}
        </>
      }>
      <VStack gap={3}>
        <TabList value={tab} onChange={setTab} hasDivider>
          <Tab value="sales" label="Giá bán trên phiếu" />
          <Tab value="changes" label="Thay đổi bảng giá" />
        </TabList>
        {salesTab ? (
          <ReportTable<PriceLine>
            key={`l|${query}|${product}|${customer}`}
            rows={lines}
            columns={lineColumns}
            idKey="key"
            countLabel="dòng hàng"
            totals={[
              {label: 'Số dòng', value: qty(lines.length)},
              {label: 'Tổng số lượng', value: qty(totalQty)},
              {label: 'Chênh lệch bình quân so với bảng giá', value: pct(Math.round(avgDiff * 10) / 10), strong: true},
            ]}
          />
        ) : (
          <ReportTable<PriceChange>
            key={`c|${query}|${product}`}
            rows={changes}
            columns={changeColumns}
            idKey="id"
            countLabel="lần thay đổi"
            totals={[{label: 'Số lần thay đổi', value: qty(changes.length)}]}
          />
        )}
      </VStack>
    </ReportShell>
  );
}
