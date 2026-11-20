import 'server-only';
import {and, asc, desc, eq, gte, inArray, lte, sql} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import type {CurrentUser} from '@/lib/auth';
import {DOC_KINDS, type DocKind} from '@/lib/stock/kinds';
import {debtLedger, defaultDebtDays, openDebtDocs, type DebtParty} from './debt';
import {todayISO} from './stock';
import {isTaxMode} from './toggles';

/**
 * Read-only report queries of module "Quản lý xuất nhập" (thống kê, công nợ, lịch sử giá…).
 * Everything is scoped to the working branch of the user and, in the tax copy of the
 * app, to tax vouchers / tax moves only. Cancelled vouchers never count.
 */

export type Period = {tu: string; den: string};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Period from URL params; default = first day of this month → today (Vietnam time). */
export function resolvePeriod(sp: {tu?: string | string[]; den?: string | string[]}): Period {
  const today = todayISO();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tu = one(sp.tu);
  const den = one(sp.den);
  const validTu = tu && ISO.test(tu) ? tu : `${today.slice(0, 8)}01`;
  const validDen = den && ISO.test(den) ? den : today;
  return validTu <= validDen ? {tu: validTu, den: validDen} : {tu: validDen, den: validTu};
}

const num = (v: unknown) => Number(v ?? 0);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function docScope(user: CurrentUser) {
  const d = schema.stockDocs;
  return [user.branchId ? eq(d.branchId, user.branchId) : undefined, isTaxMode ? eq(d.isTax, true) : undefined];
}

// ------------------------------------------------------------------ 1. tồn kho

export type StockRow = {
  key: string;
  productId: number;
  code: string;
  name: string;
  unit: string;
  groupId: number | null;
  typeId: number;
  warehouseId: number;
  warehouseName: string;
  opening: number;
  inQty: number;
  outQty: number;
  closing: number;
  avgCost: number;
  closingValue: number;
};

export type StockReport = {
  rows: StockRow[];
  warehouses: {value: string; label: string}[];
  groups: {value: string; label: string}[];
  types: {value: string; label: string}[];
};

export async function stockReport(user: CurrentUser, p: Period): Promise<StockReport> {
  const db = await getDb();
  const m = schema.stockMoves;
  const inPeriod = sql`${m.moveDate} >= ${p.tu}::date and ${m.moveDate} <= ${p.den}::date`;
  const agg = await db
    .select({
      productId: m.productId,
      warehouseId: m.warehouseId,
      opening: sql<string>`coalesce(sum(case when ${m.moveDate} < ${p.tu}::date then ${m.qty} else 0 end), 0)`,
      inQty: sql<string>`coalesce(sum(case when ${inPeriod} and ${m.qty} > 0 then ${m.qty} else 0 end), 0)`,
      outQty: sql<string>`coalesce(sum(case when ${inPeriod} and ${m.qty} < 0 then -${m.qty} else 0 end), 0)`,
      closing: sql<string>`coalesce(sum(${m.qty}), 0)`,
      value: sql<string>`coalesce(sum(${m.qty} * ${m.unitCost}), 0)`,
    })
    .from(m)
    .where(
      and(
        lte(m.moveDate, p.den),
        user.branchId ? eq(m.branchId, user.branchId) : undefined,
        isTaxMode ? eq(m.isTax, true) : undefined,
      ),
    )
    .groupBy(m.productId, m.warehouseId);

  const [products, whs, groups, types] = await Promise.all([
    db
      .select({id: schema.products.id, code: schema.products.code, name: schema.products.name, unit: schema.products.unit, groupId: schema.products.groupId, typeId: schema.products.typeId})
      .from(schema.products),
    db
      .select({id: schema.warehouses.id, name: schema.warehouses.name})
      .from(schema.warehouses)
      .where(user.branchId ? eq(schema.warehouses.branchId, user.branchId) : undefined)
      .orderBy(asc(schema.warehouses.code)),
    db.select({id: schema.productGroups.id, name: schema.productGroups.name}).from(schema.productGroups).orderBy(asc(schema.productGroups.name)),
    db
      .select({id: schema.productTypes.id, name: schema.productTypes.name})
      .from(schema.productTypes)
      .where(isTaxMode ? eq(schema.productTypes.isTax, true) : undefined)
      .orderBy(asc(schema.productTypes.name)),
  ]);
  const prodBy = new Map(products.map(x => [x.id, x]));
  const whBy = new Map(whs.map(x => [x.id, x.name]));

  const rows: StockRow[] = [];
  for (const a of agg) {
    const pr = prodBy.get(a.productId);
    if (!pr) continue;
    const opening = r3(num(a.opening));
    const inQty = r3(num(a.inQty));
    const outQty = r3(num(a.outQty));
    const closing = r3(num(a.closing));
    if (!opening && !inQty && !outQty && !closing) continue;
    const value = Math.round(num(a.value));
    rows.push({
      key: `${a.productId}:${a.warehouseId}`,
      productId: pr.id,
      code: pr.code,
      name: pr.name,
      unit: pr.unit,
      groupId: pr.groupId,
      typeId: pr.typeId,
      warehouseId: a.warehouseId,
      warehouseName: whBy.get(a.warehouseId) ?? `Kho #${a.warehouseId}`,
      opening,
      inQty,
      outQty,
      closing,
      avgCost: closing > 0 ? Math.round(value / closing) : 0,
      closingValue: value,
    });
  }
  rows.sort((x, y) => x.code.localeCompare(y.code) || x.warehouseName.localeCompare(y.warehouseName));
  return {
    rows,
    warehouses: whs.map(w => ({value: String(w.id), label: w.name})),
    groups: groups.map(g => ({value: String(g.id), label: g.name})),
    types: types.map(t => ({value: String(t.id), label: t.name})),
  };
}

export type StockCardRow = {
  key: string;
  date: string;
  docId: number;
  docCode: string;
  kind: DocKind;
  kindTitle: string;
  warehouseName: string;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  balance: number;
};

export type StockCard = {opening: number; rows: StockCardRow[]; closing: number};

/** Thẻ kho: moves of one product (in one warehouse, or all warehouses of the branch). */
export async function stockCard(
  user: CurrentUser,
  q: {productId: number; warehouseId: number | null; tu: string; den: string},
): Promise<StockCard> {
  const db = await getDb();
  const m = schema.stockMoves;
  const scope = [
    eq(m.productId, q.productId),
    q.warehouseId ? eq(m.warehouseId, q.warehouseId) : undefined,
    user.branchId ? eq(m.branchId, user.branchId) : undefined,
    isTaxMode ? eq(m.isTax, true) : undefined,
  ];
  const [open] = await db
    .select({qty: sql<string>`coalesce(sum(${m.qty}), 0)`})
    .from(m)
    .where(and(...scope, sql`${m.moveDate} < ${q.tu}::date`));
  const moves = await db
    .select({
      id: m.id,
      date: m.moveDate,
      qty: m.qty,
      unitCost: m.unitCost,
      docId: schema.stockDocs.id,
      docCode: schema.stockDocs.code,
      kind: schema.stockDocs.kind,
      warehouseName: schema.warehouses.name,
    })
    .from(m)
    .innerJoin(schema.stockDocs, eq(schema.stockDocs.id, m.docId))
    .innerJoin(schema.warehouses, eq(schema.warehouses.id, m.warehouseId))
    .where(and(...scope, gte(m.moveDate, q.tu), lte(m.moveDate, q.den)))
    .orderBy(asc(m.moveDate), asc(m.id));
  const opening = r3(num(open?.qty));
  let balance = opening;
  const rows = moves.map(mv => {
    const qty = num(mv.qty);
    balance = r3(balance + qty);
    return {
      key: String(mv.id),
      date: mv.date,
      docId: mv.docId,
      docCode: mv.docCode,
      kind: mv.kind as DocKind,
      kindTitle: DOC_KINDS[mv.kind as DocKind]?.title ?? mv.kind,
      warehouseName: mv.warehouseName,
      qtyIn: qty > 0 ? qty : 0,
      qtyOut: qty < 0 ? -qty : 0,
      unitCost: num(mv.unitCost),
      balance,
    };
  });
  return {opening, rows, closing: balance};
}

// ------------------------------------------------------------------ 2. thống kê phiếu xuất

export type StatsDoc = {
  id: number;
  code: string;
  kind: DocKind;
  date: string;
  partyId: number | null;
  partyName: string;
  staffId: number | null;
  staffName: string;
  qty: number;
  /** total of the voucher without VAT */
  revenue: number;
  /** total of the voucher as typed (VAT included) */
  total: number;
  /** other costs spread into cost (purchase) */
  alloc: number;
  cost: number;
};

export type StatsLine = {
  docId: number;
  productId: number;
  code: string;
  name: string;
  groupName: string;
  qty: number;
  value: number;
  alloc: number;
  cost: number;
};

export type StatsReturns = {count: number; qty: number; value: number; cost: number};

export type DocStats = {docs: StatsDoc[]; lines: StatsLine[]; returns: StatsReturns};

const qtySub = sql<string>`(select coalesce(sum(l.qty),0) from stock_doc_lines l where l.doc_id = stock_docs.id)`;
const lineCostSub = sql<string>`(select coalesce(sum(l.qty * l.unit_cost),0) from stock_doc_lines l where l.doc_id = stock_docs.id)`;

async function loadStats(
  user: CurrentUser,
  p: Period,
  kinds: DocKind[],
  returnKind: DocKind,
  party: 'customer' | 'supplier',
): Promise<DocStats> {
  const db = await getDb();
  const d = schema.stockDocs;
  const partyId = party === 'customer' ? d.customerId : d.supplierId;
  const partyTable = party === 'customer' ? schema.customers : schema.suppliers;
  const where = (k: DocKind[]) =>
    and(inArray(d.kind, k), eq(d.status, 'posted'), gte(d.docDate, p.tu), lte(d.docDate, p.den), ...docScope(user));

  const docRows = await db
    .select({
      id: d.id,
      code: d.code,
      kind: d.kind,
      date: d.docDate,
      partyId,
      partyName: partyTable.name,
      staffId: d.createdBy,
      staffName: schema.users.fullName,
      total: d.total,
      vatAmount: d.vatAmount,
      otherCost: d.otherCost,
      costTotal: d.costTotal,
      qty: qtySub,
    })
    .from(d)
    .leftJoin(partyTable, eq(partyTable.id, partyId))
    .leftJoin(schema.users, eq(schema.users.id, d.createdBy))
    .where(where(kinds))
    .orderBy(desc(d.docDate), desc(d.id));

  const lineRows = await db
    .select({
      docId: d.id,
      productId: schema.stockDocLines.productId,
      code: schema.products.code,
      name: schema.products.name,
      groupName: schema.productGroups.name,
      qty: schema.stockDocLines.qty,
      amount: schema.stockDocLines.amount,
      unitCost: schema.stockDocLines.unitCost,
      subtotal: d.subtotal,
      otherCost: d.otherCost,
    })
    .from(schema.stockDocLines)
    .innerJoin(d, eq(d.id, schema.stockDocLines.docId))
    .innerJoin(schema.products, eq(schema.products.id, schema.stockDocLines.productId))
    .leftJoin(schema.productGroups, eq(schema.productGroups.id, schema.products.groupId))
    .where(where(kinds));

  const [ret] = await db
    .select({
      count: sql<number>`count(*)::int`,
      qty: sql<string>`coalesce(sum(${qtySub}), 0)`,
      value: sql<string>`coalesce(sum(${d.total} - ${d.vatAmount}), 0)`,
      cost: sql<string>`coalesce(sum(${lineCostSub}), 0)`,
    })
    .from(d)
    .where(where([returnKind]));

  return {
    docs: docRows.map(r => ({
      id: r.id,
      code: r.code,
      kind: r.kind as DocKind,
      date: r.date,
      partyId: r.partyId,
      partyName: r.partyName ?? '—',
      staffId: r.staffId,
      staffName: r.staffName ?? '—',
      qty: num(r.qty),
      // doanh thu không gồm VAT
      revenue: num(r.total) - num(r.vatAmount),
      total: num(r.total),
      alloc: num(r.otherCost),
      cost: num(r.costTotal),
    })),
    lines: lineRows.map(l => ({
      docId: l.docId,
      productId: l.productId,
      code: l.code,
      name: l.name,
      groupName: l.groupName ?? 'Chưa phân nhóm',
      qty: num(l.qty),
      value: num(l.amount),
      alloc: num(l.subtotal) ? (num(l.amount) / num(l.subtotal)) * num(l.otherCost) : 0,
      cost: num(l.qty) * num(l.unitCost),
    })),
    returns: {count: ret?.count ?? 0, qty: num(ret?.qty), value: num(ret?.value), cost: num(ret?.cost)},
  };
}

export function saleStats(user: CurrentUser, p: Period) {
  return loadStats(user, p, ['sale', 'sale_vat'], 'sale_return', 'customer');
}

// ------------------------------------------------------------------ 3. thống kê nhập

export function purchaseStats(user: CurrentUser, p: Period) {
  return loadStats(user, p, ['purchase'], 'purchase_return', 'supplier');
}

// ------------------------------------------------------------------ 4/5. công nợ

export type DebtRow = {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  opening: number;
  increase: number;
  decrease: number;
  closing: number;
  limit: number | null;
};

export async function debtReport(user: CurrentUser, party: DebtParty, p: Period): Promise<DebtRow[]> {
  const db = await getDb();
  const entries = await debtLedger(user, party, {to: p.den});
  const by = new Map<number, {opening: number; increase: number; decrease: number}>();
  for (const e of entries) {
    const row = by.get(e.partyId) ?? {opening: 0, increase: 0, decrease: 0};
    if (e.date < p.tu) row.opening += e.debit - e.credit;
    else {
      row.increase += e.debit;
      row.decrease += e.credit;
    }
    by.set(e.partyId, row);
  }
  let parties: {id: number; code: string; name: string; phone: string | null; limit: number | null}[];
  if (party === 'customer') {
    const c = schema.customers;
    const rows = await db.select({id: c.id, code: c.code, name: c.name, phone: c.phone, limit: c.debtLimit}).from(c).orderBy(asc(c.name));
    parties = rows.map(r => ({...r, limit: r.limit == null ? null : Number(r.limit)}));
  } else {
    const s = schema.suppliers;
    const rows = await db
      .select({id: s.id, code: s.code, name: s.name, phone: s.phone})
      .from(s)
      .innerJoin(schema.supplierTypes, eq(schema.supplierTypes.id, s.typeId))
      .where(inArray(schema.supplierTypes.scope, ['domestic', 'both']))
      .orderBy(asc(s.name));
    parties = rows.map(r => ({...r, limit: null}));
  }
  return parties.map(pt => {
    const v = by.get(pt.id) ?? {opening: 0, increase: 0, decrease: 0};
    return {
      id: pt.id,
      code: pt.code,
      name: pt.name,
      phone: pt.phone,
      opening: Math.round(v.opening),
      increase: Math.round(v.increase),
      decrease: Math.round(v.decrease),
      closing: Math.round(v.opening + v.increase - v.decrease),
      limit: pt.limit,
    };
  });
}

export type PartyEntry = {
  key: string;
  date: string;
  docId: number | null;
  code: string;
  kind: DocKind | 'payment';
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type PartyEntries = {opening: number; rows: PartyEntry[]; closing: number};

/** Debt entries of one party inside the period with running balance. */
export async function partyEntries(user: CurrentUser, party: DebtParty, partyId: number, p: Period): Promise<PartyEntries> {
  const entries = await debtLedger(user, party, {partyId, to: p.den});
  let balance = 0;
  const rows: PartyEntry[] = [];
  let opening = 0;
  let i = 0;
  for (const e of entries) {
    balance += e.debit - e.credit;
    if (e.date < p.tu) {
      opening = balance;
      continue;
    }
    rows.push({
      key: `${i++}`,
      date: e.date,
      docId: e.kind === 'payment' ? null : e.docId,
      code: e.code,
      kind: e.kind,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance,
    });
  }
  return {opening, rows, closing: balance};
}

export type OpenDoc = {docId: number; code: string; date: string; dueDate: string | null; remaining: number};

export async function openDocsOf(user: CurrentUser, party: DebtParty, partyId: number): Promise<OpenDoc[]> {
  const open = await openDebtDocs(user, party, {partyId});
  return open.map(o => ({docId: o.docId, code: o.code, date: o.date, dueDate: o.dueDate, remaining: Math.round(o.remaining)}));
}

// ------------------------------------------------------------------ 6. nợ quá hạn

export type OverdueRow = {
  key: string;
  customerId: number;
  customerCode: string;
  customerName: string;
  phone: string | null;
  docId: number;
  kind: DocKind;
  code: string;
  date: string;
  dueDate: string;
  dueEstimated: boolean;
  daysOver: number;
  amount: number;
  remaining: number;
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string) {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

export async function overdueReport(user: CurrentUser): Promise<{rows: OverdueRow[]; today: string}> {
  const db = await getDb();
  const today = todayISO();
  const [open, debtDays] = await Promise.all([openDebtDocs(user, 'customer'), defaultDebtDays()]);
  const c = schema.customers;
  const customers = await db.select({id: c.id, code: c.code, name: c.name, phone: c.phone}).from(c);
  const cBy = new Map(customers.map(x => [x.id, x]));
  const kindRows = open.length
    ? await db.select({id: schema.stockDocs.id, kind: schema.stockDocs.kind}).from(schema.stockDocs).where(inArray(schema.stockDocs.id, open.map(o => o.docId)))
    : [];
  const kindBy = new Map(kindRows.map(k => [k.id, k.kind as DocKind]));
  const rows: OverdueRow[] = [];
  for (const o of open) {
    // a voucher without due date falls due after the default number of debt days
    const due = o.dueDate ?? addDays(o.date, debtDays);
    if (due >= today) continue;
    const cu = cBy.get(o.partyId);
    rows.push({
      key: String(o.docId),
      customerId: o.partyId,
      customerCode: cu?.code ?? '',
      customerName: cu?.name ?? `#${o.partyId}`,
      phone: cu?.phone ?? null,
      docId: o.docId,
      kind: kindBy.get(o.docId) ?? 'sale',
      code: o.code,
      date: o.date,
      dueDate: due,
      dueEstimated: !o.dueDate,
      daysOver: diffDays(today, due),
      amount: o.amount,
      remaining: Math.round(o.remaining),
    });
  }
  rows.sort((a, b) => b.daysOver - a.daysOver);
  return {rows, today};
}

// ------------------------------------------------------------------ 7. lịch sử giá bán

export type PriceLine = {
  key: string;
  date: string;
  docId: number;
  docCode: string;
  kind: DocKind;
  customerId: number | null;
  customerName: string;
  productId: number;
  productCode: string;
  productName: string;
  qty: number;
  unitPrice: number;
  discount: number;
  netPrice: number;
  listPrice: number;
};

export type PriceChange = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  price1: number;
  price2: number;
  price3: number;
  changedByName: string;
  changedAt: string;
};

export async function priceHistoryReport(user: CurrentUser, p: Period) {
  const db = await getDb();
  const d = schema.stockDocs;
  const l = schema.stockDocLines;
  const rows = await db
    .select({
      id: l.id,
      date: d.docDate,
      docId: d.id,
      docCode: d.code,
      kind: d.kind,
      customerId: d.customerId,
      customerName: schema.customers.name,
      productId: l.productId,
      productCode: schema.products.code,
      productName: schema.products.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      discount: l.discount,
      amount: l.amount,
    })
    .from(l)
    .innerJoin(d, eq(d.id, l.docId))
    .innerJoin(schema.products, eq(schema.products.id, l.productId))
    .leftJoin(schema.customers, eq(schema.customers.id, d.customerId))
    .where(
      and(
        inArray(d.kind, ['sale', 'sale_vat']),
        eq(d.status, 'posted'),
        gte(d.docDate, p.tu),
        lte(d.docDate, p.den),
        ...docScope(user),
      ),
    )
    .orderBy(desc(d.docDate), desc(d.id), asc(l.lineNo));
  const productIds = [...new Set(rows.map(r => r.productId))];
  const list = productIds.length
    ? await db.select().from(schema.salePrices).where(inArray(schema.salePrices.productId, productIds))
    : [];
  const listBy = new Map(list.map(x => [x.productId, num(x.price1)]));
  const lines: PriceLine[] = rows.map(r => {
    const qty = num(r.qty);
    return {
      key: String(r.id),
      date: r.date,
      docId: r.docId,
      docCode: r.docCode,
      kind: r.kind as DocKind,
      customerId: r.customerId,
      customerName: r.customerName ?? '—',
      productId: r.productId,
      productCode: r.productCode,
      productName: r.productName,
      qty,
      unitPrice: num(r.unitPrice),
      discount: num(r.discount),
      netPrice: qty ? Math.round(num(r.amount) / qty) : 0,
      listPrice: listBy.get(r.productId) ?? 0,
    };
  });

  const h = schema.salePriceHistory;
  const hist = await db
    .select({
      id: h.id,
      productId: h.productId,
      productCode: schema.products.code,
      productName: schema.products.name,
      price1: h.price1,
      price2: h.price2,
      price3: h.price3,
      changedByName: schema.users.fullName,
      changedAt: h.changedAt,
      isTaxType: schema.productTypes.isTax,
    })
    .from(h)
    .innerJoin(schema.products, eq(schema.products.id, h.productId))
    .innerJoin(schema.productTypes, eq(schema.productTypes.id, schema.products.typeId))
    .leftJoin(schema.users, eq(schema.users.id, h.changedBy))
    .where(isTaxMode ? eq(schema.productTypes.isTax, true) : undefined)
    .orderBy(desc(h.changedAt), desc(h.id))
    .limit(1000);
  const changes: PriceChange[] = hist.map(x => ({
    id: x.id,
    productId: x.productId,
    productCode: x.productCode,
    productName: x.productName,
    price1: num(x.price1),
    price2: num(x.price2),
    price3: num(x.price3),
    changedByName: x.changedByName ?? 'Hệ thống',
    changedAt: x.changedAt.toISOString(),
  }));

  const products = [...new Map(lines.map(x => [x.productId, {value: String(x.productId), label: `${x.productCode} · ${x.productName}`}])).values()];
  const customers = [
    ...new Map(
      lines.filter(x => x.customerId).map(x => [x.customerId!, {value: String(x.customerId), label: x.customerName}]),
    ).values(),
  ];
  return {lines, changes, products, customers};
}

// ------------------------------------------------------------------ 8. giao dịch khách hàng

export type CustomerOption = {value: string; label: string};

export async function customerOptions(): Promise<CustomerOption[]> {
  const db = await getDb();
  const c = schema.customers;
  const rows = await db.select({id: c.id, code: c.code, name: c.name, phone: c.phone}).from(c).orderBy(asc(c.name));
  return rows.map(r => ({value: String(r.id), label: `${r.name} · ${r.code}${r.phone ? ` · ${r.phone}` : ''}`}));
}

export type TxRow = {
  key: string;
  date: string;
  kind: DocKind | 'payment';
  docId: number | null;
  code: string;
  amount: number;
  paid: number;
  note: string;
};

export type CustomerTx = {
  customer: {id: number; code: string; name: string; phone: string | null; debtLimit: number | null};
  totalBought: number;
  totalReturned: number;
  totalPaid: number;
  balance: number;
  docCount: number;
  lastPurchase: string | null;
  top: {productId: number; code: string; name: string; qty: number; amount: number}[];
  rows: TxRow[];
};

export async function customerTransactions(user: CurrentUser, customerId: number, p: Period): Promise<CustomerTx | null> {
  const db = await getDb();
  const c = schema.customers;
  const [cu] = await db.select().from(c).where(eq(c.id, customerId));
  if (!cu) return null;
  const d = schema.stockDocs;
  const kinds: DocKind[] = ['sale', 'sale_vat', 'sale_return'];
  const base = [eq(d.customerId, customerId), eq(d.status, 'posted'), ...docScope(user)];
  const docs = await db
    .select()
    .from(d)
    .where(and(...base, inArray(d.kind, kinds), gte(d.docDate, p.tu), lte(d.docDate, p.den)))
    .orderBy(asc(d.docDate), asc(d.id));

  const pay = schema.debtPayments;
  const pays = isTaxMode
    ? []
    : await db
        .select()
        .from(pay)
        .where(
          and(
            eq(pay.partyType, 'customer'),
            eq(pay.customerId, customerId),
            gte(pay.payDate, p.tu),
            lte(pay.payDate, p.den),
            user.branchId ? eq(pay.branchId, user.branchId) : undefined,
          ),
        )
        .orderBy(asc(pay.payDate), asc(pay.id));

  const rows: TxRow[] = [
    ...docs.map(x => ({
      key: `d${x.id}`,
      date: x.docDate,
      kind: x.kind as DocKind,
      docId: x.id,
      code: x.code,
      amount: x.kind === 'sale_return' ? -num(x.total) : num(x.total),
      paid: x.kind === 'sale_return' ? -num(x.paidAmount) : num(x.paidAmount),
      note: x.reason || x.note || '',
    })),
    ...pays.map(x => ({
      key: `p${x.id}`,
      date: x.payDate,
      kind: 'payment' as const,
      docId: null,
      code: x.code,
      amount: 0,
      paid: num(x.amount),
      note: x.note || (x.method === 'bank' ? 'Chuyển khoản' : 'Tiền mặt'),
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key.localeCompare(b.key)));

  const sales = docs.filter(x => x.kind !== 'sale_return');
  const totalBought = sales.reduce((s, x) => s + num(x.total), 0);
  const totalReturned = docs.filter(x => x.kind === 'sale_return').reduce((s, x) => s + num(x.total), 0);
  const totalPaid = sales.reduce((s, x) => s + num(x.paidAmount), 0) + pays.reduce((s, x) => s + num(x.amount), 0);

  const ledger = await debtLedger(user, 'customer', {partyId: customerId, to: p.den});
  const balance = ledger.reduce((s, e) => s + e.debit - e.credit, 0);

  const [last] = await db
    .select({date: sql<string | null>`max(${d.docDate})`})
    .from(d)
    .where(and(...base, inArray(d.kind, ['sale', 'sale_vat'])));

  const saleIds = sales.map(x => x.id);
  const topRows = saleIds.length
    ? await db
        .select({
          productId: schema.stockDocLines.productId,
          code: schema.products.code,
          name: schema.products.name,
          qty: sql<string>`sum(${schema.stockDocLines.qty})`,
          amount: sql<string>`sum(${schema.stockDocLines.amount})`,
        })
        .from(schema.stockDocLines)
        .innerJoin(schema.products, eq(schema.products.id, schema.stockDocLines.productId))
        .where(inArray(schema.stockDocLines.docId, saleIds))
        .groupBy(schema.stockDocLines.productId, schema.products.code, schema.products.name)
        .orderBy(desc(sql`sum(${schema.stockDocLines.amount})`))
        .limit(5)
    : [];

  return {
    customer: {id: cu.id, code: cu.code, name: cu.name, phone: cu.phone, debtLimit: cu.debtLimit == null ? null : Number(cu.debtLimit)},
    totalBought,
    totalReturned,
    totalPaid,
    balance: Math.round(balance),
    docCount: docs.length,
    lastPurchase: last?.date ?? null,
    top: topRows.map(t => ({productId: t.productId, code: t.code, name: t.name, qty: num(t.qty), amount: num(t.amount)})),
    rows,
  };
}
