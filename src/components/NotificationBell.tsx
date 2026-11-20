'use client';

import {useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Popover} from '@astryxdesign/core/Popover';
import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {Icon} from '@astryxdesign/core/Icon';
import {List, ListItem} from '@astryxdesign/core/List';
import {VStack, HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {BellIcon} from '@heroicons/react/24/outline';
import {markReadAction} from '@/server/actions';

export type NotificationItem = {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({
  items,
  pendingApprovals,
}: {
  items: NotificationItem[];
  pendingApprovals: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unread = items.filter(i => !i.isRead).length;

  const open = (item: NotificationItem) =>
    startTransition(async () => {
      await markReadAction([item.id]);
      if (item.link) router.push(item.link);
    });

  return (
    <Popover
      label="Thông báo"
      placement="below"
      alignment="end"
      width={380}
      content={
        <VStack gap={2}>
          <HStack hAlign="between" vAlign="center">
            <Text type="body" weight="semibold">
              Thông báo
            </Text>
            {unread > 0 && (
              <Button
                label="Đánh dấu đã xem hết"
                variant="ghost"
                size="sm"
                isLoading={isPending}
                onClick={() => startTransition(() => markReadAction())}
              />
            )}
          </HStack>
          {pendingApprovals > 0 && (
            <Button
              label={`${pendingApprovals} mục đang chờ bạn duyệt`}
              variant="secondary"
              size="sm"
              href="/canh-bao/duyet-de-xuat"
            />
          )}
          {items.length === 0 ? (
            <EmptyState title="Chưa có thông báo" isCompact />
          ) : (
            <List density="compact" hasDividers>
              {items.slice(0, 12).map(item => (
                <ListItem
                  key={item.id}
                  label={item.title}
                  description={item.body ?? undefined}
                  startContent={
                    <StatusDot
                      variant={item.isRead ? 'neutral' : 'accent'}
                      label={item.isRead ? 'Đã xem' : 'Chưa xem'}
                    />
                  }
                  onClick={() => open(item)}
                />
              ))}
            </List>
          )}
          <Button label="Xem tất cả thông báo" variant="ghost" size="sm" href="/canh-bao/thong-bao" />
        </VStack>
      }>
      <Button
        label="Thông báo"
        variant="ghost"
        icon={<Icon icon={BellIcon} />}
        isIconOnly={unread === 0}
        endContent={unread > 0 ? <Badge variant="error" label={String(unread)} /> : undefined}
      />
    </Popover>
  );
}
