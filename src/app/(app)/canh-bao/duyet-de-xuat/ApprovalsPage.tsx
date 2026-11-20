'use client';

import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Banner} from '@astryxdesign/core/Banner';
import {useToast} from '@astryxdesign/core/Toast';
import type {ProposalView} from '@/server/proposals';
import {reviewAction} from '@/server/actions';

type Row = ProposalView & Record<string, unknown>;
type Change = ProposalView['changes'][number] & Record<string, unknown>;

const dateTime = new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'short'});

function actionLabel(p: ProposalView) {
  if (p.kind === 'draft') return 'Hồ sơ nháp';
  return p.action === 'create' ? 'Thêm mới' : 'Sửa thông tin';
}

function StatusCell({status}: {status: string}) {
  const v = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
  const label = status === 'approved' ? 'Đã duyệt' : status === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
  return (
    <HStack gap={1} vAlign="center">
      <StatusDot variant={v} label={label} />
      <Text type="body" size="sm">{label}</Text>
    </HStack>
  );
}

export function ApprovalsPage({items, currentUserId}: {items: ProposalView[]; currentUserId: number}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<ProposalView | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();

  const rows = items.filter(i =>
    tab === 'pending' ? i.status === 'pending' : tab === 'done' ? i.status !== 'pending' : i.requestedById === currentUserId,
  ) as Row[];

  const close = () => {
    setSelected(null);
    setRejecting(false);
    setNote('');
  };

  const review = (approve: boolean) => {
    if (!selected) return;
    startTransition(async () => {
      const result = await reviewAction(selected.kind, selected.resource, selected.id, approve, note.trim() || undefined);
      toast({body: result.message, type: result.ok ? 'info' : 'error'});
      if (result.ok) {
        close();
        router.refresh();
      }
    });
  };

  const columns: TableColumn<Row>[] = [
    {
      key: 'code',
      header: 'Mã đề xuất',
      width: pixel(130),
      renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>,
    },
    {key: 'resourceTitle', header: 'Chức năng', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body">{r.resourceTitle}</Text>},
    {
      key: 'record',
      header: 'Bản ghi',
      width: proportional(2, {minWidth: 160}),
      renderCell: r => <Text type="body">{[r.recordCode, r.recordLabel].filter(Boolean).join(' · ') || '—'}</Text>,
    },
    {key: 'action', header: 'Loại', width: pixel(130), renderCell: r => <Text type="body">{actionLabel(r)}</Text>},
    {key: 'requestedByName', header: 'Người gửi', width: proportional(1, {minWidth: 110}), renderCell: r => <Text type="body">{r.requestedByName ?? '—'}</Text>},
    {key: 'createdAt', header: 'Thời gian', width: pixel(150), renderCell: r => <Text type="body">{dateTime.format(new Date(r.createdAt))}</Text>},
    {key: 'status', header: 'Trạng thái', width: pixel(130), renderCell: r => <StatusCell status={r.status} />},
    {
      key: '__open',
      header: '',
      width: pixel(90),
      renderCell: r => <Button label="Xem" size="sm" variant="secondary" onClick={() => setSelected(r)} />,
    },
  ];

  const changeColumns: TableColumn<Change>[] = selected?.kind === 'draft'
    ? [
        {key: 'label', header: 'Trường', width: proportional(1, {minWidth: 140}), renderCell: c => <Text type="body" weight="semibold">{c.label}</Text>},
        {key: 'after', header: 'Giá trị', width: proportional(2, {minWidth: 180}), renderCell: c => <Text type="body">{c.after}</Text>},
      ]
    : [
        {key: 'label', header: 'Trường', width: proportional(1, {minWidth: 120}), renderCell: c => <Text type="body" weight="semibold">{c.label}</Text>},
        {key: 'before', header: 'Trước', width: proportional(1, {minWidth: 120}), renderCell: c => <Text type="body" color="secondary">{c.before}</Text>},
        {key: 'after', header: 'Sau', width: proportional(1, {minWidth: 120}), renderCell: c => <Text type="body">{c.after}</Text>},
      ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Duyệt đề xuất</Heading>
              <Text type="body" color="secondary" size="sm">
                Các thay đổi và hồ sơ nháp đang chờ người có quyền duyệt.
              </Text>
            </VStack>
            <TabList value={tab} onChange={setTab}>
              <Tab value="pending" label="Chờ duyệt" />
              <Tab value="done" label="Đã xử lý" />
              <Tab value="mine" label="Của tôi gửi" />
            </TabList>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            <Table<Row> data={rows} columns={columns} idKey={r => `${r.kind}-${r.id}`} hasHover density="compact" textOverflow="truncate" />
            <Text type="body" color="secondary" size="sm">{rows.length} mục</Text>
          </VStack>
          <Dialog isOpen={!!selected} onOpenChange={open => !open && close()} purpose="form" width={720}>
            {selected && (
              <Layout
                header={
                  <DialogHeader
                    title={`${selected.code} · ${selected.resourceTitle}`}
                    subtitle={`${actionLabel(selected)} · ${selected.requestedByName ?? '—'} · ${dateTime.format(new Date(selected.createdAt))}`}
                    onOpenChange={() => close()}
                  />
                }
                content={
                  <LayoutContent>
                    <VStack gap={4}>
                      <HStack gap={2} vAlign="center">
                        <StatusCell status={selected.status} />
                        <Text type="body" color="secondary" size="sm">
                          {[selected.recordCode, selected.recordLabel].filter(Boolean).join(' · ')}
                        </Text>
                      </HStack>
                      <Table<Change> data={selected.changes as Change[]} columns={changeColumns} idKey="field" density="compact" />
                      {selected.reason && (
                        <VStack gap={1}>
                          <Text type="label">Lý do</Text>
                          <Text type="body">{selected.reason}</Text>
                        </VStack>
                      )}
                      {rejecting && (
                        <VStack gap={2}>
                          <Banner status="warning" title="Từ chối đề xuất này?" container="card" collapsible={false} />
                          <TextArea label="Ghi chú từ chối (không bắt buộc)" value={note} onChange={setNote} />
                        </VStack>
                      )}
                    </VStack>
                  </LayoutContent>
                }
                footer={
                  <LayoutFooter>
                    <HStack gap={2} hAlign="end">
                      <Button label="Đóng" variant="secondary" onClick={close} />
                      {selected.canApprove && !rejecting && (
                        <Button label="Từ chối" variant="destructive" onClick={() => setRejecting(true)} />
                      )}
                      {selected.canApprove && rejecting && (
                        <Button label="Xác nhận từ chối" variant="destructive" isLoading={isPending} onClick={() => review(false)} />
                      )}
                      {selected.canApprove && !rejecting && (
                        <Button label="Duyệt" variant="primary" isLoading={isPending} onClick={() => review(true)} />
                      )}
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
