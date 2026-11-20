/**
 * Business rules for every kind of warehouse voucher (phiếu).
 * Shared by the server (posting, validation) and the client (voucher editor).
 */

export type DocKind =
  | 'sale'
  | 'sale_vat'
  | 'sale_return'
  | 'purchase'
  | 'purchase_return'
  | 'dispose'
  | 'internal'
  | 'transfer'
  | 'convert';

export type DocKindDef = {
  kind: DocKind;
  /** Feature key "module/fn" of the voucher screen. */
  feature: string;
  title: string;
  /** Lower-case noun used in buttons, e.g. "phiếu xuất bán". */
  noun: string;
  codePrefix: string;
  /** Effect on stock of the source warehouse. convert = per line (lineDir). */
  direction: 'in' | 'out' | 'transfer' | 'convert';
  party: 'customer' | 'supplier' | 'employee' | null;
  partyRequired: boolean;
  /** Lines carry a price the user types (sale/purchase). Otherwise lines are valued at cost. */
  priced: boolean;
  /** Where the default line price comes from. */
  priceSource: 'sale' | 'supplier' | 'cost' | 'ref';
  /** Has payment now / debt (công nợ). */
  payment: boolean;
  /** Which debt the voucher changes: + increases what the party owes us / we owe them. */
  debt: {party: 'customer' | 'supplier'; sign: 1 | -1} | null;
  vat: boolean;
  /** Return vouchers pick the original voucher (lines and prices come from it). */
  refKind: DocKind | DocKind[] | null;
  reasonLabel: string | null;
  reasonRequired: boolean;
  /** Offer the "Check lỗi" button against the defective product list. */
  checkDefects: boolean;
  description: string;
};

export const DOC_KINDS: Record<DocKind, DocKindDef> = {
  sale: {
    kind: 'sale',
    feature: 'xuat-nhap/phieu-xuat-ban',
    title: 'Phiếu xuất bán',
    noun: 'phiếu xuất bán',
    codePrefix: 'PXB',
    direction: 'out',
    party: 'customer',
    partyRequired: true,
    priced: true,
    priceSource: 'sale',
    payment: true,
    debt: {party: 'customer', sign: 1},
    vat: false,
    refKind: null,
    reasonLabel: null,
    reasonRequired: false,
    checkDefects: true,
    description: 'Bán hàng cho khách: giá lấy theo bảng giá bán, thanh toán ngay hoặc ghi công nợ, trừ tồn kho.',
  },
  sale_vat: {
    kind: 'sale_vat',
    feature: 'xuat-nhap/xuat-vat',
    title: 'Phiếu xuất thuế (VAT)',
    noun: 'phiếu xuất VAT',
    codePrefix: 'PXV',
    direction: 'out',
    party: 'customer',
    partyRequired: true,
    priced: true,
    priceSource: 'sale',
    payment: true,
    debt: {party: 'customer', sign: 1},
    vat: true,
    refKind: null,
    reasonLabel: null,
    reasonRequired: false,
    checkDefects: true,
    description: 'Phiếu xuất có hóa đơn VAT. Phiếu này và sản phẩm thuế hiện ở bản phần mềm quản lý thuế.',
  },
  sale_return: {
    kind: 'sale_return',
    feature: 'xuat-nhap/khach-tra-hang',
    title: 'Nhập lại hàng xuất bán',
    noun: 'phiếu khách trả hàng',
    codePrefix: 'PKT',
    direction: 'in',
    party: 'customer',
    partyRequired: true,
    priced: true,
    priceSource: 'ref',
    payment: true,
    debt: {party: 'customer', sign: -1},
    vat: false,
    refKind: ['sale', 'sale_vat'],
    reasonLabel: 'Lý do trả hàng',
    reasonRequired: true,
    checkDefects: false,
    description: 'Khách trả lại hàng đã mua: cộng lại tồn kho, giảm công nợ hoặc hoàn tiền cho khách.',
  },
  purchase: {
    kind: 'purchase',
    feature: 'xuat-nhap/phieu-nhap',
    title: 'Phiếu nhập',
    noun: 'phiếu nhập',
    codePrefix: 'PN',
    direction: 'in',
    party: 'supplier',
    partyRequired: true,
    priced: true,
    priceSource: 'supplier',
    payment: true,
    debt: {party: 'supplier', sign: 1},
    vat: true,
    refKind: null,
    reasonLabel: null,
    reasonRequired: false,
    checkDefects: true,
    description: 'Nhập kho hàng mua trong nước hoặc nhập khẩu: số lượng, giá, chi phí phân bổ vào giá vốn, cộng tồn.',
  },
  purchase_return: {
    kind: 'purchase_return',
    feature: 'xuat-nhap/tra-hang-ncc',
    title: 'Trả lại hàng nhập',
    noun: 'phiếu trả hàng NCC',
    codePrefix: 'PTN',
    direction: 'out',
    party: 'supplier',
    partyRequired: true,
    priced: true,
    priceSource: 'ref',
    payment: true,
    debt: {party: 'supplier', sign: -1},
    vat: false,
    refKind: 'purchase',
    reasonLabel: 'Lý do trả hàng',
    reasonRequired: true,
    checkDefects: false,
    description: 'Trả lại hàng đã nhập cho nhà cung cấp: trừ tồn kho, giảm công nợ phải trả.',
  },
  dispose: {
    kind: 'dispose',
    feature: 'xuat-nhap/xuat-huy',
    title: 'Phiếu xuất hủy',
    noun: 'phiếu xuất hủy',
    codePrefix: 'PXH',
    direction: 'out',
    party: null,
    partyRequired: false,
    priced: false,
    priceSource: 'cost',
    payment: false,
    debt: null,
    vat: false,
    refKind: null,
    reasonLabel: 'Lý do hủy',
    reasonRequired: true,
    checkDefects: false,
    description: 'Xuất hủy hàng hỏng, mất, hết hạn: trừ tồn, ghi lý do và giá trị tổn thất theo giá vốn.',
  },
  internal: {
    kind: 'internal',
    feature: 'xuat-nhap/xuat-noi-bo',
    title: 'Phiếu xuất nội bộ',
    noun: 'phiếu xuất nội bộ',
    codePrefix: 'PXN',
    direction: 'out',
    party: 'employee',
    partyRequired: false,
    priced: false,
    priceSource: 'cost',
    payment: false,
    debt: null,
    vat: false,
    refKind: null,
    reasonLabel: 'Mục đích sử dụng',
    reasonRequired: true,
    checkDefects: false,
    description: 'Xuất hàng dùng nội bộ (hàng mẫu, quà tặng, dùng cho bảo hành…): trừ tồn, tính vào chi phí theo giá vốn.',
  },
  transfer: {
    kind: 'transfer',
    feature: 'xuat-nhap/chuyen-kho',
    title: 'Phiếu chuyển kho',
    noun: 'phiếu chuyển kho',
    codePrefix: 'PCK',
    direction: 'transfer',
    party: null,
    partyRequired: false,
    priced: false,
    priceSource: 'cost',
    payment: false,
    debt: null,
    vat: false,
    refKind: null,
    reasonLabel: null,
    reasonRequired: false,
    checkDefects: false,
    description: 'Chuyển hàng giữa hai kho: trừ tồn kho đi, cộng tồn kho đến, giữ nguyên giá vốn.',
  },
  convert: {
    kind: 'convert',
    feature: 'xuat-nhap/chuyen-doi-ton',
    title: 'Chuyển đổi tồn',
    noun: 'phiếu chuyển đổi tồn',
    codePrefix: 'PCD',
    direction: 'convert',
    party: null,
    partyRequired: false,
    priced: false,
    priceSource: 'cost',
    payment: false,
    debt: null,
    vat: false,
    refKind: null,
    reasonLabel: 'Lý do chuyển đổi',
    reasonRequired: true,
    checkDefects: false,
    description:
      'Chuyển tồn giữa các mã (tách bộ, gộp bộ, đổi mã) không qua mua bán: trừ các mã "xuất", cộng các mã "nhập". Tổng giá vốn được giữ nguyên.',
  },
};

export const DOC_KIND_LIST = Object.values(DOC_KINDS);

export function docKindByFeature(feature: string): DocKindDef | undefined {
  return DOC_KIND_LIST.find(d => d.feature === feature);
}

export function isDocKind(v: string): v is DocKind {
  return v in DOC_KINDS;
}

/** Display names for "Loại xuất nhập" kind select. */
export const DOC_KIND_OPTIONS = DOC_KIND_LIST.map(d => ({value: d.kind, label: d.title}));

/** Totals of a voucher, computed the same way on client and server. */
export function computeTotals(
  lines: {qty: number; unitPrice: number; discount: number}[],
  opts: {discountAmount: number; vatRate: number; otherCost: number; vat: boolean},
) {
  const subtotal = round(lines.reduce((s, l) => s + lineAmount(l), 0));
  const afterDiscount = Math.max(0, subtotal - (opts.discountAmount || 0));
  const vatAmount = opts.vat ? round((afterDiscount * (opts.vatRate || 0)) / 100) : 0;
  const total = afterDiscount + vatAmount;
  return {subtotal, vatAmount, total};
}

export function lineAmount(l: {qty: number; unitPrice: number; discount: number}) {
  return round((l.qty || 0) * (l.unitPrice || 0) - (l.discount || 0));
}

function round(n: number) {
  return Math.round(n);
}
