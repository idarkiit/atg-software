import 'server-only';
import {and, asc, desc, eq, gte, inArray, lte, sql} from 'drizzle-orm';
import {getDb, schema, type DB} from '@/db';
import {can, type CurrentUser} from '@/lib/auth';
import {DOC_KINDS, computeTotals, lineAmount, type DocKind, type DocKindDef} from '@/lib/stock/kinds';
import {friendlyDbError, nextCode, writeAudit} from './resources';
import {getSettings, isTaxMode} from './toggles';

/**
 * Warehouse vouchers and the stock ledger.
 *
 * - Posting a voucher inserts stock_moves (+ in, − out). On-hand is the sum of moves.
 * - Cost uses the moving weighted average over all warehouses: every outgoing move is
 *   valued at the average at posting time, so sum(qty × unitCost) is the stock value.
 * - Vouchers are not edited after posting; cancel and create a new one instead.
 * - Debt (công nợ) is derived from vouchers and debt_payments, never stored.
 */

// ------------------------------------------------------------------ queries

/** On-hand quantity per product in one warehouse (or all warehouses of a branch). */
export async function getOnHand(
  db: DB,
  productIds: number[],
  scope: {warehouseId?: number; branchId?: number},
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!productIds.length) return map;
  const conds = [inArray(schema.stockMoves.productId, productIds)];
  if (scope.warehouseId) conds.push(eq(schema.stockMoves.warehouseId, scope.warehouseId));
  if (scope.branchId) conds.push(eq(schema.stockMoves.branchId, scope.branchId));
  const rows = await db
    .select({productId: schema.stockMoves.productId, qty: sql<string>`sum(${schema.stockMoves.qty})`})
    .from(schema.stockMoves)
    .where(and(...conds))
    .groupBy(schema.stockMoves.productId);
  for (const r of rows) map.set(r.productId, Number(r.qty));
  return map;
}

/**
 * Moving average cost per product (company-wide). Falls back to the last purchase
 * cost when stock is zero, then to the typed-in average cost (Bảng giá trung bình).
 */
export async function getAvgCost(db: DB, productIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!productIds.length) return map;
  const rows = await db
    .select({
      productId: schema.stockMoves.productId,
      qty: sql<string>`sum(${schema.stockMoves.qty})`,
      value: sql<string>`sum(${schema.stockMoves.qty} * ${schema.stockMoves.unitCost})`,
    })
    .from(schema.stockMoves)
    .where(inArray(schema.stockMoves.productId, productIds))
    .groupBy(schema.stockMoves.productId);
  for (const r of rows) {
    const q = Number(r.qty);
    if (q > 0) map.set(r.productId, Math.round(Number(r.value) / q));
  }
  const missing = productIds.filter(id => !map.has(id));
  if (missing.length) {
    const last = await db
      .selectDistinctOn([schema.stockMoves.productId], {
        productId: schema.stockMoves.productId,
        unitCost: schema.stockMoves.unitCost,
      })
      .from(schema.stockMoves)
      .where(and(inArray(schema.stockMoves.productId, missing), sql`${schema.stockMoves.qty} > 0`))
      .orderBy(schema.stockMoves.productId, desc(schema.stockMoves.id));
    for (const r of last) map.set(r.productId, Number(r.unitCost));
    const still = missing.filter(id => !map.has(id));
    if (still.length) {
      const typed = await db
        .select()
        .from(schema.avgCosts)
        .where(inArray(schema.avgCosts.productId, still));
      for (const r of typed) map.set(r.productId, Number(r.avgCost) + Number(r.extraCost));
    }
  }
  return map;
}

// ------------------------------------------------------------------ list & detail

export type DocListRow = {
  id: number;
  code: string;
  kind: DocKind;
  docDate: string;
  dueDate: string | null;
  warehouseName: string;
  toWarehouseName: string | null;
  partyName: string | null;
  partyCode: string | null;
  typeName: string | null;
  total: number;
  costTotal: number;
  paidAmount: number;
  /** Paid later through debt payments linked to this voucher. */
  paidLater: number;
  lineCount: number;
  totalQty: number;
  status: 'posted' | 'cancelled';
  isVat: boolean;
  invoiceNo: string | null;
  reason: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type DocFilters = {id?: number; from?: string; to?: string; kinds?: DocKind[]; customerId?: number; supplierId?: number};

export async function listDocs(user: CurrentUser, filters: DocFilters): Promise<DocListRow[]> {
  const db = await getDb();
  const d = schema.stockDocs;
  const conds = [];
  if (filters.id) conds.push(eq(d.id, filters.id));
  if (filters.kinds?.length) conds.push(inArray(d.kind, filters.kinds));
  if (filters.from) conds.push(gte(d.docDate, filters.from));
  if (filters.to) conds.push(lte(d.docDate, filters.to));
  if (filters.customerId) conds.push(eq(d.customerId, filters.customerId));
  if (filters.supplierId) conds.push(eq(d.supplierId, filters.supplierId));
  if (user.branchId) conds.push(eq(d.branchId, user.branchId));
  if (isTaxMode) conds.push(eq(d.isTax, true));

  const wh = schema.warehouses;
  const rows = await db
    .select({
      doc: d,
      warehouseName: wh.name,
      toWarehouseName: sql<string | null>`(select name from warehouses w2 where w2.id = ${d.toWarehouseId})`,
      customerName: schema.customers.name,
      customerCode: schema.customers.code,
      supplierName: schema.suppliers.name,
      supplierCode: schema.suppliers.code,
      employeeName: schema.employees.fullName,
      employeeCode: schema.employees.code,
      typeName: schema.stockDocTypes.name,
      createdByName: schema.users.fullName,
      paidLater: sql<string>`(select coalesce(sum(p.amount),0) from debt_payments p where p.doc_id = ${d.id})`,
      lineCount: sql<number>`(select count(*)::int from stock_doc_lines l where l.doc_id = ${d.id})`,
      totalQty: sql<string>`(select coalesce(sum(l.qty),0) from stock_doc_lines l where l.doc_id = ${d.id})`,
    })
    .from(d)
    .innerJoin(wh, eq(wh.id, d.warehouseId))
    .leftJoin(schema.customers, eq(schema.customers.id, d.customerId))
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, d.supplierId))
    .leftJoin(schema.employees, eq(schema.employees.id, d.employeeId))
    .leftJoin(schema.stockDocTypes, eq(schema.stockDocTypes.id, d.typeId))
    .leftJoin(schema.users, eq(schema.users.id, d.createdBy))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(d.docDate), desc(d.id))
    .limit(2000);

  return rows.map(r => ({
    id: r.doc.id,
    code: r.doc.code,
    kind: r.doc.kind as DocKind,
    docDate: r.doc.docDate,
    dueDate: r.doc.dueDate,
    warehouseName: r.warehouseName,
    toWarehouseName: r.toWarehouseName,
    partyName: r.customerName ?? r.supplierName ?? r.employeeName ?? null,
    partyCode: r.customerCode ?? r.supplierCode ?? r.employeeCode ?? null,
    typeName: r.typeName,
    total: Number(r.doc.total),
    costTotal: Number(r.doc.costTotal),
    paidAmount: Number(r.doc.paidAmount),
    paidLater: Number(r.paidLater),
    lineCount: Number(r.lineCount),
    totalQty: Number(r.totalQty),
    status: r.doc.status as 'posted' | 'cancelled',
    isVat: r.doc.isVat,
    invoiceNo: r.doc.invoiceNo,
    reason: r.doc.reason,
    createdByName: r.createdByName,
    createdAt: r.doc.createdAt.toISOString(),
  }));
}

export type DocLineView = {
  id: number;
  lineNo: number;
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  lineDir: 'in' | 'out' | null;
  qty: number;
  unitPrice: number;
  discount: number;
  amount: number;
  unitCost: number;
  note: string | null;
};

export type DocView = DocListRow & {
  branchName: string;
  warehouseId: number;
  toWarehouseId: number | null;
  customerId: number | null;
  supplierId: number | null;
  employeeId: number | null;
  partyPhone: string | null;
  partyAddress: string | null;
  partyTaxCode: string | null;
  refDocId: number | null;
  refDocCode: string | null;
  priceLevel: number;
  vatRate: number;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  otherCost: number;
  paymentMethod: string | null;
  note: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  lines: DocLineView[];
  /** Paid later through debt payments linked to this voucher. */
  paidLater: number;
};

export async function getDoc(user: CurrentUser, id: number): Promise<DocView | null> {
  const db = await getDb();
  const [doc] = await db.select().from(schema.stockDocs).where(eq(schema.stockDocs.id, id));
  if (!doc) return null;
  if (user.branchId && doc.branchId !== user.branchId && !user.allBranches) return null;
  if (isTaxMode && !doc.isTax) return null;

  const [base] = await listDocs({...user, branchId: doc.branchId}, {id});
  if (!base) return null;

  const [branch] = await db.select().from(schema.branches).where(eq(schema.branches.id, doc.branchId));
  let partyPhone: string | null = null;
  let partyAddress: string | null = null;
  let partyTaxCode: string | null = null;
  if (doc.customerId) {
    const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, doc.customerId));
    partyPhone = c?.phone ?? null;
    partyAddress = c?.address ?? null;
    partyTaxCode = c?.taxCode ?? null;
  } else if (doc.supplierId) {
    const [s] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, doc.supplierId));
    partyPhone = s?.phone ?? null;
    partyAddress = s?.address ?? null;
    partyTaxCode = s?.taxCode ?? null;
  }
  let refDocCode: string | null = null;
  if (doc.refDocId) {
    const [r] = await db.select({code: schema.stockDocs.code}).from(schema.stockDocs).where(eq(schema.stockDocs.id, doc.refDocId));
    refDocCode = r?.code ?? null;
  }
  const lines = await db
    .select({line: schema.stockDocLines, code: schema.products.code, name: schema.products.name, unit: schema.products.unit})
    .from(schema.stockDocLines)
    .innerJoin(schema.products, eq(schema.products.id, schema.stockDocLines.productId))
    .where(eq(schema.stockDocLines.docId, id))
    .orderBy(asc(schema.stockDocLines.lineNo), asc(schema.stockDocLines.id));
  const [paid] = await db
    .select({sum: sql<string>`coalesce(sum(${schema.debtPayments.amount}),0)`})
    .from(schema.debtPayments)
    .where(eq(schema.debtPayments.docId, id));

  return {
    ...base,
    branchName: branch?.name ?? '',
    warehouseId: doc.warehouseId,
    toWarehouseId: doc.toWarehouseId,
    customerId: doc.customerId,
    supplierId: doc.supplierId,
    employeeId: doc.employeeId,
    partyPhone,
    partyAddress,
    partyTaxCode,
    refDocId: doc.refDocId,
    refDocCode,
    priceLevel: doc.priceLevel,
    vatRate: Number(doc.vatRate),
    subtotal: Number(doc.subtotal),
    discountAmount: Number(doc.discountAmount),
    vatAmount: Number(doc.vatAmount),
    otherCost: Number(doc.otherCost),
    paymentMethod: doc.paymentMethod,
    note: doc.note,
    cancelReason: doc.cancelReason,
    cancelledAt: doc.cancelledAt?.toISOString() ?? null,
    paidLater: Number(paid?.sum ?? 0),
    lines: lines.map(l => ({
      id: l.line.id,
      lineNo: l.line.lineNo,
      productId: l.line.productId,
      productCode: l.code,
      productName: l.name,
      unit: l.unit,
      lineDir: (l.line.lineDir as 'in' | 'out' | null) ?? null,
      qty: Number(l.line.qty),
      unitPrice: Number(l.line.unitPrice),
      discount: Number(l.line.discount),
      amount: Number(l.line.amount),
      unitCost: Number(l.line.unitCost),
      note: l.line.note,
    })),
  };
}

// ------------------------------------------------------------------ form data

export type Opt = {value: string; label: string; description?: string};

export type ProductOpt = {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode: string | null;
  isTax: boolean;
  /** On-hand per warehouse id. */
  stock: Record<string, number>;
  avgCost: number;
  salePrices: [number, number, number];
  /** supplierId -> price */
  supplierPrices: Record<string, number>;
};

export type RefDocOpt = {
  id: number;
  code: string;
  docDate: string;
  partyId: number | null;
  partyName: string | null;
  warehouseId: number;
  vatRate: number;
  lines: {productId: number; qty: number; unitPrice: number; returnedQty: number}[];
};

export type DocFormData = {
  kind: DocKind;
  warehouses: (Opt & {branchId: number})[];
  allWarehouses: (Opt & {branchId: number})[];
  customers: (Opt & {allowDebt: boolean; debtDays: number})[];
  suppliers: Opt[];
  employees: Opt[];
  types: Opt[];
  products: ProductOpt[];
  defects: {productId: number; supplierId: number | null; defectType: string; detail: string | null}[];
  refDocs: RefDocOpt[];
  vatRate: number;
  allowNegativeStock: boolean;
  today: string;
};

export function todayISO() {
  // Vietnam time (UTC+7) so vouchers made late in the evening get the right date.
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function loadDocFormData(user: CurrentUser, kind: DocKind): Promise<DocFormData> {
  const db = await getDb();
  const def = DOC_KINDS[kind];
  const settings = await getSettings();

  const whRows = await db
    .select()
    .from(schema.warehouses)
    .where(eq(schema.warehouses.isActive, true))
    .orderBy(asc(schema.warehouses.name));
  const allWarehouses = whRows.map(w => ({value: String(w.id), label: w.name, description: w.code, branchId: w.branchId}));
  const warehouses = allWarehouses.filter(w => !user.branchId || w.branchId === user.branchId);

  const [customers, suppliers, employees, types, productRows] = await Promise.all([
    def.party === 'customer'
      ? db
          .select({c: schema.customers, t: schema.customerTypes})
          .from(schema.customers)
          .innerJoin(schema.customerTypes, eq(schema.customerTypes.id, schema.customers.typeId))
          .where(and(eq(schema.customers.isActive, true), eq(schema.customers.recordStatus, 'official')))
          .orderBy(asc(schema.customers.name))
      : Promise.resolve([]),
    def.party === 'supplier'
      ? db
          .select()
          .from(schema.suppliers)
          .where(and(eq(schema.suppliers.isActive, true), eq(schema.suppliers.recordStatus, 'official')))
          .orderBy(asc(schema.suppliers.name))
      : Promise.resolve([]),
    def.party === 'employee'
      ? db
          .select()
          .from(schema.employees)
          .where(and(eq(schema.employees.isActive, true), eq(schema.employees.recordStatus, 'official')))
          .orderBy(asc(schema.employees.fullName))
      : Promise.resolve([]),
    db
      .select()
      .from(schema.stockDocTypes)
      .where(and(eq(schema.stockDocTypes.kind, kind), eq(schema.stockDocTypes.isActive, true)))
      .orderBy(asc(schema.stockDocTypes.id)),
    db
      .select({p: schema.products, isTax: schema.productTypes.isTax})
      .from(schema.products)
      .innerJoin(schema.productTypes, eq(schema.productTypes.id, schema.products.typeId))
      .where(and(eq(schema.products.isActive, true), isTaxMode ? eq(schema.productTypes.isTax, true) : undefined))
      .orderBy(asc(schema.products.code)),
  ]);

  const productIds = productRows.map(r => r.p.id);
  const [stockRows, avg, prices, supPrices, defects] = await Promise.all([
    productIds.length
      ? db
          .select({
            productId: schema.stockMoves.productId,
            warehouseId: schema.stockMoves.warehouseId,
            qty: sql<string>`sum(${schema.stockMoves.qty})`,
          })
          .from(schema.stockMoves)
          .groupBy(schema.stockMoves.productId, schema.stockMoves.warehouseId)
      : Promise.resolve([]),
    getAvgCost(db, productIds),
    db.select().from(schema.salePrices),
    def.party === 'supplier' ? db.select().from(schema.supplierPrices).where(eq(schema.supplierPrices.isActive, true)) : Promise.resolve([]),
    def.checkDefects
      ? db.select().from(schema.defectiveProducts).where(and(eq(schema.defectiveProducts.isActive, true), eq(schema.defectiveProducts.isWarning, true)))
      : Promise.resolve([]),
  ]);

  const stockBy = new Map<number, Record<string, number>>();
  for (const s of stockRows) {
    const m = stockBy.get(s.productId) ?? {};
    m[String(s.warehouseId)] = Number(s.qty);
    stockBy.set(s.productId, m);
  }
  const priceBy = new Map(prices.map(p => [p.productId, p]));
  const supBy = new Map<number, Record<string, number>>();
  for (const sp of supPrices) {
    const m = supBy.get(sp.productId) ?? {};
    m[String(sp.supplierId)] = Number(sp.price);
    supBy.set(sp.productId, m);
  }

  let refDocs: RefDocOpt[] = [];
  if (def.refKind) {
    const kinds = Array.isArray(def.refKind) ? def.refKind : [def.refKind];
    const docs = await db
      .select({
        d: schema.stockDocs,
        partyName: sql<string | null>`coalesce(${schema.customers.name}, ${schema.suppliers.name})`,
      })
      .from(schema.stockDocs)
      .leftJoin(schema.customers, eq(schema.customers.id, schema.stockDocs.customerId))
      .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.stockDocs.supplierId))
      .where(
        and(
          inArray(schema.stockDocs.kind, kinds),
          eq(schema.stockDocs.status, 'posted'),
          user.branchId ? eq(schema.stockDocs.branchId, user.branchId) : undefined,
          isTaxMode ? eq(schema.stockDocs.isTax, true) : undefined,
        ),
      )
      .orderBy(desc(schema.stockDocs.docDate), desc(schema.stockDocs.id))
      .limit(300);
    const ids = docs.map(x => x.d.id);
    const lines = ids.length
      ? await db.select().from(schema.stockDocLines).where(inArray(schema.stockDocLines.docId, ids))
      : [];
    const returned = await returnedQtyByRefLine(db, ids);
    refDocs = docs.map(x => ({
      id: x.d.id,
      code: x.d.code,
      docDate: x.d.docDate,
      partyId: x.d.customerId ?? x.d.supplierId,
      partyName: x.partyName,
      warehouseId: x.d.warehouseId,
      vatRate: Number(x.d.vatRate),
      lines: lines
        .filter(l => l.docId === x.d.id)
        .map(l => {
          const q = Number(l.qty);
          // net price per unit after line discount, so returns refund what was paid
          const net = q ? Number(l.amount) / q : Number(l.unitPrice);
          return {
            productId: l.productId,
            qty: q,
            unitPrice: Math.round(net),
            returnedQty: returned.get(`${x.d.id}:${l.productId}`) ?? 0,
          };
        }),
    }));
  }

  return {
    kind,
    warehouses,
    allWarehouses,
    customers: customers.map(r => ({
      value: String(r.c.id),
      label: r.c.name,
      description: [r.c.code, r.c.phone].filter(Boolean).join(' · '),
      allowDebt: r.t.allowDebt,
      debtDays: r.t.debtDays ?? 0,
    })),
    suppliers: suppliers.map(s => ({value: String(s.id), label: s.name, description: s.code})),
    employees: employees.map(e => ({value: String(e.id), label: e.fullName, description: e.code})),
    types: types.map(t => ({value: String(t.id), label: t.name})),
    products: productRows.map(r => {
      const sp = priceBy.get(r.p.id);
      return {
        id: r.p.id,
        code: r.p.code,
        name: r.p.name,
        unit: r.p.unit,
        barcode: r.p.barcode,
        isTax: r.isTax,
        stock: stockBy.get(r.p.id) ?? {},
        avgCost: avg.get(r.p.id) ?? 0,
        salePrices: [Number(sp?.price1 ?? 0), Number(sp?.price2 ?? 0), Number(sp?.price3 ?? 0)],
        supplierPrices: supBy.get(r.p.id) ?? {},
      };
    }),
    defects: defects.map(d => ({productId: d.productId, supplierId: d.supplierId, defectType: d.defectType, detail: d.detail})),
    refDocs,
    vatRate: Number(settings.vatRate ?? 10),
    allowNegativeStock: settings.allowNegativeStock === true,
    today: todayISO(),
  };
}

/** Quantity already returned per "refDocId:productId" across posted return vouchers. */
async function returnedQtyByRefLine(db: DB, refIds: number[]) {
  const map = new Map<string, number>();
  if (!refIds.length) return map;
  const rows = await db
    .select({
      refDocId: schema.stockDocs.refDocId,
      productId: schema.stockDocLines.productId,
      qty: sql<string>`sum(${schema.stockDocLines.qty})`,
    })
    .from(schema.stockDocLines)
    .innerJoin(schema.stockDocs, eq(schema.stockDocs.id, schema.stockDocLines.docId))
    .where(and(inArray(schema.stockDocs.refDocId, refIds), eq(schema.stockDocs.status, 'posted')))
    .groupBy(schema.stockDocs.refDocId, schema.stockDocLines.productId);
  for (const r of rows) map.set(`${r.refDocId}:${r.productId}`, Number(r.qty));
  return map;
}

// ------------------------------------------------------------------ create

export type DocLineInput = {
  productId: number;
  qty: number;
  unitPrice?: number;
  discount?: number;
  lineDir?: 'in' | 'out';
  note?: string;
};

export type DocInput = {
  kind: DocKind;
  typeId?: number | null;
  warehouseId: number;
  toWarehouseId?: number | null;
  customerId?: number | null;
  supplierId?: number | null;
  employeeId?: number | null;
  refDocId?: number | null;
  docDate: string;
  dueDate?: string | null;
  priceLevel?: number;
  invoiceNo?: string | null;
  vatRate?: number;
  discountAmount?: number;
  otherCost?: number;
  paidAmount?: number;
  paymentMethod?: 'cash' | 'bank' | null;
  reason?: string | null;
  note?: string | null;
  lines: DocLineInput[];
};

export type DocResult = {ok: true; id: number; code: string; message: string} | {ok: false; message: string};

const fail = (message: string): DocResult => ({ok: false, message});

export async function createDoc(user: CurrentUser, input: DocInput): Promise<DocResult> {
  const def = DOC_KINDS[input.kind];
  if (!def) return fail('Loại phiếu không hợp lệ.');
  if (!can(user, def.feature, 'create')) return fail(`Bạn chưa có quyền tạo ${def.noun}.`);

  const db = await getDb();
  const err = await validate(db, user, def, input);
  if (err) return fail(err);

  try {
    const result = await db.transaction(async tx => {
      const t = tx as unknown as DB;
      // One voucher posts at a time, so stock checks and average costs stay consistent.
      await t.execute(sql`select pg_advisory_xact_lock(515151)`);
      return postDoc(t, user, def, input);
    });
    await writeAudit(db, user.id, 'create', def.feature, result.id, {code: result.code});
    return {ok: true, id: result.id, code: result.code, message: `Đã lưu ${def.noun} ${result.code}.`};
  } catch (e) {
    if (e instanceof StockError) return fail(e.message);
    return fail(friendlyDbError(e));
  }
}

class StockError extends Error {}

async function validate(db: DB, user: CurrentUser, def: DocKindDef, input: DocInput): Promise<string | null> {
  if (!input.docDate) return 'Chưa chọn ngày phiếu.';
  if (!input.warehouseId) return 'Chưa chọn kho.';
  const [wh] = await db.select().from(schema.warehouses).where(eq(schema.warehouses.id, input.warehouseId));
  if (!wh) return 'Kho không tồn tại.';
  if (user.branchId && wh.branchId !== user.branchId) return 'Kho không thuộc chi nhánh đang làm việc.';
  if (def.direction === 'transfer') {
    if (!input.toWarehouseId) return 'Chưa chọn kho nhận.';
    if (input.toWarehouseId === input.warehouseId) return 'Kho nhận phải khác kho xuất.';
  }
  if (def.partyRequired) {
    if (def.party === 'customer' && !input.customerId) return 'Chưa chọn khách hàng.';
    if (def.party === 'supplier' && !input.supplierId) return 'Chưa chọn nhà cung cấp.';
  }
  if (def.reasonRequired && !input.reason?.trim()) return `Chưa nhập ${def.reasonLabel?.toLowerCase() ?? 'lý do'}.`;
  if (def.refKind && !input.refDocId) return 'Chưa chọn phiếu gốc.';

  const lines = input.lines.filter(l => l.productId);
  if (!lines.length) return 'Phiếu chưa có sản phẩm nào.';
  for (const l of lines) {
    if (!(Number(l.qty) > 0)) return 'Số lượng mỗi dòng phải lớn hơn 0.';
    if (def.priced && Number(l.unitPrice ?? 0) < 0) return 'Đơn giá không được âm.';
  }
  if (def.direction === 'convert') {
    if (!lines.some(l => l.lineDir === 'out') || !lines.some(l => l.lineDir === 'in')) {
      return 'Chuyển đổi tồn cần ít nhất một mã xuất và một mã nhập.';
    }
  }
  return null;
}

async function postDoc(db: DB, user: CurrentUser, def: DocKindDef, input: DocInput) {
  // Read through the transaction handle: getSettings() would use another connection and
  // deadlock on the single-connection demo database (PGlite).
  const settings = Object.fromEntries((await db.select().from(schema.settings)).map(r => [r.key, r.value]));
  const allowNegative = settings.allowNegativeStock === true;
  const lines = input.lines.filter(l => l.productId).map((l, i) => ({
    ...l,
    lineNo: i + 1,
    qty: Number(l.qty),
    unitPrice: def.priced ? Number(l.unitPrice ?? 0) : 0,
    discount: def.priced ? Number(l.discount ?? 0) : 0,
  }));
  const productIds = [...new Set(lines.map(l => l.productId))];

  const products = await db
    .select({id: schema.products.id, name: schema.products.name, code: schema.products.code, isTax: schema.productTypes.isTax})
    .from(schema.products)
    .innerJoin(schema.productTypes, eq(schema.productTypes.id, schema.products.typeId))
    .where(inArray(schema.products.id, productIds));
  const prodBy = new Map(products.map(p => [p.id, p]));
  if (products.length !== productIds.length) throw new StockError('Có sản phẩm không tồn tại.');

  // Return vouchers: cannot return more than was sold/bought minus earlier returns.
  if (def.refKind && input.refDocId) {
    const [ref] = await db.select().from(schema.stockDocs).where(eq(schema.stockDocs.id, input.refDocId));
    if (!ref || ref.status !== 'posted') throw new StockError('Phiếu gốc không tồn tại hoặc đã hủy.');
    const refLines = await db.select().from(schema.stockDocLines).where(eq(schema.stockDocLines.docId, ref.id));
    const returned = await returnedQtyByRefLine(db, [ref.id]);
    for (const l of lines) {
      const sold = refLines.filter(r => r.productId === l.productId).reduce((s, r) => s + Number(r.qty), 0);
      const already = returned.get(`${ref.id}:${l.productId}`) ?? 0;
      if (l.qty > sold - already) {
        throw new StockError(`${prodBy.get(l.productId)?.code}: chỉ còn trả được ${sold - already} trên phiếu gốc ${ref.code}.`);
      }
    }
    input.customerId = def.party === 'customer' ? ref.customerId : input.customerId;
    input.supplierId = def.party === 'supplier' ? ref.supplierId : input.supplierId;
  }

  // Stock check for every outgoing line.
  const outQty = new Map<number, number>();
  for (const l of lines) {
    const isOut = def.direction === 'out' || def.direction === 'transfer' || (def.direction === 'convert' && l.lineDir === 'out');
    if (isOut) outQty.set(l.productId, (outQty.get(l.productId) ?? 0) + l.qty);
  }
  if (outQty.size && !allowNegative) {
    const onHand = await getOnHand(db, [...outQty.keys()], {warehouseId: input.warehouseId});
    for (const [pid, q] of outQty) {
      const have = onHand.get(pid) ?? 0;
      if (q > have) {
        const p = prodBy.get(pid);
        throw new StockError(`${p?.code} ${p?.name}: tồn kho chỉ còn ${have}, không đủ xuất ${q}.`);
      }
    }
  }

  const avg = await getAvgCost(db, productIds);
  const totals = computeTotals(lines, {
    discountAmount: Number(input.discountAmount ?? 0),
    vatRate: Number(input.vatRate ?? 0),
    otherCost: Number(input.otherCost ?? 0),
    vat: def.vat,
  });
  const isTax =
    def.kind === 'sale_vat' || lines.some(l => prodBy.get(l.productId)?.isTax) || (def.vat && Number(input.vatRate ?? 0) > 0);

  // Customer type rules: customers without debt must pay in full.
  let dueDate = input.dueDate || null;
  if (def.debt?.party === 'customer' && def.debt.sign === 1 && input.customerId) {
    const [c] = await db
      .select({allowDebt: schema.customerTypes.allowDebt, debtDays: schema.customerTypes.debtDays, typeName: schema.customerTypes.name})
      .from(schema.customers)
      .innerJoin(schema.customerTypes, eq(schema.customerTypes.id, schema.customers.typeId))
      .where(eq(schema.customers.id, input.customerId));
    const paid = Number(input.paidAmount ?? 0);
    if (c && !c.allowDebt && paid < totals.total) {
      throw new StockError(`Khách thuộc loại "${c.typeName}" không được ghi nợ: cần thu đủ ${fmt(totals.total)} đ.`);
    }
    if (!dueDate && c?.allowDebt) dueDate = addDays(input.docDate, c.debtDays ?? 0);
  }
  if (Number(input.paidAmount ?? 0) > totals.total && def.payment) {
    throw new StockError('Số tiền thanh toán lớn hơn tổng tiền phiếu.');
  }

  const code = await nextCode(db, def.codePrefix);
  const [doc] = await db
    .insert(schema.stockDocs)
    .values({
      code,
      kind: def.kind,
      typeId: input.typeId || null,
      branchId: (await db.select({b: schema.warehouses.branchId}).from(schema.warehouses).where(eq(schema.warehouses.id, input.warehouseId)))[0].b,
      warehouseId: input.warehouseId,
      toWarehouseId: def.direction === 'transfer' ? input.toWarehouseId : null,
      customerId: def.party === 'customer' ? input.customerId || null : null,
      supplierId: def.party === 'supplier' ? input.supplierId || null : null,
      employeeId: def.party === 'employee' ? input.employeeId || null : null,
      refDocId: input.refDocId || null,
      docDate: input.docDate,
      dueDate,
      priceLevel: input.priceLevel ?? 1,
      isVat: def.vat && Number(input.vatRate ?? 0) > 0,
      isTax,
      invoiceNo: input.invoiceNo || null,
      vatRate: def.vat ? Number(input.vatRate ?? 0) : 0,
      subtotal: def.priced ? totals.subtotal : 0,
      discountAmount: def.priced ? Number(input.discountAmount ?? 0) : 0,
      vatAmount: def.priced ? totals.vatAmount : 0,
      otherCost: Number(input.otherCost ?? 0),
      total: def.priced ? totals.total : 0,
      paidAmount: def.payment ? Number(input.paidAmount ?? 0) : 0,
      paymentMethod: def.payment && Number(input.paidAmount ?? 0) > 0 ? input.paymentMethod ?? 'cash' : null,
      reason: input.reason || null,
      note: input.note || null,
      createdBy: user.id,
    })
    .returning();

  // Purchase cost: net line amount after the voucher discount, plus other costs, spread by value.
  const subtotal = totals.subtotal || 1;
  const discountRatio = def.priced ? Math.max(0, 1 - Number(input.discountAmount ?? 0) / subtotal) : 1;
  const otherCost = Number(input.otherCost ?? 0);

  // Convert: total cost of "out" lines is carried into the "in" lines by quantity.
  let convertPool = 0;
  if (def.direction === 'convert') {
    for (const l of lines) if (l.lineDir === 'out') convertPool += l.qty * (avg.get(l.productId) ?? 0);
  }
  const convertInQty = lines.filter(l => l.lineDir === 'in').reduce((s, l) => s + l.qty, 0) || 1;

  let costTotal = 0;
  const moves: (typeof schema.stockMoves.$inferInsert)[] = [];
  for (const l of lines) {
    const amount = def.priced ? lineAmount(l) : 0;
    let unitCost = avg.get(l.productId) ?? 0;
    if (def.kind === 'purchase') {
      const net = amount * discountRatio;
      const share = totals.subtotal ? (amount / totals.subtotal) * otherCost : otherCost / lines.length;
      unitCost = Math.round((net + share) / l.qty);
    } else if (def.kind === 'sale_return') {
      // goods come back at the cost they left with
      const [orig] = await db
        .select({c: schema.stockDocLines.unitCost})
        .from(schema.stockDocLines)
        .where(and(eq(schema.stockDocLines.docId, input.refDocId!), eq(schema.stockDocLines.productId, l.productId)))
        .limit(1);
      if (orig) unitCost = Number(orig.c);
    } else if (def.direction === 'convert' && l.lineDir === 'in') {
      unitCost = Math.round(convertPool / convertInQty);
    }

    const [line] = await db
      .insert(schema.stockDocLines)
      .values({
        docId: doc.id,
        lineNo: l.lineNo,
        productId: l.productId,
        lineDir: def.direction === 'convert' ? l.lineDir ?? 'out' : null,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
        amount,
        unitCost,
        note: l.note || null,
      })
      .returning();

    const base = {
      docId: doc.id,
      lineId: line.id,
      productId: l.productId,
      branchId: doc.branchId,
      unitCost,
      moveDate: input.docDate,
      isTax: prodBy.get(l.productId)?.isTax ?? false,
    };
    if (def.direction === 'in') {
      moves.push({...base, warehouseId: input.warehouseId, qty: l.qty});
      if (def.kind === 'sale_return') costTotal += l.qty * unitCost;
    } else if (def.direction === 'out') {
      moves.push({...base, warehouseId: input.warehouseId, qty: -l.qty});
      costTotal += l.qty * unitCost;
    } else if (def.direction === 'transfer') {
      const [toWh] = await db.select().from(schema.warehouses).where(eq(schema.warehouses.id, input.toWarehouseId!));
      moves.push({...base, warehouseId: input.warehouseId, qty: -l.qty});
      moves.push({...base, warehouseId: toWh.id, branchId: toWh.branchId, qty: l.qty});
      costTotal += l.qty * unitCost;
    } else {
      moves.push({...base, warehouseId: input.warehouseId, qty: l.lineDir === 'in' ? l.qty : -l.qty});
      if (l.lineDir === 'out') costTotal += l.qty * unitCost;
    }
  }
  if (moves.length) await db.insert(schema.stockMoves).values(moves);
  if (def.kind === 'purchase') costTotal = Math.round(totals.subtotal * discountRatio + otherCost);
  await db.update(schema.stockDocs).set({costTotal: Math.round(costTotal)}).where(eq(schema.stockDocs.id, doc.id));
  return {id: doc.id, code};
}

// ------------------------------------------------------------------ cancel

export async function cancelDoc(user: CurrentUser, id: number, reason: string): Promise<DocResult> {
  const db = await getDb();
  const [doc] = await db.select().from(schema.stockDocs).where(eq(schema.stockDocs.id, id));
  if (!doc) return fail('Không tìm thấy phiếu.');
  const def = DOC_KINDS[doc.kind as DocKind];
  if (!can(user, def.feature, 'delete')) return fail(`Bạn chưa có quyền hủy ${def.noun}.`);
  if (doc.status === 'cancelled') return fail('Phiếu đã hủy trước đó.');
  if (!reason.trim()) return fail('Cần nhập lý do hủy phiếu.');

  const [returns] = await db
    .select({n: sql<number>`count(*)::int`})
    .from(schema.stockDocs)
    .where(and(eq(schema.stockDocs.refDocId, id), eq(schema.stockDocs.status, 'posted')));
  if (Number(returns?.n) > 0) return fail('Phiếu đã có phiếu trả hàng. Hủy phiếu trả hàng trước.');
  const [payments] = await db
    .select({n: sql<number>`count(*)::int`})
    .from(schema.debtPayments)
    .where(eq(schema.debtPayments.docId, id));
  if (Number(payments?.n) > 0) return fail('Phiếu đã có phiếu thu/chi công nợ gắn kèm, không hủy được.');

  // Cancelling an incoming voucher must not leave negative stock behind.
  const settings = await getSettings();
  if (settings.allowNegativeStock !== true) {
    const moves = await db.select().from(schema.stockMoves).where(and(eq(schema.stockMoves.docId, id), sql`${schema.stockMoves.qty} > 0`));
    for (const m of moves) {
      const onHand = await getOnHand(db, [m.productId], {warehouseId: m.warehouseId});
      if ((onHand.get(m.productId) ?? 0) - Number(m.qty) < 0) {
        const [p] = await db.select().from(schema.products).where(eq(schema.products.id, m.productId));
        return fail(`Không hủy được: ${p?.code} đã xuất bớt, hủy phiếu sẽ làm tồn kho âm.`);
      }
    }
  }

  await db.transaction(async tx => {
    await tx.delete(schema.stockMoves).where(eq(schema.stockMoves.docId, id));
    await tx
      .update(schema.stockDocs)
      .set({status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.id, cancelReason: reason.trim(), updatedAt: new Date()})
      .where(eq(schema.stockDocs.id, id));
  });
  await writeAudit(db, user.id, 'cancel', def.feature, id, {reason});
  return {ok: true, id, code: doc.code, message: `Đã hủy ${def.noun} ${doc.code}.`};
}

// ------------------------------------------------------------------ helpers

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

