'use client';

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Token} from '@astryxdesign/core/Token';
import {useToast} from '@astryxdesign/core/Toast';
import {pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import type {OverdueRow} from '@/server/reports';
import {ReportShell, ReportTable} from '@/components/reports/ReportShell';
import {DocLink} from '@/components/reports/DocLink';
import {PaymentDialog, type PaymentTarget} from '@/components/reports/PaymentDialog';
import {dateVN, money, qty} from '@/components/reports/format';

type Bucket = '1-30' | '31-60' | '60+';
const bucketOf = (days: number): Bucket => (days <= 30 ? '1-30' : days <= 60 ? '31-60' : '60+');
const BUCKET = {
  '1-30': {label: '1 – 30 ngày', color: 'yellow', dot: 'warning'},
  '31-60': {label: '31 – 60 ngày', color: 'orange', dot: 'warning'},
  '60+': {label: 'Trên 60 ngày', color: 'red', dot: 'error'},
} as const;

type Group = {
  customerId: number;
  name: string;
  phone: string | null;
  count: number;
  total: number;
  oldest: number;
  remainingTotal: number;
};

export function NoQuaHanPage({rows, today, canPay}: {rows: OverdueRow[]; today: string; canPay: boolean}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<string | null>(null);
  const [paying, setPaying] = useState<PaymentTarget | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (bucket && bucketOf(r.daysOver) !== bucket) return false;
      return !q || `${r.customerName} ${r.customerCode} ${r.phone ?? ''} ${r.code}`.toLowerCase().includes(q);
    });
  }, [rows, query, bucket]);

  const groups = useMemo<Group[]>(() => {
    const m = new Map<number, Group>();
    for (const r of shown) {
      const g = m.get(r.customerId) ?? {customerId: r.customerId, name: `${r.customerName} (${r.customerCode})`, phone: r.phone, count: 0, total: 0, oldest: 0, remainingTotal: 0};
      g.count += 1;
      g.total += r.remaining;
      g.oldest = Math.max(g.oldest, r.daysOver);
      m.set(r.customerId, g);
    }
    return [...m.values()].sort((a, b) => b.oldest - a.oldest);
  }, [shown]);

  const bucketToken = (days: number) => {
    const b = BUCKET[bucketOf(days)];
    return <Token label={`${qty(days)} ngày`} color={b.color} size="sm" />;
  };

  const groupColumns: TableColumn<Group>[] = [
    {
      key: 'name',
      header: 'Khách hàng',
      width: proportional(2, {minWidth: 220}),
      renderCell: g => (
        <HStack gap={1.5} vAlign="center">
          <StatusDot variant={BUCKET[bucketOf(g.oldest)].dot} label={BUCKET[bucketOf(g.oldest)].label} />
          <Text type="body" weight="semibold">{g.name}</Text>
        </HStack>
      ),
    },
    {key: 'phone', header: 'SĐT', width: pixel(120), renderCell: g => <Text type="body">{g.phone || '—'}</Text>},
    {key: 'count', header: 'Số phiếu quá hạn', align: 'end', width: pixel(150), renderCell: g => <Text type="body">{g.count}</Text>},
    {key: 'oldest', header: 'Quá hạn lâu nhất', align: 'end', width: pixel(160), renderCell: g => bucketToken(g.oldest)},
    {key: 'total', header: 'Tổng nợ quá hạn', align: 'end', width: proportional(1, {minWidth: 150}), renderCell: g => <Text type="body" weight="semibold">{money(g.total)}</Text>},
    {
      key: 'act',
      header: '',
      width: pixel(110),
      renderCell: g =>
        canPay ? (
          <Button label="Thu nợ" size="sm" variant="secondary" onClick={() => setPaying({party: 'customer', partyId: g.customerId, partyName: g.name, amount: g.total})} />
        ) : null,
    },
  ];

  const columns: TableColumn<OverdueRow>[] = [
    {key: 'customer', header: 'Khách hàng', width: proportional(2, {minWidth: 200}), renderCell: r => <Text type="body">{r.customerName}</Text>},
    {key: 'phone', header: 'SĐT', width: pixel(120), renderCell: r => <Text type="body">{r.phone || '—'}</Text>},
    {key: 'code', header: 'Số phiếu', width: pixel(130), renderCell: r => <DocLink kind={r.kind} id={r.docId} code={r.code} />},
    {key: 'date', header: 'Ngày phiếu', width: pixel(110), renderCell: r => <Text type="body">{dateVN(r.date)}</Text>},
    {
      key: 'due',
      header: 'Hạn thanh toán',
      width: pixel(130),
      renderCell: r => <Text type="body">{dateVN(r.dueDate)}{r.dueEstimated ? ' *' : ''}</Text>,
    },
    {key: 'days', header: 'Số ngày quá hạn', align: 'end', width: pixel(150), renderCell: r => bucketToken(r.daysOver)},
    {key: 'remaining', header: 'Còn nợ', align: 'end', width: proportional(1, {minWidth: 130}), renderCell: r => <Text type="body" weight="semibold">{money(r.remaining)}</Text>},
    {
      key: 'act',
      header: '',
      width: pixel(110),
      renderCell: r =>
        canPay ? (
          <Button
            label="Thu nợ"
            size="sm"
            variant="secondary"
            onClick={() => setPaying({party: 'customer', partyId: r.customerId, partyName: `${r.customerName} (${r.customerCode})`, docId: r.docId, amount: r.remaining})}
          />
        ) : null,
    },
  ];

  const totalOverdue = shown.reduce((s, r) => s + r.remaining, 0);
  const byBucket = (b: Bucket) => shown.filter(r => bucketOf(r.daysOver) === b).reduce((s, r) => s + r.remaining, 0);
  const resetKey = `${query}|${bucket}`;

  return (
    <ReportShell
      title="Theo dõi nợ quá hạn"
      description={`Phiếu xuất bán còn nợ đã quá hạn thanh toán tính đến ${dateVN(today)}.`}
      search={{value: query, onChange: setQuery, placeholder: 'Tìm theo khách, điện thoại, số phiếu…'}}
      filterCount={bucket ? 1 : 0}
      filters={
        <Selector
          label="Mức quá hạn"
          placeholder="Tất cả"
          hasClear
          value={bucket}
          onChange={(v: string | null) => setBucket(v)}
          options={(Object.keys(BUCKET) as Bucket[]).map(b => ({value: b, label: BUCKET[b].label}))}
        />
      }>
      <VStack gap={5}>
        <VStack gap={2}>
          <Heading level={4}>Tổng hợp theo khách hàng</Heading>
          <ReportTable<Group> key={`g|${resetKey}`} rows={groups} columns={groupColumns} idKey="customerId" countLabel="khách hàng" />
        </VStack>
        <VStack gap={2}>
          <Heading level={4}>Chi tiết phiếu quá hạn</Heading>
          <ReportTable<OverdueRow>
            key={`d|${resetKey}`}
            rows={shown}
            columns={columns}
            idKey="key"
            countLabel="phiếu"
            totals={[
              {label: 'Tổng nợ quá hạn', value: money(totalOverdue), strong: true},
              {label: '1 – 30 ngày', value: money(byBucket('1-30'))},
              {label: '31 – 60 ngày', value: money(byBucket('31-60'))},
              {label: 'Trên 60 ngày', value: money(byBucket('60+'))},
            ]}
            note={
              rows.some(r => r.dueEstimated) ? (
                <Text type="body" size="sm" color="secondary">
                  * Phiếu chưa có hạn thanh toán: hạn được tính từ ngày phiếu cộng số ngày nợ mặc định trong Cài đặt.
                </Text>
              ) : undefined
            }
          />
        </VStack>
      </VStack>
      {paying && (
        <PaymentDialog
          target={paying}
          today={today}
          onClose={() => setPaying(null)}
          onSaved={message => {
            setPaying(null);
            toast({body: message});
            router.refresh();
          }}
        />
      )}
    </ReportShell>
  );
}
