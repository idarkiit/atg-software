'use client';

// Shared view of "Công nợ khách hàng" and "Công nợ NCC trong nước".
import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Link} from '@astryxdesign/core/Link';
import {Button} from '@astryxdesign/core/Button';
import {Switch} from '@astryxdesign/core/Switch';
import {Token} from '@astryxdesign/core/Token';
import {useToast} from '@astryxdesign/core/Toast';
import {pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import type {DebtRow} from '@/server/reports';
import {ReportShell, ReportTable} from './ReportShell';
import {PartyLedgerDialog} from './LedgerDialogs';
import {PaymentDialog, type PaymentTarget} from './PaymentDialog';
import {money} from './format';

type Props = {
  party: 'customer' | 'supplier';
  rows: DebtRow[];
  tu: string;
  den: string;
  today: string;
  canPay: boolean;
};

export function DebtView({party, rows, tu, den, today, canPay}: Props) {
  const customer = party === 'customer';
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [overOnly, setOverOnly] = useState(false);
  const [ledger, setLedger] = useState<DebtRow | null>(null);
  const [paying, setPaying] = useState<PaymentTarget | null>(null);

  const isOver = (r: DebtRow) => r.limit != null && r.limit > 0 && r.closing > r.limit;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (!showAll && !r.opening && !r.increase && !r.decrease && !r.closing) return false;
      if (overOnly && !isOver(r)) return false;
      return !q || `${r.code} ${r.name} ${r.phone ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, query, showAll, overOnly]);

  const sum = (f: (r: DebtRow) => number) => shown.reduce((s, r) => s + f(r), 0);
  const payTarget = (r: DebtRow): PaymentTarget => ({party, partyId: r.id, partyName: `${r.name} (${r.code})`, amount: r.closing > 0 ? r.closing : undefined});

  const columns: TableColumn<DebtRow>[] = [
    {key: 'code', header: 'Mã', width: pixel(110), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'name', header: customer ? 'Khách hàng' : 'Nhà cung cấp', width: proportional(2, {minWidth: 130}), renderCell: r => <Link onClick={() => setLedger(r)}>{r.name}</Link>},
    {key: 'opening', header: 'Nợ đầu kỳ', align: 'end', width: proportional(1, {minWidth: 90}), renderCell: r => <Text type="body">{money(r.opening)}</Text>},
    {key: 'inc', header: 'Phát sinh tăng', align: 'end', width: proportional(1, {minWidth: 90}), renderCell: r => <Text type="body">{money(r.increase)}</Text>},
    {key: 'dec', header: 'Giảm', align: 'end', width: proportional(1, {minWidth: 90}), renderCell: r => <Text type="body">{money(r.decrease)}</Text>},
    {key: 'closing', header: 'Nợ cuối kỳ', align: 'end', width: proportional(1, {minWidth: 90}), renderCell: r => <Text type="body" weight="semibold">{money(r.closing)}</Text>},
  ];
  if (customer) {
    columns.push({
      key: 'limit',
      header: 'Hạn mức',
      align: 'end',
      width: proportional(1, {minWidth: 120}),
      renderCell: r => (
        <HStack gap={1.5} vAlign="center" hAlign="end">
          {isOver(r) && <Token label="Vượt hạn mức" color="red" size="sm" />}
          <Text type="body">{r.limit ? money(r.limit) : 'Không giới hạn'}</Text>
        </HStack>
      ),
    });
  }
  columns.push({
    key: 'act',
    header: '',
    width: pixel(canPay ? 100 : 80),
    renderCell: r => (
      <HStack gap={1}>
        {canPay && <Button label={customer ? 'Thu nợ' : 'Trả nợ NCC'} size="sm" variant="secondary" onClick={() => setPaying(payTarget(r))} />}
      </HStack>
    ),
  });

  return (
    <ReportShell
      title={customer ? 'Thống kê công nợ khách hàng' : 'Thống kê công nợ NCC trong nước'}
      description={
        customer
          ? 'Dư nợ của khách theo kỳ, tính từ phiếu xuất bán, hàng trả và các lần thu nợ.'
          : 'Dư nợ phải trả nhà cung cấp trong nước (nhà cung cấp nước ngoài thuộc đợt 3).'
      }
      tu={tu}
      den={den}
      search={{value: query, onChange: setQuery, placeholder: 'Tìm theo mã, tên, điện thoại…'}}
      filterCount={(showAll ? 1 : 0) + (overOnly ? 1 : 0)}
      filters={
        <>
          <Switch label="Hiện tất cả" description={`Kể cả ${customer ? 'khách' : 'NCC'} không có số dư và phát sinh`} value={showAll} onChange={setShowAll} />
          {customer && <Switch label="Chỉ khách vượt hạn mức" value={overOnly} onChange={setOverOnly} />}
        </>
      }>
      <VStack gap={3}>
        <ReportTable<DebtRow>
          key={`${query}|${showAll}|${overOnly}`}
          rows={shown}
          columns={columns}
          idKey="id"
          countLabel={customer ? 'khách hàng' : 'nhà cung cấp'}
          totals={[
            {label: 'Nợ đầu kỳ', value: money(sum(r => r.opening))},
            {label: 'Phát sinh tăng', value: money(sum(r => r.increase))},
            {label: 'Giảm', value: money(sum(r => r.decrease))},
            {label: 'Nợ cuối kỳ', value: money(sum(r => r.closing)), strong: true},
          ]}
        />
      </VStack>
      {ledger && (
        <PartyLedgerDialog
          party={party}
          partyId={ledger.id}
          partyName={`${ledger.name} (${ledger.code})`}
          tu={tu}
          den={den}
          onClose={() => setLedger(null)}
          onPay={canPay ? () => setPaying(payTarget(ledger)) : undefined}
        />
      )}
      {paying && (
        <PaymentDialog
          target={paying}
          today={today}
          onClose={() => setPaying(null)}
          onSaved={message => {
            setPaying(null);
            setLedger(null);
            toast({body: message});
            router.refresh();
          }}
        />
      )}
    </ReportShell>
  );
}
