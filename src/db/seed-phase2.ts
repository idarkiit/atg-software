import {sql, eq} from 'drizzle-orm';
import type {PgDatabase, PgQueryResultHKT} from 'drizzle-orm/pg-core';
import * as schema from './schema';

type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Demo data for phase 2 (prices, vouchers, debt). Runs once, when no voucher type
 * exists yet, so databases created in phase 1 also get it after upgrading.
 * Writes the ledger directly (the posting code needs a request context).
 */
export async function seedPhase2IfEmpty(db: DB) {
  const res = (await db.execute(sql`select count(*)::int as count from stock_doc_types`)) as unknown as {
    rows: {count: number}[];
  };
  if ((res.rows[0]?.count ?? 0) > 0) return;

  const nextCode = async (prefix: string) => {
    const r = (await db.execute(
      sql`insert into code_sequences (prefix, value) values (${prefix}, 1)
          on conflict (prefix) do update set value = code_sequences.value + 1 returning value`,
    )) as unknown as {rows: {value: number}[]};
    return `${prefix}-${String(r.rows[0].value).padStart(6, '0')}`;
  };

  // ------------------------------------------------------------ voucher types (always)
  const typeRows = await db
    .insert(schema.stockDocTypes)
    .values(
      await Promise.all(
        (
          [
            ['Xuất bán lẻ', 'sale'],
            ['Xuất bán sỉ / đại lý', 'sale'],
            ['Xuất bán có hóa đơn VAT', 'sale_vat'],
            ['Khách trả hàng', 'sale_return'],
            ['Nhập mua trong nước', 'purchase'],
            ['Nhập khẩu', 'purchase'],
            ['Trả hàng nhà cung cấp', 'purchase_return'],
            ['Xuất hủy hàng hỏng', 'dispose'],
            ['Xuất hủy hàng mất', 'dispose'],
            ['Xuất hàng mẫu / quà tặng', 'internal'],
            ['Xuất dùng cho bảo hành', 'internal'],
            ['Chuyển kho nội bộ', 'transfer'],
            ['Tách bộ / gộp bộ', 'convert'],
          ] as const
        ).map(async ([name, kind]) => ({code: await nextCode('LXN'), name, kind})),
      ),
    )
    .returning();
  const typeOf = (name: string) => typeRows.find(t => t.name === name)!.id;

  // Phase 2 permissions for the demo roles (kept if ATG already changed them).
  const roles = await db.select().from(schema.roles);
  const roleId = (name: string) => roles.find(r => r.name === name)?.id;
  const editor = {canView: true, canCreate: true, canEdit: true, canDelete: false, canPropose: true, canApprove: false};
  const viewOnly = {canView: true, canCreate: false, canEdit: false, canDelete: false, canPropose: false, canApprove: false};
  const extra: (typeof schema.rolePermissions.$inferInsert)[] = [];
  for (const name of ['Kế toán', 'Kho', 'Bán hàng']) {
    const id = roleId(name);
    if (!id) continue;
    extra.push({roleId: id, feature: 'canh-bao/ghi-chu', ...editor}, {roleId: id, feature: 'canh-bao/san-pham-loi', ...editor});
  }
  const sales = roleId('Bán hàng');
  if (sales) {
    for (const f of ['xuat-nhap/lich-su-gia', 'xuat-nhap/giao-dich-kh', 'xuat-nhap/ton-kho', 'xuat-nhap/cong-no-kh', 'xuat-nhap/no-qua-han']) {
      extra.push({roleId: sales, feature: f, ...viewOnly});
    }
    extra.push({roleId: sales, feature: 'xuat-nhap/khach-tra-hang', ...editor});
  }
  if (extra.length) await db.insert(schema.rolePermissions).values(extra).onConflictDoNothing();

  // Only add business demo data to the demo database built by seed.ts.
  const products = await db.select().from(schema.products).orderBy(schema.products.id);
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.username, 'admin'));
  if (products.length < 12 || !admin) return;
  const warehouses = await db.select().from(schema.warehouses).orderBy(schema.warehouses.id);
  const suppliers = await db.select().from(schema.suppliers).orderBy(schema.suppliers.id);
  const customers = await db.select().from(schema.customers).orderBy(schema.customers.id);
  const employees = await db.select().from(schema.employees).orderBy(schema.employees.id);
  const [whHn, whHnWarranty, whHcm] = warehouses;
  const [supSz, supGz, , supMinhPhat, supSg] = suppliers;
  const [cusHoangGia, cusDucAnh, cusTuan, cusL88] = customers;

  // cost (VND) per product, same order as seed.ts
  const costs = [1450000, 520000, 310000, 980000, 450000, 890000, 640000, 160000, 210000, 590000, 280000, 240000];
  const taxTypeIds = new Set(
    (await db.select().from(schema.productTypes).where(eq(schema.productTypes.isTax, true))).map(t => t.id),
  );
  const isTax = (pid: number) => taxTypeIds.has(products.find(p => p.id === pid)!.typeId);
  const round = (n: number) => Math.round(n / 1000) * 1000;

  // ------------------------------------------------------------ prices
  await db.insert(schema.salePrices).values(
    products.map((p, i) => ({
      productId: p.id,
      price1: round(costs[i] * 1.35),
      price2: round(costs[i] * 1.25),
      price3: round(costs[i] * 1.18),
      updatedBy: admin.id,
    })),
  );
  await db.insert(schema.salePriceHistory).values(
    products.map((p, i) => ({
      productId: p.id,
      price1: round(costs[i] * 1.35),
      price2: round(costs[i] * 1.25),
      price3: round(costs[i] * 1.18),
      changedBy: admin.id,
    })),
  );
  await db.insert(schema.avgCosts).values(
    products.map((p, i) => ({productId: p.id, avgCost: costs[i], extraCost: round(costs[i] * 0.04), updatedBy: admin.id})),
  );
  const supplierPriceRows: (typeof schema.supplierPrices.$inferInsert)[] = [];
  const factors = [0.95, 1.0, 1.06, 0.98, 1.03];
  for (const [i, p] of products.entries()) {
    suppliers.forEach((s, si) => {
      if ((i + si) % 3 === 2) return; // not every supplier sells every product
      supplierPriceRows.push({code: '', supplierId: s.id, productId: p.id, price: round(costs[i] * factors[si]), currency: 'VND'});
    });
  }
  for (const r of supplierPriceRows) r.code = await nextCode('GNCC');
  await db.insert(schema.supplierPrices).values(supplierPriceRows);

  await db.insert(schema.priceProposals).values([
    {
      code: await nextCode('DXG'),
      productId: products[0].id,
      currentPrice1: round(costs[0] * 1.35),
      currentPrice2: round(costs[0] * 1.25),
      currentPrice3: round(costs[0] * 1.18),
      proposedPrice1: round(costs[0] * 1.3),
      proposedPrice2: round(costs[0] * 1.22),
      reason: 'Đối thủ đang bán 1.890.000 đ, đề xuất giảm để giữ khách đại lý',
      requestedBy: admin.id + 3,
    },
    {
      code: await nextCode('DXG'),
      productId: products[7].id,
      currentPrice1: round(costs[7] * 1.35),
      currentPrice2: round(costs[7] * 1.25),
      currentPrice3: round(costs[7] * 1.18),
      proposedPrice1: round(costs[7] * 1.45),
      reason: 'Giá nhập lô mới tăng 8%',
      requestedBy: admin.id + 3,
    },
  ]);

  // ------------------------------------------------------------ vouchers
  const day = (offset: number) => new Date(Date.now() + 7 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);

  type Line = {p: number; qty: number; price?: number; cost?: number; dir?: 'in' | 'out'};
  const post = async (v: {
    kind: string;
    prefix: string;
    type: string;
    wh: typeof whHn;
    toWh?: typeof whHn;
    date: string;
    dueDate?: string;
    customerId?: number;
    supplierId?: number;
    employeeId?: number;
    refDocId?: number;
    vatRate?: number;
    paid?: number;
    reason?: string;
    lines: Line[];
  }) => {
    const sign = ['sale', 'sale_vat', 'purchase_return', 'dispose', 'internal', 'transfer'].includes(v.kind) ? -1 : 1;
    const priced = ['sale', 'sale_vat', 'sale_return', 'purchase', 'purchase_return'].includes(v.kind);
    const subtotal = priced ? v.lines.reduce((s, l) => s + l.qty * (l.price ?? 0), 0) : 0;
    const vatAmount = Math.round((subtotal * (v.vatRate ?? 0)) / 100);
    const total = subtotal + vatAmount;
    const lineCost = (l: Line) => l.cost ?? costs[l.p];
    const costTotal = v.lines.reduce((s, l) => s + (l.dir === 'in' ? 0 : l.qty * lineCost(l)), 0);
    const [doc] = await db
      .insert(schema.stockDocs)
      .values({
        code: await nextCode(v.prefix),
        kind: v.kind,
        typeId: typeOf(v.type),
        branchId: v.wh.branchId,
        warehouseId: v.wh.id,
        toWarehouseId: v.toWh?.id ?? null,
        customerId: v.customerId ?? null,
        supplierId: v.supplierId ?? null,
        employeeId: v.employeeId ?? null,
        refDocId: v.refDocId ?? null,
        docDate: v.date,
        dueDate: v.dueDate ?? null,
        isVat: (v.vatRate ?? 0) > 0,
        isTax: v.kind === 'sale_vat' || v.lines.some(l => isTax(products[l.p].id)),
        vatRate: v.vatRate ?? 0,
        subtotal,
        vatAmount,
        total,
        paidAmount: v.paid ?? 0,
        paymentMethod: v.paid ? 'cash' : null,
        costTotal,
        reason: v.reason ?? null,
        createdBy: admin.id,
      })
      .returning();
    for (const [i, l] of v.lines.entries()) {
      const pid = products[l.p].id;
      const amount = priced ? l.qty * (l.price ?? 0) : 0;
      const [line] = await db
        .insert(schema.stockDocLines)
        .values({
          docId: doc.id,
          lineNo: i + 1,
          productId: pid,
          lineDir: v.kind === 'convert' ? l.dir : null,
          qty: l.qty,
          unitPrice: priced ? l.price ?? 0 : 0,
          amount,
          unitCost: lineCost(l),
        })
        .returning();
      const base = {docId: doc.id, lineId: line.id, productId: pid, unitCost: lineCost(l), moveDate: v.date, isTax: isTax(pid)};
      const q = v.kind === 'convert' ? (l.dir === 'in' ? l.qty : -l.qty) : sign * l.qty;
      await db.insert(schema.stockMoves).values({...base, warehouseId: v.wh.id, branchId: v.wh.branchId, qty: q});
      if (v.toWh) await db.insert(schema.stockMoves).values({...base, warehouseId: v.toWh.id, branchId: v.toWh.branchId, qty: l.qty});
    }
    return doc;
  };
  const sale = (p: number, qty: number, level = 0) => ({p, qty, price: round(costs[p] * [1.35, 1.25, 1.18][level])});

  // Stock in
  await post({
    kind: 'purchase', prefix: 'PN', type: 'Nhập khẩu', wh: whHn, date: day(-75), supplierId: supSz.id, paid: 60000000,
    lines: [0, 1, 2, 3, 4, 5, 6].map(p => ({p, qty: [30, 50, 40, 20, 40, 25, 30][p], price: costs[p]})),
  });
  const pnMp = await post({
    kind: 'purchase', prefix: 'PN', type: 'Nhập mua trong nước', wh: whHn, date: day(-60), supplierId: supMinhPhat.id, dueDate: day(-30), paid: 5000000,
    lines: [7, 8, 9, 10, 11].map(p => ({p, qty: [60, 50, 30, 25, 25][p - 7], price: costs[p]})),
  });
  await post({
    kind: 'purchase', prefix: 'PN', type: 'Nhập mua trong nước', wh: whHcm, date: day(-50), supplierId: supSg.id,
    lines: [1, 4, 7, 9].map(p => ({p, qty: 15, price: costs[p]})),
  });
  void supGz;

  // Sales (one overdue, one partly paid, one paid in full, one VAT)
  const sHg = await post({
    kind: 'sale', prefix: 'PXB', type: 'Xuất bán sỉ / đại lý', wh: whHn, date: day(-45), dueDate: day(-15), customerId: cusHoangGia.id,
    lines: [sale(0, 5, 1), sale(7, 10, 1), sale(10, 4, 1)],
  });
  await post({
    kind: 'sale', prefix: 'PXB', type: 'Xuất bán sỉ / đại lý', wh: whHn, date: day(-12), dueDate: day(33), customerId: cusDucAnh.id, paid: 3000000,
    lines: [sale(2, 6, 2), sale(3, 2, 2), sale(8, 8, 2)],
  });
  await post({
    kind: 'sale', prefix: 'PXB', type: 'Xuất bán lẻ', wh: whHn, date: day(-3), customerId: cusTuan.id,
    lines: [sale(5, 1)],
    paid: round(costs[5] * 1.35),
  });
  await post({
    kind: 'sale_vat', prefix: 'PXV', type: 'Xuất bán có hóa đơn VAT', wh: whHn, date: day(-5), dueDate: day(25), customerId: cusHoangGia.id, vatRate: 10,
    lines: [sale(1, 4, 1), sale(6, 3, 1)],
  });
  await post({
    kind: 'sale', prefix: 'PXB', type: 'Xuất bán sỉ / đại lý', wh: whHcm, date: day(-40), dueDate: day(-10), customerId: cusL88.id,
    lines: [sale(1, 5, 1), sale(7, 6, 1)],
  });

  // Return, dispose, internal, transfer
  await post({
    kind: 'sale_return', prefix: 'PKT', type: 'Khách trả hàng', wh: whHn, date: day(-40), customerId: cusHoangGia.id, refDocId: sHg.id,
    reason: 'Sạc không nhận máy, khách trả 2 cái', lines: [{p: 7, qty: 2, price: round(costs[7] * 1.25)}],
  });
  await post({kind: 'dispose', prefix: 'PXH', type: 'Xuất hủy hàng hỏng', wh: whHn, date: day(-20), reason: 'Pin phồng khi kiểm kho', lines: [{p: 2, qty: 2}]});
  await post({
    kind: 'internal', prefix: 'PXN', type: 'Xuất dùng cho bảo hành', wh: whHn, date: day(-8), employeeId: employees[2]?.id,
    reason: 'Đổi bảo hành cho khách Hoàng Gia', lines: [{p: 0, qty: 1}],
  });
  await post({kind: 'transfer', prefix: 'PCK', type: 'Chuyển kho nội bộ', wh: whHn, toWh: whHnWarranty, date: day(-7), lines: [{p: 7, qty: 5}]});

  // A payment against the domestic supplier and one from a customer
  await db.insert(schema.debtPayments).values([
    {code: await nextCode('TT'), partyType: 'supplier', supplierId: supMinhPhat.id, docId: pnMp.id, branchId: whHn.branchId, amount: 10000000, payDate: day(-30), method: 'bank', note: 'Chuyển khoản đợt 1', createdBy: admin.id},
    {code: await nextCode('TN'), partyType: 'customer', customerId: cusHoangGia.id, docId: sHg.id, branchId: whHn.branchId, amount: 2000000, payDate: day(-20), method: 'cash', note: 'Khách trả bớt', createdBy: admin.id},
  ]);

  // Alerts
  await db.insert(schema.defectiveProducts).values([
    {code: await nextCode('SPL'), productId: products[2].id, supplierId: supSz.id, defectType: 'Pin phồng sau 1 tháng', detail: 'Lô nhập tháng trước có 3/40 viên phồng. Tạm không nhập từ NCC này.', createdBy: admin.id},
    {code: await nextCode('SPL'), productId: products[8].id, defectType: 'Đầu sạc lỏng', detail: 'Khách phản ánh nhiều, kiểm tra kỹ khi nhập', createdBy: admin.id},
  ]);
  await db.insert(schema.notes).values([
    {code: await nextCode('GC'), title: 'Nhắc thu nợ Hoàng Gia', content: 'Phiếu xuất tháng trước đã quá hạn, gọi anh Hùng.', customerId: cusHoangGia.id, remindAt: day(1), createdBy: admin.id},
    {code: await nextCode('GC'), title: 'Hỏi NCC Minh Phát giá sạc mới', supplierId: supMinhPhat.id, remindAt: day(3), createdBy: admin.id},
  ]);
}
