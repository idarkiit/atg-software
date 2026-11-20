'use client';

// Bands from the Astryx "dashboard" template: header, stat tiles, then a Table section (charts dropped).
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {VStack, HStack} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {StatusDot} from '@astryxdesign/core/StatusDot';

export type ModuleProgress = {
  key: string;
  title: string;
  functionCount: number;
  phase: number;
  status: 'done' | 'wip' | 'planned';
};
type Row = ModuleProgress & Record<string, unknown>;

const number = new Intl.NumberFormat('vi-VN');

const STATUS = {
  done: {variant: 'success', label: 'Đã có'},
  wip: {variant: 'warning', label: 'Đang làm'},
  planned: {variant: 'neutral', label: 'Theo kế hoạch'},
} as const;

const columns: TableColumn<Row>[] = [
  {key: 'title', header: 'Phân hệ', width: proportional(2, {minWidth: 160}), renderCell: r => <Text type="body" weight="semibold">{r.title}</Text>},
  {key: 'functionCount', header: 'Số chức năng', width: pixel(140), align: 'end', renderCell: r => <Text type="body">{r.functionCount}</Text>},
  {key: 'phase', header: 'Đợt', width: pixel(100), align: 'end', renderCell: r => <Text type="body">{r.phase}</Text>},
  {
    key: 'status',
    header: 'Trạng thái',
    width: pixel(180),
    renderCell: r => (
      <HStack gap={1} vAlign="center">
        <StatusDot variant={STATUS[r.status].variant} label={STATUS[r.status].label} />
        <Text type="body" size="sm">{STATUS[r.status].label}</Text>
      </HStack>
    ),
  },
];

export function HomePage({name, stats, modules}: {name: string; stats: {label: string; value: number}[]; modules: ModuleProgress[]}) {
  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={1}>
            <Heading level={2}>Xin chào, {name}</Heading>
            <Text type="body" color="secondary" size="sm">Tổng quan hệ thống quản lý ATG.</Text>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={6}>
            <Grid columns={{minWidth: 180}} gap={3}>
              {stats.map(s => (
                <Card key={s.label}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">{s.label}</Text>
                    <Text type="display-2">{number.format(s.value)}</Text>
                  </VStack>
                </Card>
              ))}
            </Grid>
            <VStack gap={3}>
              <Heading level={3}>Tiến độ các phân hệ</Heading>
              <Table<Row> data={modules as Row[]} columns={columns} idKey="key" density="compact" />
            </VStack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
