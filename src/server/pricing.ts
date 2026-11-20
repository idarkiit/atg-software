import 'server-only';
import {and, desc, eq, inArray} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {can, type CurrentUser} from '@/lib/auth';
import {friendlyDbError, nextCode, notifyApprovers, writeAudit} from './resources';
import {getAvgCost} from './stock';

/** Business logic of the "Quản lý bảng giá" module. */

export type Result = {ok: boolean; message: string};

const CURRENCIES = ['VND', 'CNY', 'USD'];
export const CURRENCY_OPTIONS = CURRENCIES.map(c => ({value: c, label: c}));

type Option = {value: string; label: string};

async function userNames() {
  const db = await getDb();
  const rows = await db.select({id: schema.users.id, name: schema.users.fullName}).from(schema.users);
  return new Map(rows.map(u => [u.id, u.name]));
}

// ------------------------------------------------------------------ Bảng giá bán

export type SalePriceRow = {
  id: number;
  code: string;
  name: string;
  unit: string;
  groupId: number | null;
  groupName: string | null;
  typeId: number;
  typeName: string | null;
  price1: number;
  price2: number;
  price3: number;
  updatedAt: string | null;
  updatedByName: string | null;
};

export async function listSalePrices(): Promise<{
  rows: SalePriceRow[];
  groups: Option[];
  types: Option[];
}> {
  const db = await getDb();
  const [products, groups, types, prices, names] = await Promise.all([
    db.select().from(schema.products).where(eq(schema.products.isActive, true)).orderBy(schema.products.code),
    db.select().from(schema.productGroups).orderBy(schema.productGroups.name),
    db.select().from(schema.productTypes).orderBy(schema.productTypes.name),
    db.select().from(schema.salePrices),
    userNames(),
  ]);
  const priceBy = new Map(prices.map(p => [p.productId, p]));
  const groupName = new Map(groups.map(g => [g.id, g.name]));
  const typeName = new Map(types.map(t => [t.id, t.name]));
  const rows = products.map(p => {
    const sp = priceBy.get(p.id);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      groupId: p.groupId,
      groupName: p.groupId ? (groupName.get(p.groupId) ?? null) : null,
      typeId: p.typeId,
      typeName: typeName.get(p.typeId) ?? null,
      price1: sp?.price1 ?? 0,
      price2: sp?.price2 ?? 0,
      price3: sp?.price3 ?? 0,
      updatedAt: sp ? sp.updatedAt.toISOString() : null,
      updatedByName: sp?.updatedBy ? (names.get(sp.updatedBy) ?? null) : null,
    };
  });
  return {
    rows,
    groups: groups.map(g => ({value: String(g.id), label: g.name})),
    types: types.map(t => ({value: String(t.id), label: t.name})),
  };
}

export type PriceHistoryRow = {
  id: number;
  price1: number;
  price2: number;
  price3: number;
  proposalCode: string | null;
  changedByName: string | null;
  changedAt: string;
};

export async function getPriceHistory(user: CurrentUser, productId: number): Promise<PriceHistoryRow[]> {
  if (!can(user, 'bang-gia/gia-ban', 'view')) return [];
  const db = await getDb();
  const [rows, names] = await Promise.all([
    db
      .select({h: schema.salePriceHistory, code: schema.priceProposals.code})
      .from(schema.salePriceHistory)
      .leftJoin(schema.priceProposals, eq(schema.priceProposals.id, schema.salePriceHistory.proposalId))
      .where(eq(schema.salePriceHistory.productId, productId))
      .orderBy(desc(schema.salePriceHistory.changedAt), desc(schema.salePriceHistory.id))
      .limit(100),
    userNames(),
  ]);
  return rows.map(({h, code}) => ({
    id: h.id,
    price1: h.price1,
    price2: h.price2,
    price3: h.price3,
    proposalCode: code,
    changedByName: h.changedBy ? (names.get(h.changedBy) ?? null) : null,
    changedAt: h.changedAt.toISOString(),
  }));
}

// ------------------------------------------------------------------ Bảng giá NCC

export type SupplierPriceRow = {
  id: number;
  code: string;
  supplierId: number;
  supplierName: string;
  productId: number;
  productCode: string;
  productName: string;
  groupId: number | null;
  price: number;
  currency: string;
  note: string | null;
  updatedAt: string;
};

export async function listSupplierPrices(): Promise<{
  rows: SupplierPriceRow[];
  suppliers: Option[];
  products: Option[];
  groups: Option[];
}> {
  const db = await getDb();
  const [rows, suppliers, products, groups] = await Promise.all([
    db
      .select({sp: schema.supplierPrices, supplier: schema.suppliers.name, p: schema.products})
      .from(schema.supplierPrices)
      .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.supplierPrices.supplierId))
      .innerJoin(schema.products, eq(schema.products.id, schema.supplierPrices.productId))
      .orderBy(schema.products.code, schema.suppliers.name),
    db.select().from(schema.suppliers).where(eq(schema.suppliers.isActive, true)).orderBy(schema.suppliers.name),
    db.select().from(schema.products).where(eq(schema.products.isActive, true)).orderBy(schema.products.code),
    db.select().from(schema.productGroups).orderBy(schema.productGroups.name),
  ]);
  return {
    rows: rows.map(({sp, supplier, p}) => ({
      id: sp.id,
      code: sp.code,
      supplierId: sp.supplierId,
      supplierName: supplier,
      productId: sp.productId,
      productCode: p.code,
      productName: p.name,
      groupId: p.groupId,
      price: sp.price,
      currency: sp.currency,
      note: sp.note,
      updatedAt: sp.updatedAt.toISOString(),
    })),
    suppliers: suppliers.map(s => ({value: String(s.id), label: s.name})),
    products: products.map(p => ({value: String(p.id), label: `${p.code} · ${p.name}`})),
    groups: groups.map(g => ({value: String(g.id), label: g.name})),
  };
}

export type SupplierPriceInput = {
  id: number | null;
  supplierId: number | null;
  productId: number | null;
  price: number | null;
  currency: string;
  note: string;
};

export async function saveSupplierPrice(user: CurrentUser, input: SupplierPriceInput): Promise<Result> {
  const feature = 'bang-gia/gia-ncc';
  if (!can(user, feature, input.id ? 'edit' : 'create')) {
    return {ok: false, message: 'Bạn không có quyền thực hiện thao tác này.'};
  }
  if (!input.supplierId) return {ok: false, message: 'Vui lòng chọn nhà cung cấp.'};
  if (!input.productId) return {ok: false, message: 'Vui lòng chọn sản phẩm.'};
  if (input.price === null || !(input.price >= 0)) return {ok: false, message: 'Vui lòng nhập giá nhập hợp lệ.'};
  if (!CURRENCIES.includes(input.currency)) return {ok: false, message: 'Tiền tệ không hợp lệ.'};
  const db = await getDb();
  const note = input.note.trim() || null;
  try {
    if (input.id) {
      const [row] = await db
        .update(schema.supplierPrices)
        .set({
          supplierId: input.supplierId,
          productId: input.productId,
          price: input.price,
          currency: input.currency,
          note,
          updatedAt: new Date(),
        })
        .where(eq(schema.supplierPrices.id, input.id))
        .returning({code: schema.supplierPrices.code});
      if (!row) return {ok: false, message: 'Bản ghi không còn tồn tại.'};
      await writeAudit(db, user.id, 'update', feature, input.id);
      return {ok: true, message: `Đã lưu ${row.code}.`};
    }
    const code = await nextCode(db, 'GNCC');
    const [row] = await db
      .insert(schema.supplierPrices)
      .values({
        code,
        supplierId: input.supplierId,
        productId: input.productId,
        price: input.price,
        currency: input.currency,
        note,
        createdBy: user.id,
      })
      .returning({id: schema.supplierPrices.id});
    await writeAudit(db, user.id, 'create', feature, row.id);
    return {ok: true, message: `Đã thêm giá NCC ${code}.`};
  } catch (err) {
    const msg = friendlyDbError(err);
    return {
      ok: false,
      message: msg.startsWith('Giá trị này đã tồn tại')
        ? 'Nhà cung cấp này đã có giá cho sản phẩm này. Hãy sửa dòng giá cũ thay vì thêm mới.'
        : msg,
    };
  }
}

export async function deleteSupplierPrice(user: CurrentUser, id: number): Promise<Result> {
  if (!can(user, 'bang-gia/gia-ncc', 'delete')) return {ok: false, message: 'Bạn không có quyền xóa.'};
  const db = await getDb();
  const [row] = await db
    .delete(schema.supplierPrices)
    .where(eq(schema.supplierPrices.id, id))
    .returning({code: schema.supplierPrices.code});
  await writeAudit(db, user.id, 'delete', 'bang-gia/gia-ncc', id);
  return {ok: true, message: `Đã xóa ${row?.code ?? ''}.`};
}

// ------------------------------------------------------------------ Thống kê giá các NCC

export type CompareData = {
  groups: Option[]; // parent groups only
  groupId: number | null;
  suppliers: {id: number; name: string}[];
  rows: {
    id: number;
    code: string;
    name: string;
    prices: Record<string, {price: number; currency: string} | null>;
  }[];
};

export async function getCompare(groupId: number | null): Promise<CompareData> {
  const db = await getDb();
  const allGroups = await db.select().from(schema.productGroups).orderBy(schema.productGroups.name);
  const parents = allGroups.filter(g => !g.parentId);
  const groups = parents.map(g => ({value: String(g.id), label: g.name}));
  if (!groupId) return {groups, groupId: null, suppliers: [], rows: []};

  const familyIds = [groupId, ...allGroups.filter(g => g.parentId === groupId).map(g => g.id)];
  const supplierIds = [
    ...new Set(allGroups.filter(g => familyIds.includes(g.id)).flatMap(g => g.supplierIds ?? [])),
  ];
  const [suppliers, products] = await Promise.all([
    supplierIds.length
      ? db.select().from(schema.suppliers).where(inArray(schema.suppliers.id, supplierIds)).orderBy(schema.suppliers.name)
      : Promise.resolve([]),
    db
      .select()
      .from(schema.products)
      .where(and(inArray(schema.products.groupId, familyIds), eq(schema.products.isActive, true)))
      .orderBy(schema.products.code),
  ]);
  const prices = products.length
    ? await db.select().from(schema.supplierPrices).where(inArray(schema.supplierPrices.productId, products.map(p => p.id)))
    : [];
  const byKey = new Map(prices.map(p => [`${p.productId}:${p.supplierId}`, p]));
  return {
    groups,
    groupId,
    suppliers: suppliers.map(s => ({id: s.id, name: s.name})),
    rows: products.map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      prices: Object.fromEntries(
        suppliers.map(s => {
          const sp = byKey.get(`${p.id}:${s.id}`);
          return [String(s.id), sp ? {price: sp.price, currency: sp.currency} : null];
        }),
      ),
    })),
  };
}

// ------------------------------------------------------------------ Bảng giá trung bình

export type AvgCostRow = {
  id: number;
  code: string;
  name: string;
  groupName: string | null;
  avgCost: number;
  extraCost: number;
  note: string | null;
  supplierMin: number | null;
  supplierMax: number | null;
  supplierAvg: number | null;
  supplierCount: number;
  movingAvg: number | null;
  updatedAt: string | null;
  updatedByName: string | null;
};

export async function listAvgCosts(): Promise<AvgCostRow[]> {
  const db = await getDb();
  const [products, groups, costs, supPrices, names] = await Promise.all([
    db.select().from(schema.products).where(eq(schema.products.isActive, true)).orderBy(schema.products.code),
    db.select().from(schema.productGroups),
    db.select().from(schema.avgCosts),
    db.select().from(schema.supplierPrices).where(and(eq(schema.supplierPrices.currency, 'VND'), eq(schema.supplierPrices.isActive, true))),
    userNames(),
  ]);
  const moving = await getAvgCost(db, products.map(p => p.id));
  const groupName = new Map(groups.map(g => [g.id, g.name]));
  const costBy = new Map(costs.map(c => [c.productId, c]));
  const supBy = new Map<number, number[]>();
  for (const s of supPrices) supBy.set(s.productId, [...(supBy.get(s.productId) ?? []), s.price]);
  return products.map(p => {
    const c = costBy.get(p.id);
    const sup = supBy.get(p.id) ?? [];
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      groupName: p.groupId ? (groupName.get(p.groupId) ?? null) : null,
      avgCost: c?.avgCost ?? 0,
      extraCost: c?.extraCost ?? 0,
      note: c?.note ?? null,
      supplierMin: sup.length ? Math.min(...sup) : null,
      supplierMax: sup.length ? Math.max(...sup) : null,
      supplierAvg: sup.length ? Math.round(sup.reduce((a, b) => a + b, 0) / sup.length) : null,
      supplierCount: sup.length,
      movingAvg: moving.get(p.id) ?? null,
      updatedAt: c ? c.updatedAt.toISOString() : null,
      updatedByName: c?.updatedBy ? (names.get(c.updatedBy) ?? null) : null,
    };
  });
}

export async function saveAvgCost(
  user: CurrentUser,
  input: {productId: number; avgCost: number | null; extraCost: number | null; note: string},
): Promise<Result> {
  if (!can(user, 'bang-gia/gia-trung-binh', 'edit')) return {ok: false, message: 'Bạn không có quyền sửa bảng giá trung bình.'};
  const avgCost = input.avgCost ?? 0;
  const extraCost = input.extraCost ?? 0;
  if (avgCost < 0 || extraCost < 0) return {ok: false, message: 'Giá và chi phí không được âm.'};
  const db = await getDb();
  const values = {avgCost, extraCost, note: input.note.trim() || null, updatedAt: new Date(), updatedBy: user.id};
  await db
    .insert(schema.avgCosts)
    .values({productId: input.productId, ...values})
    .onConflictDoUpdate({target: schema.avgCosts.productId, set: values});
  await writeAudit(db, user.id, 'update', 'bang-gia/gia-trung-binh', input.productId, {avgCost, extraCost});
  return {ok: true, message: 'Đã lưu giá trung bình.'};
}

// ------------------------------------------------------------------ Đề xuất giá bán

export type ProposalRow = {
  id: number;
  code: string;
  productId: number;
  productCode: string;
  productName: string;
  currentPrice1: number;
  currentPrice2: number;
  currentPrice3: number;
  proposedPrice1: number;
  proposedPrice2: number | null;
  proposedPrice3: number | null;
  approvedPrice1: number | null;
  approvedPrice2: number | null;
  approvedPrice3: number | null;
  costBasis: number | null;
  otherCost: number | null;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  requestedBy: number | null;
  requestedByName: string | null;
  reviewedByName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

async function loadProposals(where: ReturnType<typeof eq> | undefined): Promise<ProposalRow[]> {
  const db = await getDb();
  const [rows, names] = await Promise.all([
    db
      .select({p: schema.priceProposals, code: schema.products.code, name: schema.products.name})
      .from(schema.priceProposals)
      .innerJoin(schema.products, eq(schema.products.id, schema.priceProposals.productId))
      .where(where)
      .orderBy(desc(schema.priceProposals.createdAt), desc(schema.priceProposals.id))
      .limit(300),
    userNames(),
  ]);
  return rows.map(({p, code, name}) => ({
    id: p.id,
    code: p.code,
    productId: p.productId,
    productCode: code,
    productName: name,
    currentPrice1: p.currentPrice1,
    currentPrice2: p.currentPrice2,
    currentPrice3: p.currentPrice3,
    proposedPrice1: p.proposedPrice1,
    proposedPrice2: p.proposedPrice2,
    proposedPrice3: p.proposedPrice3,
    approvedPrice1: p.approvedPrice1,
    approvedPrice2: p.approvedPrice2,
    approvedPrice3: p.approvedPrice3,
    costBasis: p.costBasis,
    otherCost: p.otherCost,
    reason: p.reason,
    status: p.status,
    reviewNote: p.reviewNote,
    requestedBy: p.requestedBy,
    requestedByName: p.requestedBy ? (names.get(p.requestedBy) ?? null) : null,
    reviewedByName: p.reviewedBy ? (names.get(p.reviewedBy) ?? null) : null,
    createdAt: p.createdAt.toISOString(),
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
  }));
}

/** The user's own proposals; approvers of Tính lãi see everyone's. */
export async function listProposals(user: CurrentUser): Promise<ProposalRow[]> {
  const all = can(user, 'bang-gia/tinh-lai', 'approve');
  return loadProposals(all ? undefined : eq(schema.priceProposals.requestedBy, user.id));
}

export type ProposalInput = {
  productId: number | null;
  price1: number | null;
  price2: number | null;
  price3: number | null;
  reason: string;
};

export async function createProposal(user: CurrentUser, input: ProposalInput): Promise<Result> {
  const feature = 'bang-gia/de-xuat-gia';
  if (!can(user, feature, 'create') && !can(user, feature, 'propose')) {
    return {ok: false, message: 'Bạn không có quyền đề xuất giá bán.'};
  }
  if (!input.productId) return {ok: false, message: 'Vui lòng chọn sản phẩm.'};
  if (input.price1 === null || !(input.price1 > 0)) return {ok: false, message: 'Vui lòng nhập giá bán 1 đề xuất.'};
  for (const p of [input.price2, input.price3]) {
    if (p !== null && p < 0) return {ok: false, message: 'Giá đề xuất không được âm.'};
  }
  const db = await getDb();
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, input.productId));
  if (!product) return {ok: false, message: 'Sản phẩm không tồn tại.'};
  const [current] = await db.select().from(schema.salePrices).where(eq(schema.salePrices.productId, product.id));
  const code = await nextCode(db, 'DXG');
  const [row] = await db
    .insert(schema.priceProposals)
    .values({
      code,
      productId: product.id,
      currentPrice1: current?.price1 ?? 0,
      currentPrice2: current?.price2 ?? 0,
      currentPrice3: current?.price3 ?? 0,
      proposedPrice1: input.price1,
      proposedPrice2: input.price2 || null,
      proposedPrice3: input.price3 || null,
      reason: input.reason.trim() || null,
      requestedBy: user.id,
    })
    .returning({id: schema.priceProposals.id});
  await notifyApprovers(
    db,
    'bang-gia/tinh-lai',
    `Đề xuất giá bán ${code} chờ duyệt`,
    `${user.fullName} đề xuất giá bán cho ${product.code} · ${product.name}.`,
    '/bang-gia/tinh-lai',
    user.id,
  );
  await writeAudit(db, user.id, 'propose', feature, row.id, {code});
  return {ok: true, message: `Đã gửi đề xuất ${code}, chờ duyệt.`};
}

export async function withdrawProposal(user: CurrentUser, id: number): Promise<Result> {
  const db = await getDb();
  const [p] = await db.select().from(schema.priceProposals).where(eq(schema.priceProposals.id, id));
  if (!p) return {ok: false, message: 'Đề xuất không còn tồn tại.'};
  if (p.requestedBy !== user.id) return {ok: false, message: 'Chỉ người gửi mới được rút đề xuất.'};
  if (p.status !== 'pending') return {ok: false, message: 'Đề xuất đã được xử lý, không thể rút.'};
  await db.delete(schema.priceProposals).where(eq(schema.priceProposals.id, id));
  await writeAudit(db, user.id, 'delete', 'bang-gia/de-xuat-gia', id, {code: p.code});
  return {ok: true, message: `Đã rút đề xuất ${p.code}.`};
}

// ------------------------------------------------------------------ Tính lãi giá bán

export type ReviewRow = ProposalRow & {
  /** Default cost basis: avg_costs (avgCost + extraCost) else stock moving average. */
  defaultCost: number;
  costSource: 'avg' | 'stock' | 'none';
};

export async function listForReview(user: CurrentUser): Promise<ReviewRow[]> {
  if (!can(user, 'bang-gia/tinh-lai', 'view')) return [];
  const db = await getDb();
  const rows = await loadProposals(undefined);
  const ids = [...new Set(rows.map(r => r.productId))];
  const [costs, moving] = await Promise.all([
    ids.length ? db.select().from(schema.avgCosts).where(inArray(schema.avgCosts.productId, ids)) : Promise.resolve([]),
    getAvgCost(db, ids),
  ]);
  const costBy = new Map(costs.map(c => [c.productId, c]));
  return rows.map(r => {
    const c = costBy.get(r.productId);
    if (c && c.avgCost > 0) return {...r, defaultCost: c.avgCost + c.extraCost, costSource: 'avg' as const};
    const m = moving.get(r.productId);
    if (m) return {...r, defaultCost: m, costSource: 'stock' as const};
    return {...r, defaultCost: 0, costSource: 'none' as const};
  });
}

export type ApproveInput = {
  id: number;
  price1: number | null;
  price2: number | null;
  price3: number | null;
  costBasis: number | null;
  otherCost: number | null;
};

export async function approveProposal(user: CurrentUser, input: ApproveInput): Promise<Result> {
  if (!can(user, 'bang-gia/tinh-lai', 'approve')) return {ok: false, message: 'Bạn không có quyền duyệt giá bán.'};
  if (input.price1 === null || !(input.price1 > 0)) return {ok: false, message: 'Giá bán mới 1 phải lớn hơn 0.'};
  for (const p of [input.price2, input.price3]) {
    if (p !== null && p < 0) return {ok: false, message: 'Giá bán mới không được âm.'};
  }
  const db = await getDb();
  try {
    return await db.transaction(async tx => {
      const [p] = await tx.select().from(schema.priceProposals).where(eq(schema.priceProposals.id, input.id));
      if (!p || p.status !== 'pending') return {ok: false, message: 'Đề xuất đã được xử lý.'};
      const [current] = await tx.select().from(schema.salePrices).where(eq(schema.salePrices.productId, p.productId));
      // An empty price 2 or 3 keeps the current price.
      const price1 = input.price1!;
      const price2 = input.price2 || current?.price2 || 0;
      const price3 = input.price3 || current?.price3 || 0;
      const now = new Date();
      await tx
        .insert(schema.salePrices)
        .values({productId: p.productId, price1, price2, price3, updatedAt: now, updatedBy: user.id})
        .onConflictDoUpdate({
          target: schema.salePrices.productId,
          set: {price1, price2, price3, updatedAt: now, updatedBy: user.id},
        });
      await tx.insert(schema.salePriceHistory).values({
        productId: p.productId,
        price1,
        price2,
        price3,
        proposalId: p.id,
        changedBy: user.id,
        changedAt: now,
      });
      await tx
        .update(schema.priceProposals)
        .set({
          status: 'approved',
          approvedPrice1: price1,
          approvedPrice2: price2,
          approvedPrice3: price3,
          costBasis: input.costBasis,
          otherCost: input.otherCost ?? 0,
          reviewedBy: user.id,
          reviewedAt: now,
        })
        .where(eq(schema.priceProposals.id, p.id));
      if (p.requestedBy) {
        await tx.insert(schema.notifications).values({
          userId: p.requestedBy,
          feature: 'bang-gia/de-xuat-gia',
          title: `Đề xuất giá ${p.code} đã được duyệt`,
          body: null,
          link: '/bang-gia/de-xuat-gia',
        });
      }
      await tx.insert(schema.auditLogs).values({
        userId: user.id,
        action: 'approve',
        resource: 'bang-gia/tinh-lai',
        recordId: p.id,
        detail: {code: p.code, price1, price2, price3},
      });
      return {ok: true, message: `Đã duyệt ${p.code} và cập nhật bảng giá bán.`};
    });
  } catch (err) {
    return {ok: false, message: friendlyDbError(err)};
  }
}

export async function rejectProposal(user: CurrentUser, id: number, note: string): Promise<Result> {
  if (!can(user, 'bang-gia/tinh-lai', 'approve')) return {ok: false, message: 'Bạn không có quyền từ chối đề xuất giá.'};
  if (!note.trim()) return {ok: false, message: 'Vui lòng nhập lý do từ chối.'};
  const db = await getDb();
  const [p] = await db.select().from(schema.priceProposals).where(eq(schema.priceProposals.id, id));
  if (!p || p.status !== 'pending') return {ok: false, message: 'Đề xuất đã được xử lý.'};
  await db
    .update(schema.priceProposals)
    .set({status: 'rejected', reviewedBy: user.id, reviewedAt: new Date(), reviewNote: note.trim()})
    .where(eq(schema.priceProposals.id, id));
  if (p.requestedBy) {
    await db.insert(schema.notifications).values({
      userId: p.requestedBy,
      feature: 'bang-gia/de-xuat-gia',
      title: `Đề xuất giá ${p.code} bị từ chối`,
      body: note.trim(),
      link: '/bang-gia/de-xuat-gia',
    });
  }
  await writeAudit(db, user.id, 'reject', 'bang-gia/tinh-lai', id, {code: p.code});
  return {ok: true, message: `Đã từ chối ${p.code}.`};
}

/** Products for the proposal dialog (code, name, current prices). */
export async function listProposalProducts() {
  const {rows} = await listSalePrices();
  return rows.map(r => ({id: r.id, code: r.code, name: r.name, price1: r.price1, price2: r.price2, price3: r.price3}));
}

export async function countPendingPriceProposals(user: CurrentUser): Promise<number> {
  if (!can(user, 'bang-gia/tinh-lai', 'approve')) return 0;
  const db = await getDb();
  const rows = await db
    .select({id: schema.priceProposals.id})
    .from(schema.priceProposals)
    .where(eq(schema.priceProposals.status, 'pending'));
  return rows.length;
}
