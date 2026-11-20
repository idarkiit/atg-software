'use client';

// Shared view of "Thống kê phiếu xuất" and "Thống kê nhập hàng": vouchers grouped four ways.
import {useMemo, useState} from 'react';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Selector} from '@astryxdesign/core/Selector';
import {pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import type {DocKind} from '@/lib/stock/kinds';
import type {DocStats} from '@/server/reports';
import {DocLink} from './DocLink';
import {ReportShell, ReportTable, TotalsLine, type TotalItem} from './ReportShell';
import {dateVN, money, pct, qty} from './format';

type Mode = 'sale' | 'purchase';
type GroupBy = 'doc' | 'party' | 'staff' | 'product' | 'group';

type GRow = {
  key: string;
  label: string;
  sub: string;
  date: string;
  kind: DocKind | null;
  docId: number | null;
  docIds: number[];
  count: number;
  qty: number;
  value: number;
  alloc: number;
  cost: number;
};

const OPTIONS: Record<Mode, {value: GroupBy; label: string}[]> = {
  sale: [
    {value: 'doc', label: 'Theo phiếu'},
    {value: 'party', label: 'Theo khách hàng'},
    {value: 'staff', label: 'Theo nhân viên lập'},
    {value: 'product', label: 'Theo sản phẩm'},
  ],
  purchase: [
    {value: 'doc', label: 'Theo phiếu'},
    {value: 'party', label: 'Theo nhà cung cấp'},
    {value: 'product', label: 'Theo sản phẩm'},
    {value: 'group', label: 'Theo nhóm sản phẩm'},
  ],
};

export function DocStatsView({mode, data, tu, den}: {mode: Mode; data: DocStats; tu: string; den: string}) {
  const sale = mode === 'sale';
  const [groupBy, setGroupBy] = useState<GroupBy>('doc');
  const [query, setQuery] = useState('');
  const [partyFilter, setPartyFilter] = useState<string | null>(null);

  const partyOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of data.docs) if (d.partyId) m.set(d.partyId, d.partyName);
    return [...m].map(([id, name]) => ({value: String(id), label: name}));
  }, [data.docs]);

  const rows = useMemo<GRow[]>(() => {
    const docs = data.docs.filter(d => !partyFilter || String(d.partyId) === partyFilter);
    const docIds = new Set(docs.map(d => d.id));
    const out = new Map<string, GRow>();
    const bump = (key: string, label: string, add: Partial<GRow> & {docId: number}) => {
      const cur =
        out.get(key) ??
        ({key, label, sub: '', date: '', kind: null, docId: null, docIds: [], count: 0, qty: 0, value: 0, alloc: 0, cost: 0} as GRow);
      if (!cur.docIds.includes(add.docId)) {
        cur.docIds.push(add.docId);
        cur.count += 1;
      }
      cur.qty += add.qty ?? 0;
      cur.value += add.value ?? 0;
      cur.alloc += add.alloc ?? 0;
      cur.cost += add.cost ?? 0;
      out.set(key, cur);
    };
    if (groupBy === 'doc') {
      return docs.map(d => ({
        key: String(d.id),
        label: d.code,
        sub: sale ? d.partyName : d.partyName,
        date: d.date,
        kind: d.kind,
        docId: d.id,
        docIds: [d.id],
        count: 1,
        qty: d.qty,
        value: sale ? d.revenue : d.total,
        alloc: d.alloc,
        cost: d.cost,
      }));
    }
    if (groupBy === 'party' || groupBy === 'staff') {
      for (const d of docs) {
        const key = groupBy === 'party' ? `p${d.partyId ?? 0}` : `s${d.staffId ?? 0}`;
        bump(key, groupBy === 'party' ? d.partyName : d.staffName, {
          docId: d.id,
          qty: d.qty,
          value: sale ? d.revenue : d.total,
          alloc: d.alloc,
          cost: d.cost,
        });
      }
    } else {
      for (const l of data.lines) {
        if (!docIds.has(l.docId)) continue;
        const key = groupBy === 'product' ? `i${l.productId}` : `g${l.groupName}`;
        bump(key, groupBy === 'product' ? `${l.code} · ${l.name}` : l.groupName, {docId: l.docId, qty: l.qty, value: l.value, alloc: l.alloc, cost: l.cost});
      }
    }
    return [...out.values()].sort((a, b) => b.value - a.value);
  }, [data, groupBy, partyFilter, sale]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter(r => `${r.label} ${r.sub}`.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const sum = (f: (r: GRow) => number) => shown.reduce((s, r) => s + f(r), 0);
  const totalCount = new Set(shown.flatMap(r => r.docIds)).size;
  const tQty = sum(r => r.qty);
  const tValue = sum(r => r.value);
  const tAlloc = sum(r => r.alloc);
  const tCost = sum(r => r.cost);
  const profit = (v: number, c: number) => v - c;
  const ratio = (v: number, c: number) => (v ? ((v - c) / v) * 100 : 0);
  const ret = data.returns;

  const groupLabel = OPTIONS[mode].find(o => o.value === groupBy)!.label.replace('Theo ', '');
  const columns: TableColumn<GRow>[] = [];
  if (groupBy === 'doc') {
    columns.push(
      {key: 'code', header: 'Số phiếu', width: pixel(130), renderCell: r => <DocLink kind={r.kind!} id={r.docId} code={r.label} />},
      {key: 'date', header: 'Ngày', width: pixel(100), renderCell: r => <Text type="body">{dateVN(r.date)}</Text>},
      {key: 'party', header: sale ? 'Khách hàng' : 'Nhà cung cấp', width: proportional(2, {minWidth: 180}), renderCell: r => <Text type="body">{r.sub}</Text>},
    );
  } else {
    columns.push(
      {key: 'label', header: groupLabel.charAt(0).toUpperCase() + groupLabel.slice(1), width: proportional(2, {minWidth: 220}), renderCell: r => <Text type="body">{r.label}</Text>},
      {key: 'count', header: 'Số phiếu', align: 'end', width: pixel(90), renderCell: r => <Text type="body">{qty(r.count)}</Text>},
    );
  }
  columns.push({key: 'qty', header: 'Số lượng', align: 'end', renderCell: r => <Text type="body">{qty(r.qty)}</Text>});
  if (sale) {
    columns.push(
      {key: 'value', header: 'Doanh thu', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body">{money(r.value)}</Text>},
      {key: 'cost', header: 'Giá vốn', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body">{money(r.cost)}</Text>},
      {key: 'profit', header: 'Lãi gộp', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body" weight="semibold">{money(profit(r.value, r.cost))}</Text>},
      {key: 'pct', header: '% lãi', align: 'end', width: pixel(80), renderCell: r => <Text type="body">{pct(ratio(r.value, r.cost))}</Text>},
    );
  } else {
    columns.push(
      {key: 'value', header: 'Giá trị', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body">{money(r.value)}</Text>},
      {key: 'alloc', header: 'Chi phí phân bổ', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body">{money(r.alloc)}</Text>},
      {key: 'cost', header: 'Giá vốn', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body" weight="semibold">{money(r.cost)}</Text>},
    );
  }

  const totals: TotalItem[] = sale
    ? [
        {label: 'Số phiếu', value: qty(totalCount)},
        {label: 'Số lượng', value: qty(tQty)},
        {label: 'Doanh thu', value: money(tValue)},
        {label: 'Giá vốn', value: money(tCost)},
        {label: 'Lãi gộp', value: money(profit(tValue, tCost)), strong: true},
        {label: '% lãi', value: pct(ratio(tValue, tCost))},
      ]
    : [
        {label: 'Số phiếu', value: qty(totalCount)},
        {label: 'Số lượng', value: qty(tQty)},
        {label: 'Giá trị', value: money(tValue)},
        {label: 'Chi phí phân bổ', value: money(tAlloc)},
        {label: 'Giá vốn', value: money(tCost), strong: true},
      ];

  const returnTotals: TotalItem[] = sale
    ? [
        {label: 'Trừ hàng trả lại', value: `${qty(ret.count)} phiếu`},
        {label: 'Số lượng', value: qty(-ret.qty)},
        {label: 'Doanh thu', value: money(-ret.value)},
        {label: 'Giá vốn', value: money(-ret.cost)},
        {label: 'Doanh thu sau trả hàng', value: money(tValue - ret.value), strong: true},
        {label: 'Lãi gộp sau trả hàng', value: money(profit(tValue - ret.value, tCost - ret.cost)), strong: true},
      ]
    : [
        {label: 'Trừ hàng trả lại', value: `${qty(ret.count)} phiếu`},
        {label: 'Số lượng', value: qty(-ret.qty)},
        {label: 'Giá trị', value: money(-ret.value)},
        {label: 'Giá vốn', value: money(-ret.cost)},
        {label: 'Giá trị nhập thực', value: money(tValue - ret.value), strong: true},
        {label: 'Giá vốn thực', value: money(tCost - ret.cost), strong: true},
      ];

  return (
    <ReportShell
      title={sale ? 'Thống kê phiếu xuất' : 'Thống kê nhập hàng'}
      description={
        sale
          ? 'Phiếu xuất bán và xuất VAT đã ghi sổ trong kỳ. Doanh thu chưa gồm VAT.'
          : 'Phiếu nhập đã ghi sổ trong kỳ; giá vốn đã gồm chi phí phân bổ. Hàng trả lại NCC được trừ ở dòng tổng.'
      }
      tu={tu}
      den={den}
      toolbar={
        <SegmentedControl label="Nhóm theo" value={groupBy} onChange={v => setGroupBy(v as GroupBy)}>
          {OPTIONS[mode].map(o => (
            <SegmentedControlItem key={o.value} value={o.value} label={o.label} />
          ))}
        </SegmentedControl>
      }
      search={{value: query, onChange: setQuery, placeholder: 'Tìm theo số phiếu, tên…'}}
      filterCount={partyFilter ? 1 : 0}
      filters={
        <Selector
          label={sale ? 'Khách hàng' : 'Nhà cung cấp'}
          placeholder="Tất cả"
          hasClear
          hasSearch
          value={partyFilter}
          onChange={(v: string | null) => setPartyFilter(v)}
          options={partyOptions}
        />
      }>
      <VStack gap={3}>
        <ReportTable<GRow>
          key={`${groupBy}|${query}|${partyFilter}`}
          rows={shown}
          columns={columns}
          idKey="key"
          countLabel="dòng"
          totals={totals}
          note={
            <>
              <TotalsLine items={returnTotals} />
              {(groupBy === 'product' || groupBy === 'group') && (
                <Text type="body" size="sm" color="secondary">
                  Theo sản phẩm tính trên thành tiền từng dòng hàng, chưa trừ giảm giá cả phiếu và VAT nên có thể lệch với tổng theo phiếu.
                </Text>
              )}
            </>
          }
        />
      </VStack>
    </ReportShell>
  );
}
