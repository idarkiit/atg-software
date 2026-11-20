'use client';

import {useMemo, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Grid} from '@astryxdesign/core/Grid';
import {Pagination} from '@astryxdesign/core/Pagination';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Banner} from '@astryxdesign/core/Banner';
import {useToast} from '@astryxdesign/core/Toast';
import {FunnelIcon} from '@heroicons/react/24/outline';
import type {PriceHistoryRow, SalePriceRow} from '@/server/pricing';
import {getPriceHistoryAction} from '@/server/actions-pricing';
import {ProposalDialog, type ProposalProduct} from '../ProposalDialog';
import {formatDateTime, vnd} from '../format';

type Row = SalePriceRow & Record<string, unknown>;
type HistRow = PriceHistoryRow & Record<string, unknown>;
type Option = {value: string; label: string};

const PAGE_SIZE = 20;

export function SalePricesPage({
  rows,
  groups,
  types,
  products,
  canPropose,
}: {
  rows: SalePriceRow[];
  groups: Option[];
  types: Option[];
  products: ProposalProduct[];
  canPropose: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [proposing, setProposing] = useState<number | null | undefined>(undefined);
  const [history, setHistory] = useState<{row: SalePriceRow; items: PriceHistoryRow[] | null} | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (groupId && String(r.groupId ?? '') !== groupId) return false;
      if (typeId && String(r.typeId) !== typeId) return false;
      return !q || `${r.code} ${r.name}`.toLowerCase().includes(q);
    });
  }, [rows, query, groupId, typeId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) as Row[];
  const filterCount = (groupId ? 1 : 0) + (typeId ? 1 : 0);

  const openHistory = (row: SalePriceRow) => {
    setHistory({row, items: null});
    startTransition(async () => {
      const items = await getPriceHistoryAction(row.id);
      setHistory({row, items});
    });
  };

  const priceColumn = (key: 'price1' | 'price2' | 'price3', header: string): TableColumn<Row> => ({
    key,
    header,
    width: pixel(130),
    align: 'end',
    renderCell: r => (
      <Text type="body" color={r[key] ? undefined : 'secondary'}>
        {vnd(r[key])}
      </Text>
    ),
  });

  const columns: TableColumn<Row>[] = [
    {key: 'code', header: 'SKU', width: pixel(120), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'name', header: 'Tên sản phẩm', width: proportional(2, {minWidth: 200}), renderCell: r => <Text type="body">{r.name}</Text>},
    {key: 'groupName', header: 'Nhóm', width: proportional(1, {minWidth: 120}), renderCell: r => <Text type="body">{r.groupName ?? '—'}</Text>},
    priceColumn('price1', 'Giá 1'),
    priceColumn('price2', 'Giá 2'),
    priceColumn('price3', 'Giá 3'),
    {
      key: 'updatedAt',
      header: 'Cập nhật lúc',
      width: pixel(140),
      renderCell: r => <Text type="body" size="sm">{formatDateTime(r.updatedAt)}</Text>,
    },
    {key: 'updatedByName', header: 'Cập nhật bởi', width: proportional(1, {minWidth: 110}), renderCell: r => <Text type="body" size="sm">{r.updatedByName ?? '—'}</Text>},
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
            ...(canPropose ? [{label: 'Đề xuất giá', onClick: () => setProposing(r.id)}] : []),
            {label: 'Lịch sử giá', onClick: () => openHistory(r)},
          ]}
        />
      ),
    },
  ];

  const historyColumns: TableColumn<HistRow>[] = [
    {key: 'changedAt', header: 'Thời gian', width: pixel(140), renderCell: h => <Text type="body" size="sm">{formatDateTime(h.changedAt)}</Text>},
    {key: 'price1', header: 'Giá 1', width: proportional(1, {minWidth: 100}), align: 'end', renderCell: h => <Text type="body">{vnd(h.price1)}</Text>},
    {key: 'price2', header: 'Giá 2', width: proportional(1, {minWidth: 100}), align: 'end', renderCell: h => <Text type="body">{vnd(h.price2)}</Text>},
    {key: 'price3', header: 'Giá 3', width: proportional(1, {minWidth: 100}), align: 'end', renderCell: h => <Text type="body">{vnd(h.price3)}</Text>},
    {key: 'proposalCode', header: 'Đề xuất', width: pixel(120), renderCell: h => <Text type="body" size="sm">{h.proposalCode ?? '—'}</Text>},
    {key: 'changedByName', header: 'Người đổi', width: proportional(1, {minWidth: 110}), renderCell: h => <Text type="body" size="sm">{h.changedByName ?? '—'}</Text>},
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Bảng giá bán</Heading>
              <Text type="body" color="secondary" size="sm">
                Giá không sửa trực tiếp ở đây: mọi thay đổi đi qua Đề xuất giá bán và được duyệt ở Tính lãi giá bán.
              </Text>
            </VStack>
            <HStack gap={2} vAlign="end">
              <TextInput
                label="Tìm kiếm"
                isLabelHidden
                type="search"
                value={query}
                onChange={v => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Tìm theo SKU, tên sản phẩm…"
                hasClear
              />
            </HStack>
            <Collapsible
              defaultIsOpen={false}
              chevronPosition="start"
              trigger={
                <HStack gap={1} vAlign="center">
                  <Icon icon={FunnelIcon} size="sm" />
                  <Text type="body" size="sm" weight="semibold">
                    {filterCount ? `Bộ lọc (${filterCount} đang áp dụng)` : 'Bộ lọc'}
                  </Text>
                </HStack>
              }>
              <Grid columns={{minWidth: 200}} gap={3}>
                <Selector
                  label="Nhóm sản phẩm"
                  options={groups}
                  value={groupId}
                  placeholder="Tất cả"
                  hasSearch
                  hasClear
                  onChange={(v: string | null) => {
                    setGroupId(v || null);
                    setPage(1);
                  }}
                />
                <Selector
                  label="Loại sản phẩm"
                  options={types}
                  value={typeId}
                  placeholder="Tất cả"
                  hasClear
                  onChange={(v: string | null) => {
                    setTypeId(v || null);
                    setPage(1);
                  }}
                />
                {filterCount > 0 && (
                  <Button
                    label="Xóa bộ lọc"
                    variant="ghost"
                    onClick={() => {
                      setGroupId(null);
                      setTypeId(null);
                    }}
                  />
                )}
              </Grid>
            </Collapsible>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            <Table<Row> data={pageRows} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" />
            <HStack hAlign="between" vAlign="center">
              <Text type="body" color="secondary" size="sm">{filtered.length} sản phẩm</Text>
              {pageCount > 1 && <Pagination page={currentPage} totalPages={pageCount} onChange={setPage} />}
            </HStack>
          </VStack>
          {proposing !== undefined && (
            <ProposalDialog
              products={products}
              initialProductId={proposing}
              onClose={() => setProposing(undefined)}
              onSaved={message => {
                setProposing(undefined);
                toast({body: message});
                router.refresh();
              }}
            />
          )}
          <Dialog isOpen={!!history} onOpenChange={open => !open && setHistory(null)} purpose="form" width={760}>
            {history && (
              <Layout
                header={
                  <DialogHeader
                    title="Lịch sử giá"
                    subtitle={`${history.row.code} · ${history.row.name}`}
                    onOpenChange={() => setHistory(null)}
                  />
                }
                content={
                  <LayoutContent>
                    {history.items === null ? (
                      <Text type="body" color="secondary">Đang tải…</Text>
                    ) : history.items.length === 0 ? (
                      <Banner status="info" title="Sản phẩm chưa có lần đổi giá nào." container="card" collapsible={false} />
                    ) : (
                      <Table<HistRow> data={history.items as HistRow[]} columns={historyColumns} idKey="id" density="compact" textOverflow="truncate" />
                    )}
                  </LayoutContent>
                }
                footer={
                  <LayoutFooter>
                    <HStack hAlign="end">
                      <Button label="Đóng" variant="secondary" onClick={() => setHistory(null)} />
                    </HStack>
                  </LayoutFooter>
                }
              />
            )}
          </Dialog>
        </LayoutContent>
      }
    />
  );
}
