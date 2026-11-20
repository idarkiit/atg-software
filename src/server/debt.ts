import 'server-only';
import {and, asc, eq, inArray, lte} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {can, type CurrentUser} from '@/lib/auth';
import {DOC_KINDS, type DocKind} from '@/lib/stock/kinds';
import {friendlyDbError, nextCode, writeAudit} from './resources';
import {isTaxMode, getSettings} from './toggles';

/**
 * Công nợ (receivables / payables), derived from vouchers + debt_payments.
 *
 * Every entry moves the balance of one party:
 *   customer balance = what the customer owes ATG
 *   supplier balance = what ATG owes the supplier
 * debit increases the balance, credit decreases it.
 */
export type DebtParty = 'customer' | 'supplier';

export type DebtEntry = {
  date: string;
  partyId: number;
  /** stock_docs.id, or null for a payment not tied to one voucher */
  docId: number | null;
  paymentId: number | null;
  code: string;
  kind: DocKind | 'payment';
  description: string;
  debit: number;
  credit: number;
  dueDate: string | null;
};

const PARTY_KINDS: Record<DebtParty, DocKind[]> = {
  customer: ['sale', 'sale_vat', 'sale_return'],
  supplier: ['purchase', 'purchase_return'],
};

/** All debt entries up to `to` (inclusive), oldest first. */
export async function debtLedger(
  user: CurrentUser,
  party: DebtParty,
  opts: {partyId?: number; to?: string} = {},
): Promise<DebtEntry[]> {
  const db = await getDb();
  const d = schema.stockDocs;
  const partyCol = party === 'customer' ? d.customerId : d.supplierId;
  const docs = await db
    .select()
    .from(d)
    .where(
      and(
        inArray(d.kind, PARTY_KINDS[party]),
        eq(d.status, 'posted'),
        opts.partyId ? eq(partyCol, opts.partyId) : undefined,
        opts.to ? lte(d.docDate, opts.to) : undefined,
        user.branchId ? eq(d.branchId, user.branchId) : undefined,
        isTaxMode ? eq(d.isTax, true) : undefined,
      ),
    )
    .orderBy(asc(d.docDate), asc(d.id));

  const p = schema.debtPayments;
  const pays = await db
    .select()
    .from(p)
    .where(
      and(
        eq(p.partyType, party),
        opts.partyId ? eq(party === 'customer' ? p.customerId : p.supplierId, opts.partyId) : undefined,
        opts.to ? lte(p.payDate, opts.to) : undefined,
        user.branchId ? eq(p.branchId, user.branchId) : undefined,
      ),
    )
    .orderBy(asc(p.payDate), asc(p.id));

  const entries: DebtEntry[] = [];
  for (const doc of docs) {
    const def = DOC_KINDS[doc.kind as DocKind];
    const partyId = (party === 'customer' ? doc.customerId : doc.supplierId)!;
    const total = Number(doc.total);
    const paid = Number(doc.paidAmount);
    const sign = def.debt?.sign ?? 1;
    const base = {date: doc.docDate, partyId, docId: doc.id, paymentId: null, code: doc.code, kind: doc.kind as DocKind, dueDate: doc.dueDate};
    if (sign === 1) {
      entries.push({...base, description: def.title, debit: total, credit: 0});
      if (paid > 0) entries.push({...base, description: 'Thanh toán ngay trên phiếu', debit: 0, credit: paid});
    } else {
      entries.push({...base, description: def.title, debit: 0, credit: total});
      if (paid > 0) entries.push({...base, description: party === 'customer' ? 'Hoàn tiền cho khách' : 'NCC hoàn tiền', debit: paid, credit: 0});
    }
  }
  if (!isTaxMode) {
    for (const pay of pays) {
      entries.push({
        date: pay.payDate,
        partyId: (party === 'customer' ? pay.customerId : pay.supplierId)!,
        docId: pay.docId,
        paymentId: pay.id,
        code: pay.code,
        kind: 'payment',
        description: pay.note || (party === 'customer' ? 'Thu nợ khách hàng' : 'Trả nợ nhà cung cấp'),
        debit: 0,
        credit: Number(pay.amount),
        dueDate: null,
      });
    }
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return entries;
}

/**
 * Open (not fully paid) debit vouchers per party, oldest first. Payments with a docId
 * settle that voucher; other credits (returns, unlinked payments) settle the oldest first.
 */
export async function openDebtDocs(user: CurrentUser, party: DebtParty, opts: {partyId?: number} = {}) {
  const entries = await debtLedger(user, party, opts);
  type Open = {docId: number; code: string; date: string; dueDate: string | null; partyId: number; amount: number; remaining: number};
  const open: Open[] = [];
  const byDoc = new Map<number, Open>();
  for (const e of entries) {
    if (e.debit > 0 && e.docId && e.kind !== 'payment' && DOC_KINDS[e.kind].debt?.sign === 1) {
      const o = {docId: e.docId, code: e.code, date: e.date, dueDate: e.dueDate, partyId: e.partyId, amount: e.debit, remaining: e.debit};
      open.push(o);
      byDoc.set(e.docId, o);
    }
  }
  const floating = new Map<number, number>();
  for (const e of entries) {
    if (e.credit <= 0) continue;
    const linked = e.docId ? byDoc.get(e.docId) : undefined;
    if (linked && (e.kind === 'payment' || e.description === 'Thanh toán ngay trên phiếu')) {
      linked.remaining -= e.credit;
    } else {
      floating.set(e.partyId, (floating.get(e.partyId) ?? 0) + e.credit);
    }
  }
  // refunds (debit on a return voucher) give back part of the floating credit
  for (const e of entries) {
    if (e.debit > 0 && e.kind !== 'payment' && DOC_KINDS[e.kind].debt?.sign === -1) {
      floating.set(e.partyId, (floating.get(e.partyId) ?? 0) - e.debit);
    }
  }
  for (const o of open) {
    const f = floating.get(o.partyId) ?? 0;
    if (f > 0 && o.remaining > 0) {
      const use = Math.min(f, o.remaining);
      o.remaining -= use;
      floating.set(o.partyId, f - use);
    }
  }
  return open.filter(o => o.remaining > 0.5);
}

export type PaymentInput = {
  party: DebtParty;
  partyId: number;
  docId?: number | null;
  amount: number;
  payDate: string;
  method: 'cash' | 'bank';
  note?: string;
};

/** Record money received from a customer / paid to a supplier. */
export async function recordPayment(user: CurrentUser, input: PaymentInput) {
  const feature = input.party === 'customer' ? 'xuat-nhap/cong-no-kh' : 'xuat-nhap/cong-no-ncc';
  if (!can(user, feature, 'create')) return {ok: false as const, message: 'Bạn chưa có quyền ghi nhận thanh toán công nợ.'};
  if (!(input.amount > 0)) return {ok: false as const, message: 'Số tiền phải lớn hơn 0.'};
  if (!input.partyId) return {ok: false as const, message: 'Chưa chọn đối tượng.'};
  const db = await getDb();
  try {
    if (input.docId) {
      const open = await openDebtDocs(user, input.party, {partyId: input.partyId});
      const doc = open.find(o => o.docId === input.docId);
      if (!doc) return {ok: false as const, message: 'Phiếu này đã được thanh toán đủ.'};
      if (input.amount > doc.remaining + 0.5) {
        return {ok: false as const, message: `Phiếu ${doc.code} chỉ còn nợ ${new Intl.NumberFormat('vi-VN').format(doc.remaining)} đ.`};
      }
    }
    const code = await nextCode(db, input.party === 'customer' ? 'TN' : 'TT');
    const [row] = await db
      .insert(schema.debtPayments)
      .values({
        code,
        partyType: input.party,
        customerId: input.party === 'customer' ? input.partyId : null,
        supplierId: input.party === 'supplier' ? input.partyId : null,
        docId: input.docId || null,
        branchId: user.branchId,
        amount: input.amount,
        payDate: input.payDate,
        method: input.method,
        note: input.note || null,
        createdBy: user.id,
      })
      .returning();
    await writeAudit(db, user.id, 'create', feature, row.id, {code, amount: input.amount});
    return {ok: true as const, message: `Đã ghi nhận ${code}.`, code};
  } catch (e) {
    return {ok: false as const, message: friendlyDbError(e)};
  }
}

/** Days a customer may owe before a voucher counts as overdue when it has no due date. */
export async function defaultDebtDays() {
  const s = await getSettings();
  return Number(s.defaultDebtDays ?? 30);
}


