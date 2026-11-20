'use client';

import {useMemo, useRef, useState} from 'react';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Grid} from '@astryxdesign/core/Grid';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Typeahead, createStaticSource, type SearchableItem} from '@astryxdesign/core/Typeahead';
import {Token} from '@astryxdesign/core/Token';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {useToast} from '@astryxdesign/core/Toast';
import {TrashIcon, QrCodeIcon} from '@heroicons/react/24/outline';
import {lineAmount, type DocKindDef} from '@/lib/stock/kinds';
import type {DocFormData, ProductOpt} from '@/server/stock';
import {isOutgoing, type DefectMatch, type EditorLine, type RefLineInfo} from './editorLogic';
import {fmtMoney, fmtQty} from './format';

type Props = {
  def: DocKindDef;
  fd: DocFormData;
  warehouseId: string;
  lines: EditorLine[];
  /** Products allowed on this voucher (all, or only those of the original voucher). */
  allowed: ProductOpt[];
  refInfo: Map<number, RefLineInfo>;
  defects: DefectMatch[];
  onAdd: (p: ProductOpt) => void;
  onChange: (key: string, patch: Partial<EditorLine>) => void;
  onRemove: (key: string) => void;
};

type ProductItem = SearchableItem<ProductOpt>;

export function DocLinesTable({def, fd, warehouseId, lines, allowed, refInfo, defects, onAdd, onChange, onRemove}: Props) {
  const toast = useToast();
  const [scan, setScan] = useState('');
  const [pickerKey, setPickerKey] = useState(0);
  const scanRef = useRef<HTMLInputElement>(null);

  const prodBy = useMemo(() => new Map(fd.products.map(p => [p.id, p])), [fd.products]);
  const source = useMemo(
    () =>
      createStaticSource<ProductItem>(
        allowed.map(p => ({id: String(p.id), label: `${p.code} · ${p.name}`, auxiliaryData: p})),
        {keywords: item => [item.auxiliaryData?.code ?? '', item.auxiliaryData?.name ?? '', item.auxiliaryData?.barcode ?? '']},
      ),
    [allowed],
  );

  const onScan = () => {
    const q = scan.trim().toLowerCase();
    if (!q) return;
    const p = allowed.find(x => x.barcode?.toLowerCase() === q) ?? allowed.find(x => x.code.toLowerCase() === q);
    if (!p) {
      toast({body: `Không tìm thấy sản phẩm có mã "${scan.trim()}"${def.refKind ? ' trên phiếu gốc' : ''}.`, type: 'error'});
    } else {
      onAdd(p);
    }
    setScan('');
    scanRef.current?.focus();
  };

  const defectKeys = new Set(defects.map(d => d.lineKey));
  const outQty = new Map<number, number>();
  for (const l of lines) if (isOutgoing(def, l)) outQty.set(l.productId, (outQty.get(l.productId) ?? 0) + l.qty);

  const columns: TableColumn<EditorLine>[] = [
    {
      key: 'code',
      header: 'Mã',
      width: pixel(120),
      renderCell: l => (
        <VStack gap={0.5}>
          <Text type="body" weight="semibold">{prodBy.get(l.productId)?.code}</Text>
          {defectKeys.has(l.key) && <Token label="Có cảnh báo lỗi" color="orange" size="sm" />}
        </VStack>
      ),
    },
    {key: 'name', header: 'Tên', width: proportional(3, {minWidth: 200}), renderCell: l => <Text type="body">{prodBy.get(l.productId)?.name}</Text>},
    {key: 'unit', header: 'ĐVT', width: pixel(64), renderCell: l => <Text type="body">{prodBy.get(l.productId)?.unit}</Text>},
    ...(def.direction === 'convert'
      ? [
          {
            key: 'dir',
            header: 'Xuất / Nhập',
            width: pixel(120),
            renderCell: (l: EditorLine) => (
              <Selector
                label="Xuất hoặc nhập"
                isLabelHidden
                size="sm"
                options={[
                  {value: 'out', label: 'Xuất'},
                  {value: 'in', label: 'Nhập'},
                ]}
                value={l.lineDir}
                onChange={(v: string) => onChange(l.key, {lineDir: v === 'in' ? 'in' : 'out'})}
              />
            ),
          },
        ]
      : []),
    {
      key: 'stock',
      header: 'Tồn kho',
      width: pixel(110),
      align: 'end',
      renderCell: l => {
        const stock = prodBy.get(l.productId)?.stock[warehouseId] ?? 0;
        const over = isOutgoing(def, l) && !fd.allowNegativeStock && (outQty.get(l.productId) ?? 0) > stock;
        return over ? (
          <HStack gap={1} vAlign="center">
            <StatusDot variant="error" label="Vượt tồn kho" />
            <Text type="body" weight="semibold">{fmtQty(stock)}</Text>
          </HStack>
        ) : (
          <Text type="body">{fmtQty(stock)}</Text>
        );
      },
    },
    {
      key: 'qty',
      header: 'Số lượng',
      width: pixel(120),
      align: 'end',
      renderCell: l => {
        const stock = prodBy.get(l.productId)?.stock[warehouseId] ?? 0;
        const over = isOutgoing(def, l) && !fd.allowNegativeStock && (outQty.get(l.productId) ?? 0) > stock;
        const max = def.refKind ? refInfo.get(l.productId)?.maxQty : undefined;
        return (
          <NumberInput
            label="Số lượng"
            isLabelHidden
            size="sm"
            min={0}
            max={max}
            value={l.qty}
            status={over ? {type: 'warning', message: 'Vượt tồn kho'} : undefined}
            statusVariant="tooltip"
            onChange={v => onChange(l.key, {qty: v})}
          />
        );
      },
    },
    ...(def.priced
      ? [
          {
            key: 'price',
            header: 'Đơn giá',
            width: pixel(140),
            align: 'end' as const,
            renderCell: (l: EditorLine) => (
              <NumberInput
                label="Đơn giá"
                isLabelHidden
                size="sm"
                min={0}
                units="đ"
                value={l.unitPrice}
                onChange={v => onChange(l.key, {unitPrice: v, priceAuto: false})}
              />
            ),
          },
          {
            key: 'discount',
            header: 'Giảm giá',
            width: pixel(130),
            align: 'end' as const,
            renderCell: (l: EditorLine) => (
              <NumberInput label="Giảm giá" isLabelHidden size="sm" min={0} units="đ" value={l.discount} onChange={v => onChange(l.key, {discount: v})} />
            ),
          },
          {
            key: 'amount',
            header: 'Thành tiền',
            width: pixel(130),
            align: 'end' as const,
            renderCell: (l: EditorLine) => <Text type="body" weight="semibold">{fmtMoney(lineAmount(l))}</Text>,
          },
        ]
      : [
          {
            key: 'cost',
            header: 'Giá vốn',
            width: pixel(140),
            align: 'end' as const,
            renderCell: (l: EditorLine) => {
              const avg = prodBy.get(l.productId)?.avgCost ?? 0;
              return (
                <VStack gap={0}>
                  <Text type="body" weight="semibold">{fmtMoney(avg * l.qty)}</Text>
                  <Text type="body" color="secondary" size="sm">{`${fmtMoney(avg)} / ${prodBy.get(l.productId)?.unit ?? ''}`}</Text>
                </VStack>
              );
            },
          },
        ]),
    {
      key: '__remove',
      header: '',
      width: pixel(52),
      renderCell: l => <IconButton label="Xóa dòng" size="sm" variant="ghost" icon={<Icon icon={TrashIcon} />} onClick={() => onRemove(l.key)} />,
    },
  ];

  return (
    <VStack gap={3}>
      <Grid columns={{minWidth: 280, max: 2}} gap={3}>
        <Typeahead<ProductItem>
          key={pickerKey}
          label="Thêm sản phẩm"
          placeholder="Gõ mã, tên hoặc mã vạch…"
          searchSource={source}
          value={null}
          hasClear={false}
          maxMenuItems={12}
          emptySearchText="Không có sản phẩm phù hợp"
          onChange={item => {
            if (item?.auxiliaryData) {
              onAdd(item.auxiliaryData);
              setPickerKey(k => k + 1);
            }
          }}
        />
        <TextInput
          ref={scanRef}
          label="Quét mã"
          placeholder="Quét mã vạch hoặc gõ mã sản phẩm rồi Enter"
          startIcon={QrCodeIcon}
          value={scan}
          onChange={setScan}
          onEnter={onScan}
        />
      </Grid>
      {def.direction === 'convert' && (
        <Text type="body" color="secondary" size="sm">
          Chọn Xuất hoặc Nhập cho từng dòng. Tổng giá vốn của các dòng &quot;Xuất&quot; được chuyển sang các dòng &quot;Nhập&quot; (chia theo số lượng), nên giá trị tồn kho không đổi.
        </Text>
      )}
      <Table<EditorLine> data={lines} columns={columns} idKey="key" density="compact" textOverflow="wrap" />
      {!lines.length && (
        <HStack hAlign="center">
          <Text type="body" color="secondary">Chưa có sản phẩm. Tìm hoặc quét mã để thêm vào phiếu.</Text>
        </HStack>
      )}
      {lines.length > 0 && (
        <HStack hAlign="end">
          <Button label="Xóa hết dòng" variant="ghost" size="sm" onClick={() => lines.forEach(l => onRemove(l.key))} />
        </HStack>
      )}
    </VStack>
  );
}
