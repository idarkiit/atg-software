'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Card} from '@astryxdesign/core/Card';
import {Banner} from '@astryxdesign/core/Banner';
import {Divider} from '@astryxdesign/core/Divider';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {PrinterIcon, PlusIcon, ArrowLeftIcon} from '@heroicons/react/24/outline';
import {DOC_KINDS} from '@/lib/stock/kinds';
import type {DocLineView, DocView as DocViewData} from '@/server/stock';
import {CancelDocDialog} from './CancelDocDialog';
import {fmtDate, fmtDateTime, fmtMoney, fmtQty} from './format';

type Props = {
  doc: DocViewData;
  route: string;
  perms: {create: boolean; delete: boolean};
};

const METHOD: Record<string, string> = {cash: 'Tiền mặt', bank: 'Chuyển khoản'};

export function DocView({doc, route, perms}: Props) {
  const def = DOC_KINDS[doc.kind];
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const cancelled = doc.status === 'cancelled';
  const isReturn = def.debt?.sign === -1;
  const remaining = Math.max(0, doc.total - doc.paidAmount - doc.paidLater);

  const partyTitle = def.party === 'customer' ? 'Khách hàng' : def.party === 'supplier' ? 'Nhà cung cấp' : 'Nhân viên nhận';

  const columns: TableColumn<DocLineView>[] = [
    {key: 'no', header: 'STT', width: pixel(56), renderCell: l => <Text type="body">{l.lineNo}</Text>},
    {key: 'code', header: 'Mã', width: pixel(120), renderCell: l => <Text type="body" weight="semibold">{l.productCode}</Text>},
    {key: 'name', header: 'Tên hàng', width: proportional(3, {minWidth: 200}), renderCell: l => <Text type="body">{l.productName}</Text>},
    {key: 'unit', header: 'ĐVT', width: pixel(70), renderCell: l => <Text type="body">{l.unit}</Text>},
    ...(def.direction === 'convert'
      ? [
          {
            key: 'dir',
            header: 'Xuất / Nhập',
            width: pixel(100),
            renderCell: (l: DocLineView) => <Text type="body">{l.lineDir === 'in' ? 'Nhập' : 'Xuất'}</Text>,
          },
        ]
      : []),
    {key: 'qty', header: 'Số lượng', width: pixel(90), align: 'end', renderCell: l => <Text type="body">{fmtQty(l.qty)}</Text>},
    ...(def.priced
      ? [
          {key: 'price', header: 'Đơn giá', width: pixel(120), align: 'end' as const, renderCell: (l: DocLineView) => <Text type="body">{fmtMoney(l.unitPrice)}</Text>},
          {key: 'discount', header: 'Giảm giá', width: pixel(110), align: 'end' as const, renderCell: (l: DocLineView) => <Text type="body">{fmtMoney(l.discount)}</Text>},
          {key: 'amount', header: 'Thành tiền', width: pixel(130), align: 'end' as const, renderCell: (l: DocLineView) => <Text type="body" weight="semibold">{fmtMoney(l.amount)}</Text>},
        ]
      : [
          {key: 'cost', header: 'Giá vốn', width: pixel(120), align: 'end' as const, renderCell: (l: DocLineView) => <Text type="body">{fmtMoney(l.unitCost)}</Text>},
          {key: 'value', header: 'Thành tiền (giá vốn)', width: pixel(160), align: 'end' as const, renderCell: (l: DocLineView) => <Text type="body" weight="semibold">{fmtMoney(l.unitCost * l.qty)}</Text>},
        ]),
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack vAlign="center" hAlign="between" gap={3} wrap="wrap">
            <VStack gap={1}>
              <HStack gap={2} vAlign="center">
                <Heading level={2}>{`${def.title} ${doc.code}`}</Heading>
                <StatusDot variant={cancelled ? 'neutral' : 'success'} label={cancelled ? 'Đã hủy' : 'Đã ghi sổ'} />
                <Text type="body" size="sm">{cancelled ? 'Đã hủy' : 'Đã ghi sổ'}</Text>
              </HStack>
              <Text type="body" color="secondary" size="sm">
                Lập bởi {doc.createdByName ?? '—'} lúc {fmtDateTime(doc.createdAt)}
              </Text>
            </VStack>
            <HStack gap={2} wrap="wrap">
              <Button label="Quay lại danh sách" variant="ghost" icon={<Icon icon={ArrowLeftIcon} />} href={route} />
              {perms.create && <Button label="Tạo phiếu mới" variant="secondary" icon={<Icon icon={PlusIcon} />} href={`${route}/moi`} />}
              {perms.delete && !cancelled && <Button label="Hủy phiếu" variant="destructive" onClick={() => setCancelling(true)} />}
              <Button label="In phiếu" variant="primary" icon={<Icon icon={PrinterIcon} />} onClick={() => window.print()} />
            </HStack>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            {cancelled && (
              <Banner
                status="error"
                title={`Phiếu đã hủy${doc.cancelledAt ? ` lúc ${fmtDateTime(doc.cancelledAt)}` : ''}`}
                description={`Lý do: ${doc.cancelReason ?? '—'}. Tồn kho và công nợ đã được hoàn lại.`}
                container="card"
                collapsible={false}
              />
            )}
            <Card>
              <VStack gap={4} padding={4}>
                <VStack gap={0.5} hAlign="center">
                  <Heading level={3}>Công ty TNHH ATG</Heading>
                  <Text type="body" color="secondary" size="sm">{doc.branchName}</Text>
                </VStack>
                <VStack gap={0.5} hAlign="center">
                  <Heading level={2}>{def.title.toUpperCase()}</Heading>
                  <Text type="body" color="secondary">{`Số: ${doc.code} · Ngày ${fmtDate(doc.docDate)}`}</Text>
                </VStack>
                <Grid columns={{minWidth: 260, max: 3}} gap={3}>
                  {def.party && <Info label={partyTitle} value={doc.partyName ? `${doc.partyName}${doc.partyCode ? ` (${doc.partyCode})` : ''}` : '—'} />}
                  {doc.partyPhone && <Info label="Điện thoại" value={doc.partyPhone} />}
                  {doc.partyAddress && <Info label="Địa chỉ" value={doc.partyAddress} />}
                  {doc.partyTaxCode && <Info label="Mã số thuế" value={doc.partyTaxCode} />}
                  <Info label={def.direction === 'transfer' ? 'Kho đi' : 'Kho'} value={doc.warehouseName} />
                  {def.direction === 'transfer' && <Info label="Kho đến" value={doc.toWarehouseName ?? '—'} />}
                  <Info label="Loại phiếu" value={doc.typeName ?? def.title} />
                  {doc.refDocCode && <Info label="Phiếu gốc" value={doc.refDocCode} />}
                  {def.priced && doc.priceLevel > 0 && def.priceSource === 'sale' && <Info label="Bảng giá" value={`Bảng giá ${doc.priceLevel}`} />}
                  {doc.invoiceNo && <Info label="Số hóa đơn" value={doc.invoiceNo} />}
                  {def.vat && <Info label="Thuế VAT" value={`${doc.vatRate}%`} />}
                  {doc.dueDate && def.debt && <Info label="Hạn thanh toán" value={fmtDate(doc.dueDate)} />}
                  {doc.reason && <Info label={def.reasonLabel ?? 'Lý do'} value={doc.reason} />}
                  {doc.note && <Info label="Ghi chú" value={doc.note} />}
                </Grid>
                <Table<DocLineView> data={doc.lines} columns={columns} idKey="id" density="compact" dividers="rows" textOverflow="wrap" />
                <HStack hAlign="end">
                  <VStack gap={1} width="24rem" maxWidth="100%">
                    {def.priced ? (
                      <>
                        <Sum label="Tổng tiền hàng" value={fmtMoney(doc.subtotal)} />
                        {doc.discountAmount > 0 && <Sum label="Giảm giá phiếu" value={`− ${fmtMoney(doc.discountAmount)}`} />}
                        {def.vat && <Sum label={`VAT (${doc.vatRate}%)`} value={fmtMoney(doc.vatAmount)} />}
                        <Divider />
                        <Sum label="Tổng thanh toán" value={fmtMoney(doc.total)} strong />
                        {doc.otherCost > 0 && <Sum label="Chi phí phân bổ (vào giá vốn)" value={fmtMoney(doc.otherCost)} />}
                      </>
                    ) : (
                      <Sum label="Tổng giá vốn" value={fmtMoney(doc.costTotal)} strong />
                    )}
                    {def.payment && (
                      <>
                        <Divider />
                        <Sum
                          label={`${isReturn ? 'Hoàn tiền ngay' : 'Thanh toán ngay'}${doc.paymentMethod ? ` (${METHOD[doc.paymentMethod] ?? doc.paymentMethod})` : ''}`}
                          value={fmtMoney(doc.paidAmount)}
                        />
                        {doc.paidLater > 0 && <Sum label="Đã thanh toán thêm sau" value={fmtMoney(doc.paidLater)} />}
                        <Sum label={isReturn ? 'Ghi giảm công nợ' : 'Còn nợ'} value={cancelled ? '—' : fmtMoney(remaining)} strong />
                      </>
                    )}
                  </VStack>
                </HStack>
                <Grid columns={3} gap={3}>
                  {['Người lập phiếu', 'Người nhận', 'Thủ kho'].map(s => (
                    <VStack key={s} gap={1} hAlign="center" paddingBlockStart={2}>
                      <Text type="body" weight="semibold">{s}</Text>
                      <Text type="body" color="secondary" size="sm">(Ký, ghi rõ họ tên)</Text>
                    </VStack>
                  ))}
                </Grid>
              </VStack>
            </Card>
          </VStack>
          {cancelling && (
            <CancelDocDialog
              doc={doc}
              onClose={() => setCancelling(false)}
              onCancelled={() => {
                setCancelling(false);
                router.refresh();
              }}
            />
          )}
        </LayoutContent>
      }
    />
  );
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <VStack gap={0.5}>
      <Text type="body" color="secondary" size="sm">{label}</Text>
      <Text type="body" weight="semibold">{value}</Text>
    </VStack>
  );
}

function Sum({label, value, strong}: {label: string; value: string; strong?: boolean}) {
  return (
    <HStack hAlign="between" gap={3}>
      <Text type="body" weight={strong ? 'semibold' : 'normal'}>{label}</Text>
      <Text type="body" weight={strong ? 'semibold' : 'normal'}>{value}</Text>
    </HStack>
  );
}
