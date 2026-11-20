'use client';

import {useMemo, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Token} from '@astryxdesign/core/Token';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Grid} from '@astryxdesign/core/Grid';
import {Banner} from '@astryxdesign/core/Banner';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {useToast} from '@astryxdesign/core/Toast';
import type {ReviewRow} from '@/server/pricing';
import {approveProposalAction, rejectProposalAction} from '@/server/actions-pricing';
import {formatDateTime, percent, vnd} from '../format';

type Row = ReviewRow & Record<string, unknown>;

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

const COST_SOURCE = {
  avg: 'từ Bảng giá trung bình (giá TB + chi phí)',
  stock: 'bình quân theo kho',
  none: 'chưa có dữ liệu giá vốn',
} as const;

export function ReviewPage({rows, canApprove}: {rows: ReviewRow[]; canApprove: boolean}) {
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<ReviewRow | null>(null);

  const shown = useMemo(
    () => rows.filter(r => (tab === 'pending' ? r.status === 'pending' : r.status !== 'pending')),
    [rows, tab],
  ) as Row[];

  const columns: TableColumn<Row>[] = [
    {key: 'code', header: 'Mã', width: pixel(130), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'product', header: 'Sản phẩm', width: proportional(2, {minWidth: 200}), renderCell: r => <Text type="body">{`${r.productCode} · ${r.productName}`}</Text>},
    {key: 'currentPrice1', header: 'Giá 1 hiện tại', width: pixel(130), align: 'end', renderCell: r => <Text type="body" color="secondary">{vnd(r.currentPrice1)}</Text>},
    {key: 'proposedPrice1', header: 'Đề xuất giá 1', width: pixel(130), align: 'end', renderCell: r => <Text type="body" weight="semibold">{vnd(r.proposedPrice1)}</Text>},
    {key: 'defaultCost', header: 'Giá vốn', width: pixel(130), align: 'end', renderCell: r => <Text type="body">{vnd(r.status === 'pending' ? r.defaultCost : (r.costBasis ?? r.defaultCost))}</Text>},
    {key: 'requestedByName', header: 'Người gửi', width: proportional(1, {minWidth: 110}), renderCell: r => <Text type="body">{r.requestedByName ?? '—'}</Text>},
    {key: 'createdAt', header: 'Gửi lúc', width: pixel(140), renderCell: r => <Text type="body" size="sm">{formatDateTime(r.createdAt)}</Text>},
    {key: 'status', header: 'Trạng thái', width: pixel(130), renderCell: r => <StatusCell status={r.status} />},
    {
      key: '__open',
      header: '',
      width: pixel(110),
      renderCell: r => (
        <Button
          label={r.status === 'pending' && canApprove ? 'Tính lãi' : 'Xem'}
          size="sm"
          variant="secondary"
          onClick={() => setSelected(r)}
        />
      ),
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Tính lãi giá bán</Heading>
              <Text type="body" color="secondary" size="sm">
                Xem lãi gộp của giá đề xuất rồi duyệt để cập nhật Bảng giá bán, hoặc từ chối kèm lý do.
              </Text>
            </VStack>
            <TabList value={tab} onChange={setTab}>
              <Tab value="pending" label="Chờ duyệt" />
              <Tab value="done" label="Đã xử lý" />
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
          {selected && <ReviewDialog row={selected} canApprove={canApprove} onClose={() => setSelected(null)} />}
        </LayoutContent>
      }
    />
  );
}

type Level = {key: 'price1' | 'price2' | 'price3'; label: string; current: number; proposed: number | null};
type LevelRow = {id: string; level: Level; price: number | null} & Record<string, unknown>;

function ReviewDialog({row, canApprove, onClose}: {row: ReviewRow; canApprove: boolean; onClose: () => void}) {
  const router = useRouter();
  const toast = useToast();
  const isPendingRow = row.status === 'pending';
  const editable = isPendingRow && canApprove;
  const [price1, setPrice1] = useState<number | null>(isPendingRow ? row.proposedPrice1 : row.approvedPrice1);
  const [price2, setPrice2] = useState<number | null>(isPendingRow ? row.proposedPrice2 : row.approvedPrice2);
  const [price3, setPrice3] = useState<number | null>(isPendingRow ? row.proposedPrice3 : row.approvedPrice3);
  const [otherCost, setOtherCost] = useState<number | null>(isPendingRow ? 0 : (row.otherCost ?? 0));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const costBasis = isPendingRow ? row.defaultCost : (row.costBasis ?? row.defaultCost);
  const unitCost = costBasis + (otherCost ?? 0);

  const levels: Level[] = [
    {key: 'price1', label: 'Giá 1', current: row.currentPrice1, proposed: row.proposedPrice1},
    {key: 'price2', label: 'Giá 2', current: row.currentPrice2, proposed: row.proposedPrice2},
    {key: 'price3', label: 'Giá 3', current: row.currentPrice3, proposed: row.proposedPrice3},
  ];
  const values = {price1, price2, price3};
  const setters = {price1: setPrice1, price2: setPrice2, price3: setPrice3};
  const data: LevelRow[] = levels.map(l => ({id: l.key, level: l, price: values[l.key]}));

  /** An empty price 2 or 3 keeps the current price. */
  const effective = (l: Level) => values[l.key] || (l.key === 'price1' ? 0 : l.current);

  const columns: TableColumn<LevelRow>[] = [
    {key: 'label', header: 'Mức giá', width: pixel(90), renderCell: r => <Text type="body" weight="semibold">{r.level.label}</Text>},
    {key: 'current', header: 'Hiện tại', width: pixel(130), align: 'end', renderCell: r => <Text type="body" color="secondary">{vnd(r.level.current)}</Text>},
    {key: 'proposed', header: 'Đề xuất', width: pixel(130), align: 'end', renderCell: r => <Text type="body">{r.level.proposed ? vnd(r.level.proposed) : '—'}</Text>},
    {
      key: 'price',
      header: 'Giá bán mới',
      width: pixel(190),
      align: 'end',
      renderCell: r =>
        editable ? (
          <NumberInput
            label={`Giá bán mới ${r.level.label}`}
            isLabelHidden
            size="sm"
            value={values[r.level.key]}
            onChange={v => setters[r.level.key](v)}
            min={0}
            step={1000}
            hasClear
            placeholder={r.level.key === 'price1' ? 'Bắt buộc' : 'Giữ giá cũ'}
          />
        ) : (
          <Text type="body">{values[r.level.key] ? vnd(values[r.level.key]) : '—'}</Text>
        ),
    },
    {
      key: 'profit',
      header: 'Lãi/đơn vị',
      width: pixel(160),
      align: 'end',
      renderCell: r => {
        const price = effective(r.level);
        if (!price) return <Text type="body" color="secondary">—</Text>;
        const profit = price - unitCost;
        return <Token size="sm" color={profit < 0 ? 'red' : 'green'} label={vnd(profit)} />;
      },
    },
    {
      key: 'margin',
      header: 'Biên lãi',
      width: pixel(110),
      align: 'end',
      renderCell: r => {
        const price = effective(r.level);
        if (!price) return <Text type="body" color="secondary">—</Text>;
        const margin = ((price - unitCost) / price) * 100;
        return <Token size="sm" color={margin < 0 ? 'red' : 'green'} label={percent(margin)} />;
      },
    },
  ];

  const run = (fn: () => Promise<{ok: boolean; message: string}>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast({body: result.message});
        onClose();
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });

  const approve = () => {
    if (!price1 || price1 <= 0) return setMessage('Giá bán mới 1 phải lớn hơn 0.');
    setMessage(null);
    run(() => approveProposalAction({id: row.id, price1, price2, price3, costBasis, otherCost}));
  };

  const reject = () => {
    if (!note.trim()) return setMessage('Vui lòng nhập lý do từ chối.');
    setMessage(null);
    run(() => rejectProposalAction(row.id, note));
  };

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="form" width={820}>
      <Layout
        header={
          <DialogHeader
            title={`${row.code} · ${row.productCode} ${row.productName}`}
            subtitle={`${row.requestedByName ?? '—'} · ${formatDateTime(row.createdAt)}`}
            onOpenChange={() => onClose()}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              {message && <Banner status="error" title={message} container="card" collapsible={false} />}
              <HStack gap={2} vAlign="center">
                <StatusCell status={row.status} />
                {row.reason && <Text type="body" color="secondary" size="sm">{`Lý do đề xuất: ${row.reason}`}</Text>}
              </HStack>
              <Grid columns={{minWidth: 240, max: 2}} gap={4}>
                <VStack gap={1}>
                  <Text type="label">Giá vốn</Text>
                  <Text type="body" weight="semibold">{vnd(costBasis)}</Text>
                  <Text type="body" color="secondary" size="sm">{COST_SOURCE[row.costSource]}</Text>
                </VStack>
                {editable ? (
                  <NumberInput
                    label="Chi phí khác/đơn vị"
                    value={otherCost}
                    onChange={setOtherCost}
                    min={0}
                    step={1000}
                    hasClear
                    placeholder="VNĐ"
                  />
                ) : (
                  <VStack gap={1}>
                    <Text type="label">Chi phí khác/đơn vị</Text>
                    <Text type="body" weight="semibold">{vnd(otherCost ?? 0)}</Text>
                  </VStack>
                )}
              </Grid>
              <Table<LevelRow> data={data} columns={columns} idKey="id" density="compact" />
              {editable && (
                <Text type="body" color="secondary" size="sm">
                  Để trống giá 2 hoặc giá 3 thì giữ nguyên giá hiện tại.
                </Text>
              )}
              {!isPendingRow && row.reviewNote && (
                <VStack gap={1}>
                  <Text type="label">{`Ghi chú duyệt${row.reviewedByName ? ` (${row.reviewedByName})` : ''}`}</Text>
                  <Text type="body">{row.reviewNote}</Text>
                </VStack>
              )}
              {rejecting && (
                <VStack gap={2}>
                  <Banner status="warning" title="Từ chối đề xuất này?" container="card" collapsible={false} />
                  <TextArea label="Lý do từ chối" isRequired value={note} onChange={setNote} />
                </VStack>
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Đóng" variant="secondary" onClick={onClose} />
              {editable && !rejecting && <Button label="Từ chối" variant="destructive" onClick={() => setRejecting(true)} />}
              {editable && rejecting && <Button label="Xác nhận từ chối" variant="destructive" isLoading={isPending} onClick={reject} />}
              {editable && !rejecting && <Button label="Duyệt" variant="primary" isLoading={isPending} onClick={approve} />}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
