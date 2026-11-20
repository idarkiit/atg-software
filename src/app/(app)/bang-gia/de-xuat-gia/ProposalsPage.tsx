'use client';

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {useToast} from '@astryxdesign/core/Toast';
import {PlusIcon} from '@heroicons/react/24/outline';
import type {ProposalRow} from '@/server/pricing';
import {withdrawProposalAction} from '@/server/actions-pricing';
import {ProposalDialog, type ProposalProduct} from '../ProposalDialog';
import {formatDateTime, vnd} from '../format';

type Row = ProposalRow & Record<string, unknown>;

function StatusCell({status}: {status: string}) {
  const variant = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
  const label = status === 'approved' ? 'Đã duyệt' : status === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
  return (
    <HStack gap={1} vAlign="center">
      <StatusDot variant={variant} label={label} />
      <Text type="body" size="sm">{label}</Text>
    </HStack>
  );
}

export function ProposalsPage({
  rows,
  products,
  canCreate,
  showAll,
  currentUserId,
}: {
  rows: ProposalRow[];
  products: ProposalProduct[];
  canCreate: boolean;
  showAll: boolean;
  currentUserId: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [creating, setCreating] = useState(false);
  const [withdrawing, setWithdrawing] = useState<ProposalRow | null>(null);

  const shown = useMemo(() => (tab === 'all' ? rows : rows.filter(r => r.status === tab)), [rows, tab]) as Row[];

  const columns: TableColumn<Row>[] = [
    {key: 'code', header: 'Mã', width: pixel(130), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'product', header: 'Sản phẩm', width: proportional(2, {minWidth: 200}), renderCell: r => <Text type="body">{`${r.productCode} · ${r.productName}`}</Text>},
    {key: 'currentPrice1', header: 'Giá 1 hiện tại', width: pixel(130), align: 'end', renderCell: r => <Text type="body" color="secondary">{vnd(r.currentPrice1)}</Text>},
    {key: 'proposedPrice1', header: 'Đề xuất giá 1', width: pixel(130), align: 'end', renderCell: r => <Text type="body" weight="semibold">{vnd(r.proposedPrice1)}</Text>},
    {key: 'proposedPrice2', header: 'Đề xuất giá 2', width: pixel(130), align: 'end', renderCell: r => <Text type="body">{r.proposedPrice2 ? vnd(r.proposedPrice2) : '—'}</Text>},
    {key: 'proposedPrice3', header: 'Đề xuất giá 3', width: pixel(130), align: 'end', renderCell: r => <Text type="body">{r.proposedPrice3 ? vnd(r.proposedPrice3) : '—'}</Text>},
    {key: 'status', header: 'Trạng thái', width: pixel(130), renderCell: r => <StatusCell status={r.status} />},
    ...(showAll
      ? [{key: 'requestedByName', header: 'Người gửi', width: proportional(1, {minWidth: 110}), renderCell: (r: Row) => <Text type="body">{r.requestedByName ?? '—'}</Text>} satisfies TableColumn<Row>]
      : []),
    {key: 'reviewNote', header: 'Ghi chú duyệt', width: proportional(1, {minWidth: 140}), renderCell: r => <Text type="body" color="secondary">{r.reviewNote ?? r.reason ?? '—'}</Text>},
    {key: 'createdAt', header: 'Gửi lúc', width: pixel(140), renderCell: r => <Text type="body" size="sm">{formatDateTime(r.createdAt)}</Text>},
    {
      key: '__actions',
      header: '',
      width: pixel(56),
      renderCell: r =>
        r.status === 'pending' && r.requestedBy === currentUserId ? (
          <MoreMenu
            size="sm"
            label={`Thao tác với ${r.code}`}
            alignment="end"
            items={[{label: 'Rút đề xuất', variant: 'destructive' as const, onClick: () => setWithdrawing(r)}]}
          />
        ) : null,
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <HStack vAlign="center" hAlign="between" gap={3}>
              <VStack gap={1}>
                <Heading level={2}>Đề xuất giá bán</Heading>
                <Text type="body" color="secondary" size="sm">
                  {showAll ? 'Tất cả đề xuất giá bán. ' : 'Các đề xuất bạn đã gửi. '}
                  Giá bán chỉ đổi sau khi người có quyền duyệt ở Tính lãi giá bán.
                </Text>
              </VStack>
              {canCreate && (
                <Button label="Tạo đề xuất" variant="primary" icon={<Icon icon={PlusIcon} />} onClick={() => setCreating(true)} />
              )}
            </HStack>
            <TabList value={tab} onChange={setTab}>
              <Tab value="all" label="Tất cả" />
              <Tab value="pending" label="Chờ duyệt" />
              <Tab value="approved" label="Đã duyệt" />
              <Tab value="rejected" label="Từ chối" />
            </TabList>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            <Table<Row> data={shown} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" />
            <Text type="body" color="secondary" size="sm">{shown.length} đề xuất</Text>
          </VStack>
          {creating && (
            <ProposalDialog
              products={products}
              initialProductId={null}
              onClose={() => setCreating(false)}
              onSaved={message => {
                setCreating(false);
                toast({body: message});
                router.refresh();
              }}
            />
          )}
          <AlertDialog
            isOpen={!!withdrawing}
            onOpenChange={open => !open && setWithdrawing(null)}
            title={`Rút đề xuất ${withdrawing?.code ?? ''}?`}
            description="Đề xuất sẽ bị xóa và không còn xuất hiện ở màn hình duyệt."
            actionLabel="Rút đề xuất"
            cancelLabel="Giữ lại"
            actionVariant="destructive"
            onAction={async () => {
              if (!withdrawing) return;
              const result = await withdrawProposalAction(withdrawing.id);
              setWithdrawing(null);
              toast({body: result.message, type: result.ok ? 'info' : 'error'});
              if (result.ok) router.refresh();
            }}
          />
        </LayoutContent>
      }
    />
  );
}
