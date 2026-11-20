'use client';

import {useMemo, useState} from 'react';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Link} from '@astryxdesign/core/Link';
import {Selector} from '@astryxdesign/core/Selector';
import {Switch} from '@astryxdesign/core/Switch';
import {pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import type {StockReport, StockRow} from '@/server/reports';
import {ReportShell, ReportTable} from '@/components/reports/ReportShell';
import {StockCardDialog} from '@/components/reports/LedgerDialogs';
import {money, qty} from '@/components/reports/format';

export function TonKhoPage({data, tu, den}: {data: StockReport; tu: string; den: string}) {
  const [query, setQuery] = useState('');
  const [warehouse, setWarehouse] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [onlyStock, setOnlyStock] = useState(false);
  const [merge, setMerge] = useState(false);
  const [card, setCard] = useState<StockRow | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data.rows.filter(r => {
      if (warehouse && String(r.warehouseId) !== warehouse) return false;
      if (group && String(r.groupId ?? '') !== group) return false;
      if (type && String(r.typeId) !== type) return false;
      if (q && !`${r.code} ${r.name} ${r.warehouseName}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (merge && !warehouse) {
      const by = new Map<number, StockRow>();
      for (const r of list) {
        const cur = by.get(r.productId);
        if (!cur) by.set(r.productId, {...r, key: String(r.productId), warehouseId: 0, warehouseName: 'Tất cả kho'});
        else {
          cur.opening += r.opening;
          cur.inQty += r.inQty;
          cur.outQty += r.outQty;
          cur.closing += r.closing;
          cur.closingValue += r.closingValue;
        }
      }
      list = [...by.values()].map(r => ({...r, avgCost: r.closing > 0 ? Math.round(r.closingValue / r.closing) : 0}));
    }
    if (onlyStock) list = list.filter(r => r.closing > 0);
    return list;
  }, [data.rows, query, warehouse, group, type, onlyStock, merge]);

  const filterCount = [warehouse, group, type].filter(Boolean).length + (onlyStock ? 1 : 0) + (merge ? 1 : 0);
  const sum = (f: (r: StockRow) => number) => rows.reduce((s, r) => s + f(r), 0);

  const columns: TableColumn<StockRow>[] = [
    {
      key: 'code',
      header: 'SKU',
      width: pixel(105),
      renderCell: r => (
        <Link onClick={() => setCard(r)}>{r.code}</Link>
      ),
    },
    {key: 'name', header: 'Tên sản phẩm', width: proportional(2, {minWidth: 140}), renderCell: r => <Text type="body">{r.name}</Text>},
    {key: 'unit', header: 'ĐVT', width: pixel(55), renderCell: r => <Text type="body">{r.unit}</Text>},
    {key: 'wh', header: 'Kho', width: proportional(1, {minWidth: 100}), renderCell: r => <Text type="body">{r.warehouseName}</Text>},
    {key: 'opening', header: 'Tồn đầu kỳ', align: 'end', renderCell: r => <Text type="body">{qty(r.opening)}</Text>},
    {key: 'in', header: 'Nhập trong kỳ', align: 'end', renderCell: r => <Text type="body">{qty(r.inQty)}</Text>},
    {key: 'out', header: 'Xuất trong kỳ', align: 'end', renderCell: r => <Text type="body">{qty(r.outQty)}</Text>},
    {key: 'closing', header: 'Tồn cuối kỳ', align: 'end', renderCell: r => <Text type="body" weight="semibold">{qty(r.closing)}</Text>},
    {key: 'avg', header: 'Giá vốn BQ', align: 'end', width: proportional(1, {minWidth: 95}), renderCell: r => <Text type="body">{money(r.avgCost)}</Text>},
    {key: 'value', header: 'Giá trị tồn cuối', align: 'end', width: proportional(1, {minWidth: 110}), renderCell: r => <Text type="body" weight="semibold">{money(r.closingValue)}</Text>},
  ];

  return (
    <ReportShell
      title="Thống kê tồn kho"
      description="Tồn đầu kỳ, nhập, xuất và tồn cuối kỳ theo sản phẩm và kho của chi nhánh đang làm việc."
      tu={tu}
      den={den}
      search={{value: query, onChange: setQuery, placeholder: 'Tìm theo SKU, tên sản phẩm, kho…'}}
      filterCount={filterCount}
      filters={
        <>
          <Selector label="Kho" placeholder="Tất cả kho của chi nhánh" hasClear value={warehouse} onChange={(v: string | null) => setWarehouse(v)} options={data.warehouses} />
          <Selector label="Nhóm sản phẩm" placeholder="Tất cả nhóm" hasClear hasSearch value={group} onChange={(v: string | null) => setGroup(v)} options={data.groups} />
          <Selector label="Loại sản phẩm" placeholder="Tất cả loại" hasClear value={type} onChange={(v: string | null) => setType(v)} options={data.types} />
          <Switch label="Chỉ hiện còn tồn" value={onlyStock} onChange={setOnlyStock} />
          <Switch label="Gộp các kho" description="Một dòng cho mỗi sản phẩm" value={merge} onChange={setMerge} />
        </>
      }>
      <VStack gap={3}>
        <ReportTable<StockRow>
          key={`${query}|${warehouse}|${group}|${type}|${onlyStock}|${merge}`}
          rows={rows}
          columns={columns}
          idKey="key"
          countLabel="dòng"
          totals={[
            {label: 'Tồn đầu kỳ', value: qty(sum(r => r.opening))},
            {label: 'Nhập', value: qty(sum(r => r.inQty))},
            {label: 'Xuất', value: qty(sum(r => r.outQty))},
            {label: 'Tồn cuối kỳ', value: qty(sum(r => r.closing)), strong: true},
            {label: 'Giá trị tồn cuối', value: money(sum(r => r.closingValue)), strong: true},
          ]}
        />
      </VStack>
      {card && (
        <StockCardDialog
          productId={card.productId}
          productLabel={`${card.code} · ${card.name}`}
          warehouseId={card.warehouseId || null}
          warehouseLabel={card.warehouseId ? card.warehouseName : 'Tất cả kho của chi nhánh'}
          tu={tu}
          den={den}
          onClose={() => setCard(null)}
        />
      )}
    </ReportShell>
  );
}
