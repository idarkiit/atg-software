'use client';

import {useMemo, useState, useTransition} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Link} from '@astryxdesign/core/Link';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Grid} from '@astryxdesign/core/Grid';
import {Pagination} from '@astryxdesign/core/Pagination';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {PlusIcon} from '@heroicons/react/24/outline';
import {DOC_KINDS, type DocKind} from '@/lib/stock/kinds';
import type {DocListRow} from '@/server/stock';
import {CancelDocDialog} from './CancelDocDialog';
import {fmtDate, fmtMoney, fmtQty, type ISODate} from './format';

type Props = {
  kind: DocKind;
  route: string;
  rows: DocListRow[];
  from: string;
  to: string;
  perms: {create: boolean; delete: boolean};
};

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  {value: 'all', label: 'Tất cả trạng thái'},
  {value: 'posted', label: 'Đã ghi sổ'},
  {value: 'cancelled', label: 'Đã hủy'},
];

function remaining(r: DocListRow) {
  return Math.max(0, r.total - r.paidAmount - r.paidLater);
}

export function DocListPage({kind, route, rows, from, to, perms}: Props) {
  const def = DOC_KINDS[kind];
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<DocListRow | null>(null);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  const applyRange = (nextFrom: string | undefined, nextTo: string | undefined) => {
    const params = new URLSearchParams();
    if (nextFrom) params.set('tu', nextFrom);
    if (nextTo) params.set('den', nextTo);
    setPage(1);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      return [r.code, r.partyName, r.partyCode, r.invoiceNo, r.typeName, r.warehouseName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, status]);

  const posted = filtered.filter(r => r.status === 'posted');
  const sums = {
    qty: posted.reduce((s, r) => s + r.totalQty, 0),
    amount: posted.reduce((s, r) => s + (def.priced ? r.total : r.costTotal), 0),
    paid: posted.reduce((s, r) => s + r.paidAmount + r.paidLater, 0),
    debt: posted.reduce((s, r) => s + remaining(r), 0),
  };

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: TableColumn<DocListRow>[] = [
    {
      key: 'code',
      header: 'Số phiếu',
      width: pixel(130),
      renderCell: r => <Link href={`${route}/${r.id}`}>{r.code}</Link>,
    },
    {key: 'docDate', header: 'Ngày', width: pixel(100), renderCell: r => <Text type="body">{fmtDate(r.docDate)}</Text>},
    {
      key: 'party',
      header: def.direction === 'transfer' ? 'Kho đi → Kho đến' : def.party ? partyLabel(def.party) : 'Đối tượng',
      width: proportional(2, {minWidth: 170}),
      renderCell: r => (
        <Text type="body">
          {def.direction === 'transfer' ? `${r.warehouseName} → ${r.toWarehouseName ?? '—'}` : (r.partyName ?? '—')}
        </Text>
      ),
    },
    ...(def.direction === 'transfer'
      ? []
      : [{key: 'warehouse', header: 'Kho', width: proportional(1, {minWidth: 110}), renderCell: (r: DocListRow) => <Text type="body">{r.warehouseName}</Text>}]),
    {key: 'type', header: 'Loại', width: proportional(1, {minWidth: 110}), renderCell: r => <Text type="body">{r.typeName ?? '—'}</Text>},
    {key: 'qty', header: 'Số lượng', width: pixel(90), align: 'end', renderCell: r => <Text type="body">{fmtQty(r.totalQty)}</Text>},
    {
      key: 'amount',
      header: def.priced ? 'Tổng tiền' : 'Giá vốn',
      width: pixel(130),
      align: 'end',
      renderCell: r => <Text type="body">{fmtMoney(def.priced ? r.total : r.costTotal)}</Text>,
    },
    ...(def.payment
      ? [
          {
            key: 'paid',
            header: 'Đã trả',
            width: pixel(120),
            align: 'end' as const,
            renderCell: (r: DocListRow) => <Text type="body">{fmtMoney(r.paidAmount + r.paidLater)}</Text>,
          },
          {
            key: 'debt',
            header: 'Còn nợ',
            width: pixel(120),
            align: 'end' as const,
            renderCell: (r: DocListRow) => <Text type="body">{r.status === 'cancelled' ? '—' : fmtMoney(remaining(r))}</Text>,
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Trạng thái',
      width: pixel(130),
      renderCell: r =>
        r.status === 'posted' ? (
          <HStack gap={1} vAlign="center">
            <StatusDot variant="success" label="Đã ghi sổ" />
            <Text type="body" size="sm">Đã ghi sổ</Text>
          </HStack>
        ) : (
          <HStack gap={1} vAlign="center">
            <StatusDot variant="neutral" label="Đã hủy" />
            <Text type="body" size="sm">Đã hủy</Text>
          </HStack>
        ),
    },
    {
      key: '__actions',
      header: '',
      width: pixel(56),
      renderCell: r => (
        <MoreMenu
          size="sm"
          label={`Thao tác với ${r.code}`}
          alignment="end"
          items={[
            {label: 'Xem / In', onClick: () => router.push(`${route}/${r.id}`)},
            ...(perms.delete && r.status === 'posted'
              ? [{type: 'divider' as const}, {label: 'Hủy phiếu', variant: 'destructive' as const, onClick: () => setCancelling(r)}]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <HStack vAlign="center" hAlign="between" gap={3}>
              <VStack gap={1}>
                <Heading level={2}>{def.title}</Heading>
                <Text type="body" color="secondary" size="sm">
                  {def.description}
                </Text>
              </VStack>
              {perms.create && (
                <Button
                  label={`Tạo ${def.noun}`}
                  variant="primary"
                  icon={<Icon icon={PlusIcon} />}
                  href={`${route}/moi`}
                />
              )}
            </HStack>
            <Grid columns={{minWidth: 180}} gap={3}>
              <DateInput
                label="Từ ngày"
                value={fromValue as ISODate}
                max={toValue as ISODate}
                onChange={v => {
                  if (!v) return;
                  setFromValue(v);
                  applyRange(v, toValue);
                }}
              />
              <DateInput
                label="Đến ngày"
                value={toValue as ISODate}
                min={fromValue as ISODate}
                onChange={v => {
                  if (!v) return;
                  setToValue(v);
                  applyRange(fromValue, v);
                }}
              />
              <TextInput
                label="Tìm kiếm"
                type="search"
                value={query}
                onChange={v => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Số phiếu, đối tượng, số hóa đơn…"
                hasClear
              />
              <Selector
                label="Trạng thái"
                options={STATUS_OPTIONS}
                value={status}
                onChange={(v: string) => {
                  setStatus(v || 'all');
                  setPage(1);
                }}
              />
            </Grid>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            <Table<DocListRow> data={pageRows} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" />
            <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
              <Text type="body" color="secondary" size="sm">
                {filtered.length} phiếu · {posted.length} đã ghi sổ
              </Text>
              <Text type="body" size="sm" weight="semibold">
                {`Tổng (phiếu đã ghi sổ): ${fmtQty(sums.qty)} SL · ${def.priced ? 'Tiền' : 'Giá vốn'} ${fmtMoney(sums.amount)}${
                  def.payment ? ` · Đã trả ${fmtMoney(sums.paid)} · Còn nợ ${fmtMoney(sums.debt)}` : ''
                }`}
              </Text>
            </HStack>
            {pageCount > 1 && (
              <HStack hAlign="end">
                <Pagination page={currentPage} totalPages={pageCount} onChange={setPage} />
              </HStack>
            )}
          </VStack>
          {cancelling && (
            <CancelDocDialog
              doc={cancelling}
              onClose={() => setCancelling(null)}
              onCancelled={() => {
                setCancelling(null);
                router.refresh();
              }}
            />
          )}
        </LayoutContent>
      }
    />
  );
}

function partyLabel(p: 'customer' | 'supplier' | 'employee') {
  return p === 'customer' ? 'Khách hàng' : p === 'supplier' ? 'Nhà cung cấp' : 'Nhân viên nhận';
}
