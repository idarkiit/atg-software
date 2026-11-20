'use client';

import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {Selector} from '@astryxdesign/core/Selector';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import type {CompareData} from '@/server/pricing';
import {formatNumber} from '../format';

type Row = CompareData['rows'][number] & Record<string, unknown>;

/** Cheapest VND price of a row; prices in another currency are not compared. */
function lowest(row: CompareData['rows'][number]) {
  const vnd = Object.values(row.prices)
    .filter((p): p is {price: number; currency: string} => !!p && p.currency === 'VND')
    .map(p => p.price);
  return vnd.length > 1 ? Math.min(...vnd) : null;
}

export function ComparePage({data}: {data: CompareData}) {
  const router = useRouter();

  const columns: TableColumn<Row>[] = [
    {key: 'code', header: 'SKU', width: pixel(120), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'name', header: 'Sản phẩm', width: proportional(2, {minWidth: 200}), renderCell: r => <Text type="body">{r.name}</Text>},
    ...data.suppliers.map(
      (s): TableColumn<Row> => ({
        key: `s${s.id}`,
        header: s.name,
        width: proportional(1, {minWidth: 140}),
        align: 'end',
        renderCell: r => {
          const cell = r.prices[String(s.id)];
          if (!cell) return <Text type="body" color="secondary">—</Text>;
          const text = cell.currency === 'VND' ? `${formatNumber(cell.price)} đ` : `${formatNumber(cell.price)} ${cell.currency}`;
          const isLowest = cell.currency === 'VND' && cell.price === lowest(r);
          return isLowest ? (
            <HStack gap={1} vAlign="center" hAlign="end">
              <StatusDot variant="success" label="Giá thấp nhất" />
              <Text type="body" weight="bold">{text}</Text>
            </HStack>
          ) : (
            <Text type="body">{text}</Text>
          );
        },
      }),
    ),
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Thống kê giá các NCC</Heading>
              <Text type="body" color="secondary" size="sm">
                So sánh giá nhập của các nhà cung cấp trong một nhóm sản phẩm (gồm cả nhóm con). Giá thấp nhất mỗi sản phẩm được tô đậm kèm chấm xanh.
              </Text>
            </VStack>
            <HStack gap={2} vAlign="end">
              <Selector
                label="Nhóm sản phẩm"
                options={data.groups}
                value={data.groupId ? String(data.groupId) : undefined}
                placeholder="Chọn nhóm sản phẩm"
                hasSearch
                onChange={(v: string) => router.push(v ? `/bang-gia/so-sanh-gia-ncc?nhom=${v}` : '/bang-gia/so-sanh-gia-ncc')}
              />
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          {!data.groupId ? (
            <EmptyState title="Chọn một nhóm sản phẩm" description="Chọn nhóm ở trên để xem bảng so sánh giá các nhà cung cấp." />
          ) : data.rows.length === 0 ? (
            <EmptyState title="Nhóm này chưa có sản phẩm" description="Hãy chọn nhóm khác hoặc thêm sản phẩm vào nhóm." />
          ) : (
            <VStack gap={3}>
              {data.suppliers.length === 0 && (
                <Text type="body" color="secondary">
                  Nhóm này chưa gán nhà cung cấp nào. Gán nhà cung cấp ở danh mục Nhóm sản phẩm để thấy cột giá.
                </Text>
              )}
              <Table<Row> data={data.rows as Row[]} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" />
              <Text type="body" color="secondary" size="sm">{data.rows.length} sản phẩm · {data.suppliers.length} nhà cung cấp</Text>
            </VStack>
          )}
        </LayoutContent>
      }
    />
  );
}
