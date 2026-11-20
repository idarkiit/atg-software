import {computeTotals, type DocKindDef} from '@/lib/stock/kinds';
import type {DocFormData, DocInput, ProductOpt, RefDocOpt} from '@/server/stock';
import {addDaysISO} from './format';

/** One line of the voucher being edited. */
export type EditorLine = {
  key: string;
  productId: number;
  qty: number;
  unitPrice: number;
  discount: number;
  lineDir: 'in' | 'out';
  /** Price still follows the default (price list / supplier price); false once the user typed one. */
  priceAuto: boolean;
};

export type FormState = {
  typeId: string | null;
  docDate: string;
  warehouseId: string;
  toWarehouseId: string | null;
  partyId: string | null;
  refDocId: number | null;
  priceLevel: 1 | 2 | 3;
  dueDate: string | null;
  dueTouched: boolean;
  invoiceNo: string;
  vatRate: number;
  otherCost: number;
  discountAmount: number;
  paidAmount: number;
  method: 'cash' | 'bank';
  reason: string;
  note: string;
  lines: EditorLine[];
  defectChecked: boolean;
};

export type RefLineInfo = {maxQty: number; price: number};

export function initialState(def: DocKindDef, fd: DocFormData): FormState {
  return {
    typeId: fd.types[0]?.value ?? null,
    docDate: fd.today,
    warehouseId: fd.warehouses[0]?.value ?? '',
    toWarehouseId: null,
    partyId: null,
    refDocId: null,
    priceLevel: 1,
    dueDate: null,
    dueTouched: false,
    invoiceNo: '',
    vatRate: def.kind === 'sale_vat' ? fd.vatRate : 0,
    otherCost: 0,
    discountAmount: 0,
    paidAmount: 0,
    method: 'cash',
    reason: '',
    note: '',
    lines: [],
    defectChecked: false,
  };
}

export function isOutgoing(def: DocKindDef, line: EditorLine): boolean {
  return def.direction === 'out' || def.direction === 'transfer' || (def.direction === 'convert' && line.lineDir === 'out');
}

export function defaultPrice(def: DocKindDef, p: ProductOpt, ctx: {priceLevel: number; supplierId: string | null; refPrice?: number}): number {
  switch (def.priceSource) {
    case 'sale':
      return p.salePrices[ctx.priceLevel - 1] ?? 0;
    case 'supplier':
      return (ctx.supplierId && p.supplierPrices[ctx.supplierId]) || p.avgCost;
    case 'ref':
      return ctx.refPrice ?? 0;
    default:
      return 0;
  }
}

/** Per product: how many are still returnable on the original voucher and at which net price. */
export function refLineInfo(ref: RefDocOpt | undefined): Map<number, RefLineInfo> {
  const map = new Map<number, RefLineInfo>();
  if (!ref) return map;
  const grouped = new Map<number, {qty: number; value: number; returned: number}>();
  for (const l of ref.lines) {
    const g = grouped.get(l.productId) ?? {qty: 0, value: 0, returned: l.returnedQty};
    g.qty += l.qty;
    g.value += l.qty * l.unitPrice;
    grouped.set(l.productId, g);
  }
  for (const [pid, g] of grouped) {
    map.set(pid, {maxQty: Math.max(0, g.qty - g.returned), price: g.qty ? Math.round(g.value / g.qty) : 0});
  }
  return map;
}

export function hasReturnable(ref: RefDocOpt): boolean {
  for (const info of refLineInfo(ref).values()) if (info.maxQty > 0) return true;
  return false;
}

export function autoDueDate(def: DocKindDef, fd: DocFormData, f: FormState): string | null {
  if (def.debt?.party !== 'customer' || def.debt.sign !== 1 || !f.partyId) return null;
  const c = fd.customers.find(x => x.value === f.partyId);
  if (!c || !c.allowDebt) return null;
  return addDaysISO(f.docDate, c.debtDays);
}

export type DefectMatch = {lineKey: string; productId: number; defectType: string; detail: string | null};

export function matchDefects(def: DocKindDef, fd: DocFormData, f: FormState): DefectMatch[] {
  if (!def.checkDefects) return [];
  const supplierId = def.party === 'supplier' && f.partyId ? Number(f.partyId) : null;
  const out: DefectMatch[] = [];
  for (const line of f.lines) {
    for (const d of fd.defects) {
      if (d.productId !== line.productId) continue;
      if (d.supplierId && supplierId && d.supplierId !== supplierId) continue;
      out.push({lineKey: line.key, productId: line.productId, defectType: d.defectType, detail: d.detail});
    }
  }
  return out;
}

export function computeAll(def: DocKindDef, fd: DocFormData, f: FormState) {
  const priced = def.priced;
  const totals = computeTotals(
    f.lines.map(l => ({qty: l.qty, unitPrice: priced ? l.unitPrice : 0, discount: priced ? l.discount : 0})),
    {discountAmount: priced ? f.discountAmount : 0, vatRate: f.vatRate, otherCost: f.otherCost, vat: def.vat},
  );
  const prodBy = new Map(fd.products.map(p => [p.id, p]));
  let costOut = 0;
  for (const l of f.lines) {
    if (isOutgoing(def, l)) costOut += l.qty * (prodBy.get(l.productId)?.avgCost ?? 0);
  }
  return {...totals, costOut: Math.round(costOut), debt: Math.max(0, totals.total - f.paidAmount)};
}

/** Client-side validation that mirrors the server's checks. Returns a Vietnamese message or null. */
export function validateForm(def: DocKindDef, fd: DocFormData, f: FormState, refInfo: Map<number, RefLineInfo>): string | null {
  if (!f.docDate) return 'Chưa chọn ngày phiếu.';
  if (!f.warehouseId) return 'Chưa chọn kho.';
  if (def.direction === 'transfer') {
    if (!f.toWarehouseId) return 'Chưa chọn kho nhận.';
    if (f.toWarehouseId === f.warehouseId) return 'Kho nhận phải khác kho xuất.';
  }
  if (def.refKind && !f.refDocId) return 'Chưa chọn phiếu gốc.';
  if (def.partyRequired && !f.partyId) {
    return def.party === 'customer' ? 'Chưa chọn khách hàng.' : 'Chưa chọn nhà cung cấp.';
  }
  if (def.reasonRequired && !f.reason.trim()) return `Chưa nhập ${(def.reasonLabel ?? 'lý do').toLowerCase()}.`;
  if (!f.lines.length) return 'Phiếu chưa có sản phẩm nào.';
  const prodBy = new Map(fd.products.map(p => [p.id, p]));
  for (const l of f.lines) {
    const code = prodBy.get(l.productId)?.code ?? '';
    if (!(l.qty > 0)) return `${code}: số lượng phải lớn hơn 0.`;
    if (def.priced && l.unitPrice < 0) return `${code}: đơn giá không được âm.`;
    if (def.refKind) {
      const info = refInfo.get(l.productId);
      if (!info) return `${code}: không có trên phiếu gốc.`;
      const sameQty = f.lines.filter(x => x.productId === l.productId).reduce((s, x) => s + x.qty, 0);
      if (sameQty > info.maxQty) return `${code}: chỉ còn trả được ${info.maxQty} trên phiếu gốc.`;
    }
  }
  if (def.direction === 'convert') {
    if (!f.lines.some(l => l.lineDir === 'out') || !f.lines.some(l => l.lineDir === 'in')) {
      return 'Chuyển đổi tồn cần ít nhất một mã xuất và một mã nhập.';
    }
  }
  if (def.payment) {
    const {total} = computeAll(def, fd, f);
    if (f.paidAmount < 0) return 'Số tiền thanh toán không được âm.';
    if (f.paidAmount > total) return 'Số tiền thanh toán lớn hơn tổng tiền phiếu.';
  }
  return null;
}

export function buildInput(def: DocKindDef, fd: DocFormData, f: FormState): DocInput {
  const partyId = f.partyId ? Number(f.partyId) : null;
  const dueDate = f.dueTouched ? f.dueDate : autoDueDate(def, fd, f);
  return {
    kind: def.kind,
    typeId: f.typeId ? Number(f.typeId) : null,
    warehouseId: Number(f.warehouseId),
    toWarehouseId: def.direction === 'transfer' && f.toWarehouseId ? Number(f.toWarehouseId) : null,
    customerId: def.party === 'customer' ? partyId : null,
    supplierId: def.party === 'supplier' ? partyId : null,
    employeeId: def.party === 'employee' ? partyId : null,
    refDocId: f.refDocId,
    docDate: f.docDate,
    dueDate: def.debt ? dueDate : null,
    priceLevel: f.priceLevel,
    invoiceNo: def.vat ? f.invoiceNo.trim() || null : null,
    vatRate: def.vat ? f.vatRate : 0,
    discountAmount: def.priced ? f.discountAmount : 0,
    otherCost: def.kind === 'purchase' ? f.otherCost : 0,
    paidAmount: def.payment ? f.paidAmount : 0,
    paymentMethod: def.payment && f.paidAmount > 0 ? f.method : null,
    reason: def.reasonLabel ? f.reason.trim() || null : null,
    note: f.note.trim() || null,
    lines: f.lines.map(l => ({
      productId: l.productId,
      qty: l.qty,
      unitPrice: def.priced ? l.unitPrice : undefined,
      discount: def.priced ? l.discount : undefined,
      lineDir: def.direction === 'convert' ? l.lineDir : undefined,
    })),
  };
}
