'use client';

import {useMemo, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Pagination} from '@astryxdesign/core/Pagination';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Grid} from '@astryxdesign/core/Grid';
import {Banner} from '@astryxdesign/core/Banner';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {useToast} from '@astryxdesign/core/Toast';
import type {AvgCostRow} from '@/server/pricing';
import {saveAvgCostAction} from '@/server/actions-pricing';
import {formatDateTime, vnd} from '../format';

type Row = AvgCostRow & Record<string, unknown>;

const PAGE_SIZE = 20;

export function AvgCostsPage({rows, canEdit}: {rows: AvgCostRow[]; canEdit: boolean}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AvgCostRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => !q || `${r.code} ${r.name}`.toLowerCase().includes(q));
  }, [rows, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) as Row[];

  const money = (key: keyof AvgCostRow, header: string, width = 130): TableColumn<Row> => ({
    key,
    header,
    width: pixel(width),
    align: 'end',
    renderCell: r => {
      const v = r[key] as number | null;
      return <Text type="body" color={v ? undefined : 'secondary'}>{v === null ? '—' : vnd(v)}</Text>;
    },
  });

  const columns: TableColumn<Row>[] = [
    {key: 'code', header: 'SKU', width: pixel(120), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'name', header: 'Tên sản phẩm', width: proportional(2, {minWidth: 190}), renderCell: r => <Text type="body">{r.name}</Text>},
    money('avgCost', 'Giá TB nhập'),
    money('extraCost', 'Chi phí/đơn vị'),
    {
      key: 'cost',
      header: 'Giá vốn tính lãi',
      width: pixel(140),
      align: 'end',
      renderCell: r => <Text type="body" weight="semibold">{vnd(r.avgCost + r.extraCost)}</Text>,
    },
    money('supplierMin', 'NCC thấp nhất'),
    money('supplierMax', 'NCC cao nhất'),
    money('supplierAvg', 'NCC trung bình'),
    money('movingAvg', 'Giá vốn kho (BQ)'),
    {key: 'updatedAt', header: 'Cập nhật', width: pixel(140), renderCell: r => <Text type="body" size="sm">{formatDateTime(r.updatedAt)}</Text>},
    ...(canEdit
      ? [
          {
            key: '__actions',
            header: '',
            width: pixel(56),
            renderCell: (r: Row) => (
              <MoreMenu size="sm" label={`Thao tác với ${r.code}`} alignment="end" items={[{label: 'Sửa', onClick: () => setEditing(r)}]} />
            ),
          } satisfies TableColumn<Row>,
        ]
      : []),
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Bảng giá trung bình</Heading>
              <Text type="body" color="secondary" size="sm">
                Giá nhập trung bình do ATG tự nhập, dùng tính lãi. Giá vốn tính lãi = giá trung bình + chi phí trên mỗi đơn vị. Cột NCC chỉ tính giá VND.
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
          {editing && (
            <AvgCostDialog
              row={editing}
              onClose={() => setEditing(null)}
              onSaved={message => {
                setEditing(null);
                toast({body: message});
                router.refresh();
              }}
            />
          )}
        </LayoutContent>
      }
    />
  );
}

function AvgCostDialog({row, onClose, onSaved}: {row: AvgCostRow; onClose: () => void; onSaved: (message: string) => void}) {
  const [avgCost, setAvgCost] = useState<number | null>(row.avgCost);
  const [extraCost, setExtraCost] = useState<number | null>(row.extraCost);
  const [note, setNote] = useState(row.note ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await saveAvgCostAction({productId: row.id, avgCost, extraCost, note});
      if (result.ok) onSaved(result.message);
      else setMessage(result.message);
    });
  };

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="form" width={640}>
      <Layout
        header={<DialogHeader title={`${row.code} · ${row.name}`} subtitle="Nhập giá trung bình và chi phí trên mỗi đơn vị." onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {message && <Banner status="error" title={message} container="card" collapsible={false} />}
              <VStack gap={1}>
                <Text type="label">Tham khảo</Text>
                <Text type="body" color="secondary">
                  {`Giá NCC (${row.supplierCount} NCC): thấp nhất ${vnd(row.supplierMin)} · cao nhất ${vnd(row.supplierMax)} · trung bình ${vnd(row.supplierAvg)}`}
                </Text>
                <Text type="body" color="secondary">{`Giá vốn bình quân theo kho hiện tại: ${vnd(row.movingAvg)}`}</Text>
              </VStack>
              <Grid columns={{minWidth: 240, max: 2}} gap={4}>
                <VStack gap={2}>
                  <NumberInput label="Giá trung bình nhập" value={avgCost} onChange={setAvgCost} min={0} step={1000} hasClear placeholder="VNĐ" />
                  <Button
                    label="Lấy trung bình giá NCC"
                    variant="secondary"
                    size="sm"
                    isDisabled={row.supplierAvg === null}
                    onClick={() => setAvgCost(row.supplierAvg)}
                  />
                </VStack>
                <NumberInput label="Chi phí trên mỗi đơn vị" value={extraCost} onChange={setExtraCost} min={0} step={1000} hasClear placeholder="Vận chuyển, thuế…" />
              </Grid>
              <Text type="body">{`Giá vốn tính lãi: ${vnd((avgCost ?? 0) + (extraCost ?? 0))}`}</Text>
              <TextArea label="Ghi chú" value={note} onChange={setNote} />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Hủy" variant="secondary" onClick={onClose} />
              <Button label="Lưu" variant="primary" isLoading={isPending} onClick={submit} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
