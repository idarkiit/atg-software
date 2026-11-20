'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {FunnelIcon} from '@heroicons/react/24/outline';
import {deleteNotificationAction, markReadAction} from '@/server/actions';

export type NotificationRow = {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};
type Row = NotificationRow & Record<string, unknown>;

const dateTime = new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'short'});

export function NotificationsPage({items}: {items: NotificationRow[]}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('unread');
  const unread = items.filter(i => !i.isRead).length;
  const rows = (filter === 'unread' ? items.filter(i => !i.isRead) : items) as Row[];

  const open = async (r: NotificationRow) => {
    if (!r.isRead) await markReadAction([r.id]);
    if (r.link) router.push(r.link);
    else router.refresh();
  };

  const columns: TableColumn<Row>[] = [
    {
      key: '__mark',
      header: '',
      width: pixel(40),
      renderCell: r => (r.isRead ? null : <StatusDot variant="accent" label="Chưa xem" />),
    },
    {
      key: 'title',
      header: 'Thông báo',
      width: proportional(3, {minWidth: 240}),
      renderCell: r => (
        <VStack gap={0.5}>
          <Text type="body" weight={r.isRead ? undefined : 'semibold'}>{r.title}</Text>
          {r.body && <Text type="body" size="sm" color="secondary">{r.body}</Text>}
        </VStack>
      ),
    },
    {key: 'createdAt', header: 'Thời gian', width: pixel(150), renderCell: r => <Text type="body">{dateTime.format(new Date(r.createdAt))}</Text>},
    {
      key: '__actions',
      header: '',
      width: pixel(170),
      renderCell: r => (
        <HStack gap={1}>
          <Button label="Xem" size="sm" variant="secondary" onClick={() => open(r)} />
          <Button
            label="Xóa"
            size="sm"
            variant="ghost"
            onClick={async () => {
              await deleteNotificationAction(r.id);
              router.refresh();
            }}
          />
        </HStack>
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
                <Heading level={2}>Thông báo</Heading>
                <Text type="body" color="secondary" size="sm">
                  {unread ? `${unread} thông báo chưa xem` : 'Bạn đã xem hết thông báo.'}
                </Text>
              </VStack>
              <Button
                label="Đánh dấu đã xem hết"
                variant="secondary"
                isDisabled={!unread}
                onClick={async () => {
                  await markReadAction();
                  router.refresh();
                }}
              />
            </HStack>
            <Collapsible
              defaultIsOpen={false}
              chevronPosition="start"
              trigger={
                <HStack gap={1} vAlign="center">
                  <Icon icon={FunnelIcon} size="sm" />
                  <Text type="body" size="sm" weight="semibold">Bộ lọc</Text>
                </HStack>
              }>
              <Selector
                label="Hiển thị"
                options={[
                  {value: 'unread', label: 'Chưa xem'},
                  {value: 'all', label: 'Tất cả'},
                ]}
                value={filter}
                onChange={(v: string) => setFilter(v || 'unread')}
              />
            </Collapsible>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <Table<Row> data={rows} columns={columns} idKey="id" hasHover density="compact" />
        </LayoutContent>
      }
    />
  );
}
