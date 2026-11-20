'use client';

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Grid, GridSpan} from '@astryxdesign/core/Grid';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Banner} from '@astryxdesign/core/Banner';
import {Selector} from '@astryxdesign/core/Selector';
import {DateInput} from '@astryxdesign/core/DateInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {useToast} from '@astryxdesign/core/Toast';
import {DOC_KINDS, type DocKind} from '@/lib/stock/kinds';
import type {DocFormData, ProductOpt} from '@/server/stock';
import {createDocAction} from '@/server/actions-stock';
import {DocLinesTable} from './DocLinesTable';
import {DocTotalsPanel} from './DocTotalsPanel';
import {
  autoDueDate,
  buildInput,
  computeAll,
  defaultPrice,
  hasReturnable,
  initialState,
  matchDefects,
  refLineInfo,
  validateForm,
  type EditorLine,
  type FormState,
} from './editorLogic';
import {fmtDate, type ISODate} from './format';

type Props = {kind: DocKind; route: string; formData: DocFormData};

const PARTY_LABEL = {customer: 'Khách hàng', supplier: 'Nhà cung cấp', employee: 'Nhân viên nhận'} as const;

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

export function DocEditor({kind, route, formData: fd}: Props) {
  const def = DOC_KINDS[kind];
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<FormState>(() => initialState(def, fd));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FormState>) => setF(prev => ({...prev, ...patch}));

  const refDoc = fd.refDocs.find(r => r.id === f.refDocId);
  const refInfo = useMemo(() => refLineInfo(refDoc), [refDoc]);
  const refOptions = useMemo(
    () =>
      fd.refDocs.filter(hasReturnable).map(r => ({
        value: String(r.id),
        label: `${r.code} · ${fmtDate(r.docDate)}${r.partyName ? ` · ${r.partyName}` : ''}`,
      })),
    [fd.refDocs],
  );
  const allowed = useMemo<ProductOpt[]>(
    () => (def.refKind ? fd.products.filter(p => (refInfo.get(p.id)?.maxQty ?? 0) > 0) : fd.products),
    [def.refKind, fd.products, refInfo],
  );

  const totals = computeAll(def, fd, f);
  const customer = def.party === 'customer' ? fd.customers.find(c => c.value === f.partyId) : undefined;
  const noDebtCustomer = !!customer && !customer.allowDebt && def.debt?.sign === 1;
  const effectiveDue = f.dueTouched ? f.dueDate : autoDueDate(def, fd, f);
  const defects = f.defectChecked ? matchDefects(def, fd, f) : [];
  const prodBy = new Map(fd.products.map(p => [p.id, p]));

  const priceCtx = (s: FormState) => ({priceLevel: s.priceLevel, supplierId: def.party === 'supplier' ? s.partyId : null});
  /** Re-price lines that still use the default price (after changing price list or supplier). */
  const repriced = (s: FormState): EditorLine[] =>
    s.lines.map(l => {
      const p = prodBy.get(l.productId);
      return l.priceAuto && p ? {...l, unitPrice: defaultPrice(def, p, priceCtx(s))} : l;
    });

  const addProduct = (p: ProductOpt) => {
    const maxQty = def.refKind ? refInfo.get(p.id)?.maxQty : undefined;
    const existing = f.lines.find(l => l.productId === p.id);
    if (existing) {
      if (maxQty !== undefined && existing.qty + 1 > maxQty) {
        toast({body: `${p.code}: chỉ còn trả được ${maxQty} trên phiếu gốc.`, type: 'error'});
        return;
      }
      toast({body: `${p.code}: số lượng ${existing.qty + 1}`});
      setF(prev => ({...prev, lines: prev.lines.map(l => (l.key === existing.key ? {...l, qty: l.qty + 1} : l))}));
      return;
    }
    const hasOut = f.lines.some(l => l.lineDir === 'out');
    const hasIn = f.lines.some(l => l.lineDir === 'in');
    const line: EditorLine = {
      key: newKey(),
      productId: p.id,
      qty: 1,
      unitPrice: defaultPrice(def, p, {...priceCtx(f), refPrice: refInfo.get(p.id)?.price}),
      discount: 0,
      lineDir: def.direction === 'convert' && hasOut && !hasIn ? 'in' : 'out',
      priceAuto: !def.refKind,
    };
    setF(prev => ({...prev, lines: [...prev.lines, line]}));
  };

  const changeLine = (key: string, patch: Partial<EditorLine>) =>
    setF(prev => ({...prev, lines: prev.lines.map(l => (l.key === key ? {...l, ...patch} : l))}));
  const removeLine = (key: string) => setF(prev => ({...prev, lines: prev.lines.filter(l => l.key !== key)}));

  const pickRef = (value: string | null) => {
    const ref = value ? fd.refDocs.find(r => String(r.id) === value) : undefined;
    if (!ref) {
      set({refDocId: null, partyId: null, lines: []});
      return;
    }
    const info = refLineInfo(ref);
    const lines: EditorLine[] = [];
    for (const [productId, i] of info) {
      if (i.maxQty <= 0 || !prodBy.has(productId)) continue;
      lines.push({key: newKey(), productId, qty: i.maxQty, unitPrice: i.price, discount: 0, lineDir: 'out', priceAuto: false});
    }
    setF(prev => ({
      ...prev,
      refDocId: ref.id,
      partyId: ref.partyId ? String(ref.partyId) : null,
      warehouseId: fd.warehouses.some(w => w.value === String(ref.warehouseId)) ? String(ref.warehouseId) : prev.warehouseId,
      vatRate: 0,
      lines,
    }));
  };

  const checkDefects = () => {
    set({defectChecked: true});
    if (!matchDefects(def, fd, f).length) toast({body: 'Không có sản phẩm nào trong danh mục cảnh báo'});
  };

  const save = async () => {
    const problem = validateForm(def, fd, f, refInfo);
    if (problem) {
      setError(problem);
      toast({body: problem, type: 'error'});
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await createDocAction(buildInput(def, fd, f));
      if (result.ok) {
        toast({body: result.message});
        router.push(`${route}/${result.id}`);
      } else {
        setError(result.message);
        toast({body: result.message, type: 'error'});
        setSaving(false);
      }
    } catch {
      setError('Không lưu được phiếu, vui lòng thử lại.');
      setSaving(false);
    }
  };

  const partyOptions = def.party === 'customer' ? fd.customers : def.party === 'supplier' ? fd.suppliers : fd.employees;
  const partyLabel = def.party ? PARTY_LABEL[def.party] : '';

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={1}>
            <Heading level={2}>{`Tạo ${def.noun}`}</Heading>
            <Text type="body" color="secondary" size="sm">{def.description}</Text>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            {error && <Banner status="error" title={error} container="card" collapsible={false} />}

            <Card>
              <VStack gap={3} padding={3}>
                <Heading level={4}>Thông tin phiếu</Heading>
                <Grid columns={{minWidth: 240, max: 4}} gap={3}>
                  {fd.types.length > 0 && (
                    <Selector
                      label="Loại phiếu"
                      options={fd.types}
                      value={f.typeId ?? ''}
                      onChange={(v: string) => set({typeId: v})}
                    />
                  )}
                  <DateInput
                    label="Ngày phiếu"
                    value={f.docDate as ISODate}
                    onChange={v => v && set({docDate: v})}
                  />
                  <Selector
                    label={def.direction === 'transfer' ? 'Kho đi' : 'Kho'}
                    options={fd.warehouses}
                    value={f.warehouseId}
                    isDisabled={!!def.refKind && !!f.refDocId}
                    onChange={(v: string) => set({warehouseId: v})}
                  />
                  {def.direction === 'transfer' && (
                    <Selector
                      label="Kho nhận"
                      isRequired
                      hasClear
                      options={fd.allWarehouses.filter(w => w.value !== f.warehouseId)}
                      value={f.toWarehouseId}
                      placeholder="Chọn kho nhận"
                      onChange={(v: string | null) => set({toWarehouseId: v})}
                    />
                  )}
                  {def.refKind && (
                    <Selector
                      label="Phiếu gốc"
                      isRequired
                      hasClear
                      hasSearch
                      options={refOptions}
                      value={f.refDocId ? String(f.refDocId) : null}
                      placeholder="Chọn phiếu gốc"
                      emptyText="Chưa có phiếu nào còn hàng để trả"
                      onChange={pickRef}
                    />
                  )}
                  {def.party && (
                    <Selector
                      label={partyLabel}
                      isRequired={def.partyRequired}
                      hasClear
                      hasSearch
                      options={partyOptions}
                      value={f.partyId}
                      placeholder={`Chọn ${partyLabel.toLowerCase()}`}
                      isDisabled={!!def.refKind}
                      description={def.refKind ? 'Lấy theo phiếu gốc' : undefined}
                      onChange={(v: string | null) => {
                        const next = {...f, partyId: v};
                        set({partyId: v, lines: repriced(next)});
                      }}
                    />
                  )}
                  {def.priceSource === 'sale' && (
                    <Selector
                      label="Bảng giá"
                      options={[
                        {value: '1', label: 'Bảng giá 1'},
                        {value: '2', label: 'Bảng giá 2'},
                        {value: '3', label: 'Bảng giá 3'},
                      ]}
                      value={String(f.priceLevel)}
                      onChange={(v: string) => {
                        const level = (Number(v) || 1) as 1 | 2 | 3;
                        set({priceLevel: level, lines: repriced({...f, priceLevel: level})});
                      }}
                    />
                  )}
                  {def.debt?.sign === 1 && (
                    <DateInput
                      label="Hạn thanh toán"
                      hasClear
                      value={(effectiveDue ?? undefined) as ISODate | undefined}
                      onChange={v => set({dueDate: v ?? null, dueTouched: true})}
                    />
                  )}
                  {def.vat && (
                    <>
                      <TextInput label="Số hóa đơn" value={f.invoiceNo} onChange={v => set({invoiceNo: v})} />
                      <NumberInput label="Thuế VAT" min={0} max={100} units="%" value={f.vatRate} onChange={v => set({vatRate: v})} />
                    </>
                  )}
                  {def.kind === 'purchase' && (
                    <NumberInput
                      label="Chi phí phân bổ"
                      min={0}
                      units="đ"
                      description="Cộng vào giá vốn, không cộng vào công nợ NCC"
                      value={f.otherCost}
                      onChange={v => set({otherCost: v})}
                    />
                  )}
                  {def.reasonLabel && (
                    <GridSpan columns="full">
                      <TextArea
                        label={def.reasonLabel}
                        isRequired={def.reasonRequired}
                        rows={2}
                        value={f.reason}
                        onChange={v => set({reason: v})}
                      />
                    </GridSpan>
                  )}
                  <GridSpan columns="full">
                    <TextInput label="Ghi chú" value={f.note} onChange={v => set({note: v})} />
                  </GridSpan>
                </Grid>
              </VStack>
            </Card>

            <Card>
              <VStack gap={3} padding={3}>
                <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
                  <Heading level={4}>Sản phẩm</Heading>
                  {def.checkDefects && <Button label="Check lỗi" variant="secondary" onClick={checkDefects} />}
                </HStack>
                {def.refKind && !refDoc && (
                  <Banner status="info" title="Chọn phiếu gốc trước" description="Sản phẩm, số lượng tối đa và giá trả lấy theo phiếu gốc." container="card" collapsible={false} />
                )}
                {def.checkDefects && f.defectChecked && defects.length > 0 && (
                  <VStack gap={2}>
                    <Banner
                      status="warning"
                      title={`Có ${defects.length} cảnh báo sản phẩm lỗi trên phiếu`}
                      description="Các dòng được đánh dấu bên dưới nằm trong danh mục sản phẩm lỗi cần cảnh báo."
                      container="card"
                      collapsible={false}
                    />
                    {defects.map((d, i) => (
                      <HStack key={`${d.lineKey}-${i}`} hAlign="between" vAlign="center" gap={3}>
                        <Text type="body">
                          {`${prodBy.get(d.productId)?.code} · ${prodBy.get(d.productId)?.name}: ${d.defectType}${d.detail ? ` (${d.detail})` : ''}`}
                        </Text>
                        <Button label="Xóa khỏi phiếu" size="sm" variant="secondary" onClick={() => removeLine(d.lineKey)} />
                      </HStack>
                    ))}
                  </VStack>
                )}
                <DocLinesTable
                  def={def}
                  fd={fd}
                  warehouseId={f.warehouseId}
                  lines={f.lines}
                  allowed={allowed}
                  refInfo={refInfo}
                  defects={defects}
                  onAdd={addProduct}
                  onChange={changeLine}
                  onRemove={removeLine}
                />
              </VStack>
            </Card>

            <Card>
              <VStack gap={3} padding={3}>
                <Heading level={4}>{def.priced ? 'Tổng tiền và thanh toán' : 'Giá trị phiếu'}</Heading>
                <DocTotalsPanel def={def} f={f} totals={totals} noDebtCustomer={noDebtCustomer} set={set} />
              </VStack>
            </Card>
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Hủy bỏ" variant="secondary" href={route} />
            <Button label="Lưu phiếu" variant="primary" isLoading={saving} onClick={save} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}
