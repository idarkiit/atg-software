'use client';

import {useMemo, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Grid} from '@astryxdesign/core/Grid';
import {Pagination} from '@astryxdesign/core/Pagination';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Banner} from '@astryxdesign/core/Banner';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {useToast} from '@astryxdesign/core/Toast';
import {FunnelIcon, PlusIcon} from '@heroicons/react/24/outline';
import type {SupplierPriceRow} from '@/server/pricing';
import {deleteSupplierPriceAction, saveSupplierPriceAction} from '@/server/actions-pricing';
import {formatDateTime, formatNumber} from '../format';

type Row = SupplierPriceRow & Record<string, unknown>;
type Option = {value: string; label: string};

const PAGE_SIZE = 20;
const CURRENCIES: Option[] = ['VND', 'CNY', 'USD'].map(c => ({value: c, label: c}));

function priceText(price: number, currency: string) {
  return currency === 'VND' ? `${formatNumber(price)} đ` : `${formatNumber(price)} ${currency}`;
}

export function SupplierPricesPage({
  rows,
  suppliers,
  products,
  groups,
  perms,
}: {
  rows: SupplierPriceRow[];
  suppliers: Option[];
  products: Option[];
  groups: Option[];
  perms: {create: boolean; edit: boolean; delete: boolean};
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SupplierPriceRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SupplierPriceRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (supplierId && String(r.supplierId) !== supplierId) return false;
      if (groupId && String(r.groupId ?? '') !== groupId) return false;
      return !q || `${r.code} ${r.supplierName} ${r.productCode} ${r.productName}`.toLowerCase().includes(q);
    });
  }, [rows, query, supplierId, groupId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) as Row[];
  const filterCount = (supplierId ? 1 : 0) + (groupId ? 1 : 0);

  const columns: TableColumn<Row>[] = [
    {key: 'code', header: 'Mã', width: pixel(130), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'supplierName', header: 'Nhà cung cấp', width: proportional(1, {minWidth: 150}), renderCell: r => <Text type="body">{r.supplierName}</Text>},
    {key: 'product', header: 'Sản phẩm', width: proportional(2, {minWidth: 200}), renderCell: r => <Text type="body">{`${r.productCode} · ${r.productName}`}</Text>},
    {key: 'price', header: 'Giá nhập', width: pixel(150), align: 'end', renderCell: r => <Text type="body">{priceText(r.price, r.currency)}</Text>},
    {key: 'note', header: 'Ghi chú', width: proportional(1, {minWidth: 120}), renderCell: r => <Text type="body" color="secondary">{r.note ?? '—'}</Text>},
    {key: 'updatedAt', header: 'Cập nhật', width: pixel(140), renderCell: r => <Text type="body" size="sm">{formatDateTime(r.updatedAt)}</Text>},
    {
      key: '__actions',
      header: '',
      width: pixel(56),
      renderCell: r => (
        <MoreMenu
          size="sm"
          label={`Thao tác với ${r.code}`}
          alignment="end"
          items={[
            {label: perms.edit ? 'Sửa' : 'Xem', onClick: () => setEditing(r)},
            ...(perms.delete
              ? [{type: 'divider' as const}, {label: 'Xóa', variant: 'destructive' as const, onClick: () => setDeleting(r)}]
              : []),
          ]}
        />
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
                <Heading level={2}>Bảng giá NCC</Heading>
                <Text type="body" color="secondary" size="sm">
                  Giá nhập của từng nhà cung cấp cho từng sản phẩm. Mỗi cặp nhà cung cấp và sản phẩm chỉ có một giá.
                </Text>
              </VStack>
              {perms.create && (
                <Button label="Thêm giá NCC" variant="primary" icon={<Icon icon={PlusIcon} />} onClick={() => setEditing('new')} />
              )}
            </HStack>
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
                placeholder="Tìm theo mã, nhà cung cấp, sản phẩm…"
                hasClear
              />
            </HStack>
            <Collapsible
              defaultIsOpen={false}
              chevronPosition="start"
              trigger={
                <HStack gap={1} vAlign="center">
                  <Icon icon={FunnelIcon} size="sm" />
                  <Text type="body" size="sm" weight="semibold">
                    {filterCount ? `Bộ lọc (${filterCount} đang áp dụng)` : 'Bộ lọc'}
                  </Text>
                </HStack>
              }>
              <Grid columns={{minWidth: 200}} gap={3}>
                <Selector
                  label="Nhà cung cấp"
                  options={suppliers}
                  value={supplierId}
                  placeholder="Tất cả"
                  hasSearch
                  hasClear
                  onChange={(v: string | null) => {
                    setSupplierId(v || null);
                    setPage(1);
                  }}
                />
                <Selector
                  label="Nhóm sản phẩm"
                  options={groups}
                  value={groupId}
                  placeholder="Tất cả"
                  hasSearch
                  hasClear
                  onChange={(v: string | null) => {
                    setGroupId(v || null);
                    setPage(1);
                  }}
                />
                {filterCount > 0 && (
                  <Button
                    label="Xóa bộ lọc"
                    variant="ghost"
                    onClick={() => {
                      setSupplierId(null);
                      setGroupId(null);
                    }}
                  />
                )}
              </Grid>
            </Collapsible>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            <Table<Row> data={pageRows} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" />
            <HStack hAlign="between" vAlign="center">
              <Text type="body" color="secondary" size="sm">{filtered.length} bản ghi</Text>
              {pageCount > 1 && <Pagination page={currentPage} totalPages={pageCount} onChange={setPage} />}
            </HStack>
          </VStack>
          {editing && (
            <PriceDialog
              record={editing === 'new' ? null : editing}
              readOnly={editing === 'new' ? !perms.create : !perms.edit}
              suppliers={suppliers}
              products={products}
              onClose={() => setEditing(null)}
              onSaved={message => {
                setEditing(null);
                toast({body: message});
                router.refresh();
              }}
            />
          )}
          <AlertDialog
            isOpen={!!deleting}
            onOpenChange={open => !open && setDeleting(null)}
            title={`Xóa ${deleting?.code ?? ''}?`}
            description="Giá nhập này sẽ bị xóa khỏi bảng giá NCC và bảng so sánh. Không thể hoàn tác."
            actionLabel="Xóa"
            cancelLabel="Hủy"
            actionVariant="destructive"
            onAction={async () => {
              if (!deleting) return;
              const result = await deleteSupplierPriceAction(deleting.id);
              setDeleting(null);
              toast({body: result.message, type: result.ok ? 'info' : 'error'});
              if (result.ok) router.refresh();
            }}
          />
        </LayoutContent>
      }
    />
  );
}

function PriceDialog({
  record,
  readOnly,
  suppliers,
  products,
  onClose,
  onSaved,
}: {
  record: SupplierPriceRow | null;
  readOnly: boolean;
  suppliers: Option[];
  products: Option[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [supplierId, setSupplierId] = useState<string | null>(record ? String(record.supplierId) : null);
  const [productId, setProductId] = useState<string | null>(record ? String(record.productId) : null);
  const [price, setPrice] = useState<number | null>(record?.price ?? null);
  const [currency, setCurrency] = useState(record?.currency ?? 'VND');
  const [note, setNote] = useState(record?.note ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!supplierId) return setMessage('Vui lòng chọn nhà cung cấp.');
    if (!productId) return setMessage('Vui lòng chọn sản phẩm.');
    if (price === null) return setMessage('Vui lòng nhập giá nhập.');
    setMessage(null);
    startTransition(async () => {
      const result = await saveSupplierPriceAction({
        id: record?.id ?? null,
        supplierId: Number(supplierId),
        productId: Number(productId),
        price,
        currency,
        note,
      });
      if (result.ok) onSaved(result.message);
      else setMessage(result.message);
    });
  };

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="form" width={640}>
      <Layout
        header={
          <DialogHeader
            title={record ? `${readOnly ? '' : 'Sửa '}${record.code}` : 'Thêm giá NCC'}
            subtitle="Mã được phần mềm tự sinh. Trường có dấu * là bắt buộc."
            onOpenChange={() => onClose()}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              {message && <Banner status="error" title={message} container="card" collapsible={false} />}
              <Grid columns={{minWidth: 260, max: 2}} gap={4}>
                <Selector
                  label="Nhà cung cấp"
                  isRequired
                  hasSearch
                  options={suppliers}
                  value={supplierId ?? undefined}
                  placeholder="Chọn nhà cung cấp"
                  onChange={(v: string) => !readOnly && setSupplierId(v || null)}
                />
                <Selector
                  label="Sản phẩm"
                  isRequired
                  hasSearch
                  options={products}
                  value={productId ?? undefined}
                  placeholder="Chọn sản phẩm"
                  onChange={(v: string) => !readOnly && setProductId(v || null)}
                />
                <NumberInput
                  label="Giá nhập"
                  isRequired
                  isReadOnly={readOnly}
                  value={price}
                  onChange={setPrice}
                  min={0}
                  step={1000}
                  placeholder="Giá nhập"
                />
                <Selector
                  label="Tiền tệ"
                  isRequired
                  options={CURRENCIES}
                  value={currency}
                  onChange={(v: string) => !readOnly && setCurrency(v || 'VND')}
                />
              </Grid>
              <TextArea label="Ghi chú" isReadOnly={readOnly} value={note} onChange={setNote} />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label={readOnly ? 'Đóng' : 'Hủy'} variant="secondary" onClick={onClose} />
              {!readOnly && <Button label="Lưu" variant="primary" isLoading={isPending} onClick={submit} />}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
