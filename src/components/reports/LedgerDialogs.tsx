'use client';

// Detail dialogs opened from a report row: thẻ kho (stock card) and sổ công nợ (party ledger).
import {useEffect, useState} from 'react';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Button} from '@astryxdesign/core/Button';
import {pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {partyEntriesAction, stockCardAction} from '@/server/actions-reports';
import type {PartyEntries, PartyEntry, StockCard, StockCardRow} from '@/server/reports';
import {DocLink} from './DocLink';
import {ReportTable} from './ReportShell';
import {dateVN, money, qty} from './format';

function Loading() {
  return (
    <HStack hAlign="center" paddingBlock={6}>
      <Spinner />
    </HStack>
  );
}

export function StockCardDialog({
  productId,
  productLabel,
  warehouseId,
  warehouseLabel,
  tu,
  den,
  onClose,
}: {
  productId: number;
  productLabel: string;
  warehouseId: number | null;
  warehouseLabel: string;
  tu: string;
  den: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StockCard | null>(null);
  useEffect(() => {
    let alive = true;
    stockCardAction({productId, warehouseId, tu, den}).then(r => alive && setData(r));
    return () => {
      alive = false;
    };
  }, [productId, warehouseId, tu, den]);

  const columns: TableColumn<StockCardRow>[] = [
    {key: 'date', header: 'Ngày', width: pixel(100), renderCell: r => <Text type="body">{dateVN(r.date)}</Text>},
    {key: 'code', header: 'Phiếu', renderCell: r => <DocLink kind={r.kind} id={r.docId} code={r.docCode} />},
    {key: 'kind', header: 'Loại', renderCell: r => <Text type="body">{r.kindTitle}</Text>},
    {key: 'wh', header: 'Kho', renderCell: r => <Text type="body">{r.warehouseName}</Text>},
    {key: 'in', header: 'Nhập', align: 'end', renderCell: r => <Text type="body">{r.qtyIn ? qty(r.qtyIn) : ''}</Text>},
    {key: 'out', header: 'Xuất', align: 'end', renderCell: r => <Text type="body">{r.qtyOut ? qty(r.qtyOut) : ''}</Text>},
    {key: 'cost', header: 'Giá vốn', align: 'end', renderCell: r => <Text type="body">{money(r.unitCost)}</Text>},
    {key: 'bal', header: 'Tồn', align: 'end', renderCell: r => <Text type="body" weight="semibold">{qty(r.balance)}</Text>},
  ];
  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="info" width={900}>
      <Layout
        header={<DialogHeader title="Thẻ kho" subtitle={`${productLabel} · ${warehouseLabel} · ${dateVN(tu)} – ${dateVN(den)}`} onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            {!data ? (
              <Loading />
            ) : (
              <VStack gap={3}>
                <Text type="body" size="sm" color="secondary">
                  Tồn đầu kỳ: <Text type="body" size="sm" weight="semibold">{qty(data.opening)}</Text>
                </Text>
                <ReportTable<StockCardRow>
                  rows={data.rows}
                  columns={columns}
                  idKey="key"
                  countLabel="dòng phát sinh"
                  totals={[
                    {label: 'Tồn đầu kỳ', value: qty(data.opening)},
                    {label: 'Nhập', value: qty(data.rows.reduce((s, r) => s + r.qtyIn, 0))},
                    {label: 'Xuất', value: qty(data.rows.reduce((s, r) => s + r.qtyOut, 0))},
                    {label: 'Tồn cuối kỳ', value: qty(data.closing), strong: true},
                  ]}
                />
              </VStack>
            )}
          </LayoutContent>
        }
      />
    </Dialog>
  );
}

export function PartyLedgerDialog({
  party,
  partyId,
  partyName,
  tu,
  den,
  onClose,
  onPay,
}: {
  party: 'customer' | 'supplier';
  partyId: number;
  partyName: string;
  tu: string;
  den: string;
  onClose: () => void;
  onPay?: () => void;
}) {
  const [data, setData] = useState<PartyEntries | null>(null);
  useEffect(() => {
    let alive = true;
    partyEntriesAction({party, partyId, tu, den}).then(r => alive && setData(r));
    return () => {
      alive = false;
    };
  }, [party, partyId, tu, den]);

  const columns: TableColumn<PartyEntry>[] = [
    {key: 'date', header: 'Ngày', width: pixel(100), renderCell: r => <Text type="body">{dateVN(r.date)}</Text>},
    {key: 'code', header: 'Chứng từ', renderCell: r => <DocLink kind={r.kind} id={r.docId} code={r.code} />},
    {key: 'desc', header: 'Diễn giải', width: proportional(2, {minWidth: 160}), renderCell: r => <Text type="body">{r.description}</Text>},
    {key: 'debit', header: party === 'customer' ? 'Khách nợ thêm' : 'Nợ NCC thêm', align: 'end', renderCell: r => <Text type="body">{r.debit ? money(r.debit) : ''}</Text>},
    {key: 'credit', header: 'Giảm nợ', align: 'end', renderCell: r => <Text type="body">{r.credit ? money(r.credit) : ''}</Text>},
    {key: 'bal', header: 'Dư nợ', align: 'end', renderCell: r => <Text type="body" weight="semibold">{money(r.balance)}</Text>},
  ];
  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="info" width={900}>
      <Layout
        header={<DialogHeader title="Sổ công nợ" subtitle={`${partyName} · ${dateVN(tu)} – ${dateVN(den)}`} onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            {!data ? (
              <Loading />
            ) : (
              <VStack gap={3}>
                {onPay && (
                  <HStack hAlign="end">
                    <Button label={party === 'customer' ? 'Thu nợ' : 'Trả nợ NCC'} variant="primary" size="sm" onClick={onPay} />
                  </HStack>
                )}
                <ReportTable<PartyEntry>
                  rows={data.rows}
                  columns={columns}
                  idKey="key"
                  countLabel="dòng phát sinh"
                  totals={[
                    {label: 'Nợ đầu kỳ', value: money(data.opening)},
                    {label: 'Phát sinh tăng', value: money(data.rows.reduce((s, r) => s + r.debit, 0))},
                    {label: 'Giảm', value: money(data.rows.reduce((s, r) => s + r.credit, 0))},
                    {label: 'Nợ cuối kỳ', value: money(data.closing), strong: true},
                  ]}
                />
              </VStack>
            )}
          </LayoutContent>
        }
      />
    </Dialog>
  );
}
