import bcrypt from 'bcryptjs';
import {sql} from 'drizzle-orm';
import type {PgDatabase, PgQueryResultHKT} from 'drizzle-orm/pg-core';
import * as schema from './schema';
import {allFeatures} from '@/lib/features';

type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Demo data so ATG can click through every screen right after deploy.
 * Runs only when the database has no users yet.
 *
 * Demo accounts (password 123456 except admin):
 *   admin / admin123   – Quản trị (toàn quyền)
 *   ketoan             – Kế toán (duyệt khách hàng, NCC, giá)
 *   kho                – Thủ kho
 *   banhang            – Nhân viên bán hàng (chỉ đề xuất)
 *   hr                 – Hành chính nhân sự (duyệt nhân viên)
 */
export async function seedIfEmpty(db: DB) {
  const result = (await db.execute(sql`select count(*)::int as count from users`)) as unknown as {
    rows: {count: number}[];
  };
  const count = result.rows[0]?.count ?? 0;
  if (count > 0) return;

  const seq: Record<string, number> = {};
  const code = (prefix: string) => {
    seq[prefix] = (seq[prefix] ?? 0) + 1;
    return `${prefix}-${String(seq[prefix]).padStart(6, '0')}`;
  };

  const [unit] = await db
    .insert(schema.units)
    .values({
      code: code('DV'),
      name: 'Công ty TNHH ATG',
      taxCode: '0109999999',
      address: 'Hà Nội',
      phone: '024 0000 0000',
      email: 'lienhe@atg.vn',
    })
    .returning();

  const branchRows = await db
    .insert(schema.branches)
    .values([
      {code: code('CN'), name: 'ATG Hà Nội', unitId: unit.id, address: 'Cầu Giấy, Hà Nội', managerName: 'Nguyễn Văn An'},
      {code: code('CN'), name: 'ATG Hồ Chí Minh', unitId: unit.id, address: 'Quận 10, TP.HCM', managerName: 'Trần Thị Bình'},
    ])
    .returning();
  const [hn, hcm] = branchRows;

  // ---------------------------------------------------------------- roles & permissions
  const roleRows = await db
    .insert(schema.roles)
    .values([
      {code: code('NQ'), name: 'Quản trị', description: 'Toàn quyền hệ thống', isAdmin: true},
      {code: code('NQ'), name: 'Kế toán', description: 'Duyệt khách hàng, NCC, giá; xem công nợ, thu chi'},
      {code: code('NQ'), name: 'Kho', description: 'Kho hàng, sản phẩm, xuất nhập, kiểm kê'},
      {code: code('NQ'), name: 'Bán hàng', description: 'Khách hàng, phiếu xuất; chỉ được đề xuất sửa'},
      {code: code('NQ'), name: 'Hành chính nhân sự', description: 'Nhân viên, phòng ban, lương; duyệt hồ sơ nhân viên'},
    ])
    .returning();
  const [rAdmin, rAccount, rStock, rSales, rHr] = roleRows;

  const features = allFeatures();
  const full = {canView: true, canCreate: true, canEdit: true, canDelete: true, canPropose: true, canApprove: true};
  const viewOnly = {canView: true, canCreate: false, canEdit: false, canDelete: false, canPropose: false, canApprove: false};
  const staff = {canView: true, canCreate: true, canEdit: false, canDelete: false, canPropose: true, canApprove: false};
  const editor = {canView: true, canCreate: true, canEdit: true, canDelete: false, canPropose: true, canApprove: false};
  const perms: (typeof schema.rolePermissions.$inferInsert)[] = [];
  const grant = (roleId: number, match: (f: string) => boolean, p: typeof full) => {
    for (const f of features) if (match(f.feature)) perms.push({roleId, feature: f.feature, ...p});
  };
  const everyoneView = (f: string) => f.startsWith('san-pham/') || f === 'canh-bao/thong-bao' || f === 'canh-bao/duyet-de-xuat';
  const onboarding = (f: string) => f === 'doi-tuong/khai-bao-nhan-vien';

  // Kế toán
  grant(rAccount.id, f => /^(doi-tuong|bang-gia|thu-chi|khoan-vay|bao-cao|xuat-nhap|nhap-khau)\//.test(f), full);
  grant(rAccount.id, f => everyoneView(f) || onboarding(f), editor);
  // Kho
  grant(rStock.id, f => /^(san-pham|xuat-nhap|kiem-ke|tem-nhan|van-chuyen|chi-nhanh)\//.test(f), editor);
  grant(rStock.id, f => f === 'doi-tuong/nha-cung-cap' || f === 'canh-bao/duyet-de-xuat' || f === 'canh-bao/thong-bao' || onboarding(f), staff);
  grant(rStock.id, f => f === 'doi-tuong/khach-hang', viewOnly);
  // Bán hàng
  grant(rSales.id, f => f === 'doi-tuong/khach-hang' || f.startsWith('xuat-nhap/phieu-xuat') || f === 'bang-gia/de-xuat-gia' || onboarding(f), staff);
  grant(rSales.id, f => everyoneView(f) || f === 'doi-tuong/loai-kh' || f === 'bang-gia/gia-ban', viewOnly);
  // HR
  grant(rHr.id, f => /^(doi-tuong\/(phong-ban|nhan-vien|khai-bao-nhan-vien)|luong\/|tai-san\/)/.test(f), full);
  grant(rHr.id, f => everyoneView(f), viewOnly);
  // dedupe (first grant wins)
  const seen = new Set<string>();
  const uniquePerms = perms.filter(p => {
    const k = `${p.roleId}:${p.feature}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  await db.insert(schema.rolePermissions).values(uniquePerms);

  // ---------------------------------------------------------------- people
  const depRows = await db
    .insert(schema.departments)
    .values([
      {code: code('PB'), name: 'Ban giám đốc', branchId: hn.id, managerName: 'Nguyễn Văn An'},
      {code: code('PB'), name: 'Kế toán', branchId: hn.id, managerName: 'Lê Thu Hà'},
      {code: code('PB'), name: 'Kho vận', branchId: hn.id, managerName: 'Phạm Quốc Huy'},
      {code: code('PB'), name: 'Kinh doanh', branchId: hn.id, managerName: 'Đỗ Minh Tuấn'},
      {code: code('PB'), name: 'Hành chính nhân sự', branchId: hn.id, managerName: 'Vũ Thị Lan'},
    ])
    .returning();
  const [dBod, dAcc, dStock, dSales, dHr] = depRows;

  const empRows = await db
    .insert(schema.employees)
    .values([
      {code: code('NV'), fullName: 'Nguyễn Văn An', departmentId: dBod.id, branchId: hn.id, position: 'Giám đốc', phone: '0901000001'},
      {code: code('NV'), fullName: 'Lê Thu Hà', departmentId: dAcc.id, branchId: hn.id, position: 'Kế toán trưởng', phone: '0901000002'},
      {code: code('NV'), fullName: 'Phạm Quốc Huy', departmentId: dStock.id, branchId: hn.id, position: 'Thủ kho', phone: '0901000003'},
      {code: code('NV'), fullName: 'Đỗ Minh Tuấn', departmentId: dSales.id, branchId: hn.id, position: 'Nhân viên kinh doanh', phone: '0901000004'},
      {code: code('NV'), fullName: 'Vũ Thị Lan', departmentId: dHr.id, branchId: hn.id, position: 'Trưởng phòng HCNS', phone: '0901000005'},
      {code: code('NV'), fullName: 'Trần Thị Bình', departmentId: dSales.id, branchId: hcm.id, position: 'Quản lý chi nhánh', phone: '0901000006'},
    ])
    .returning();

  const hash123 = await bcrypt.hash('123456', 10);
  await db.insert(schema.users).values([
    {code: code('TK'), username: 'admin', passwordHash: await bcrypt.hash('admin123', 10), fullName: 'Quản trị hệ thống', roleId: rAdmin.id, branchId: hn.id, allBranches: true, employeeId: empRows[0].id},
    {code: code('TK'), username: 'ketoan', passwordHash: hash123, fullName: 'Lê Thu Hà', roleId: rAccount.id, branchId: hn.id, allBranches: true, employeeId: empRows[1].id},
    {code: code('TK'), username: 'kho', passwordHash: hash123, fullName: 'Phạm Quốc Huy', roleId: rStock.id, branchId: hn.id, employeeId: empRows[2].id},
    {code: code('TK'), username: 'banhang', passwordHash: hash123, fullName: 'Đỗ Minh Tuấn', roleId: rSales.id, branchId: hn.id, employeeId: empRows[3].id},
    {code: code('TK'), username: 'hr', passwordHash: hash123, fullName: 'Vũ Thị Lan', roleId: rHr.id, branchId: hn.id, employeeId: empRows[4].id},
  ]);

  const [stForeign, stDomestic, stBoth] = await db
    .insert(schema.supplierTypes)
    .values([
      {code: code('LNCC'), name: 'NCC nước ngoài', scope: 'foreign', description: 'Nhập khẩu, chủ yếu Trung Quốc'},
      {code: code('LNCC'), name: 'NCC trong nước', scope: 'domestic'},
      {code: code('LNCC'), name: 'Vừa là NCC vừa là khách hàng', scope: 'both'},
    ])
    .returning();

  const supRows = await db
    .insert(schema.suppliers)
    .values([
      {code: code('NCC'), name: 'Shenzhen PowerCell Co.', typeId: stForeign.id, country: 'Trung Quốc', contactName: 'Mr. Li', phone: '+86 755 0000 001', currency: 'CNY'},
      {code: code('NCC'), name: 'Guangzhou LapParts Ltd.', typeId: stForeign.id, country: 'Trung Quốc', contactName: 'Ms. Wang', phone: '+86 20 0000 002', currency: 'CNY'},
      {code: code('NCC'), name: 'Dongguan Adapter Factory', typeId: stForeign.id, country: 'Trung Quốc', currency: 'USD'},
      {code: code('NCC'), name: 'Công ty Linh kiện Minh Phát', typeId: stDomestic.id, country: 'Việt Nam', phone: '0281234567', currency: 'VND'},
      {code: code('NCC'), name: 'Laptop Parts Sài Gòn', typeId: stBoth.id, country: 'Việt Nam', phone: '0287654321', currency: 'VND'},
    ])
    .returning();

  const [ctNew, ctOld, ctAgent] = await db
    .insert(schema.customerTypes)
    .values([
      {code: code('LKH'), name: 'Khách mới', allowDebt: false, debtDays: 0, description: 'Thu tiền ngay'},
      {code: code('LKH'), name: 'Khách quen', allowDebt: true, debtDays: 30, description: 'Được bán công nợ 30 ngày'},
      {code: code('LKH'), name: 'Đại lý', allowDebt: true, debtDays: 45},
    ])
    .returning();

  await db.insert(schema.customers).values([
    {code: code('KH'), name: 'Cửa hàng Laptop Hoàng Gia', typeId: ctOld.id, phone: '0912000001', address: 'Thái Hà, Hà Nội', branchId: hn.id, debtLimit: 50000000},
    {code: code('KH'), name: 'Sửa chữa máy tính Đức Anh', typeId: ctAgent.id, phone: '0912000002', address: 'Xã Đàn, Hà Nội', branchId: hn.id, debtLimit: 100000000},
    {code: code('KH'), name: 'Anh Tuấn (khách lẻ)', typeId: ctNew.id, phone: '0912000003', branchId: hn.id},
    {code: code('KH'), name: 'Laptop 88 Chi nhánh 3', typeId: ctOld.id, phone: '0912000004', address: 'Quận 3, TP.HCM', branchId: hcm.id, debtLimit: 80000000},
    {code: code('KH'), name: 'Phong Vũ Tech Service', typeId: ctAgent.id, phone: '0912000005', address: 'Quận 10, TP.HCM', branchId: hcm.id, debtLimit: 150000000},
  ]);

  await db.insert(schema.shippingCarriers).values([
    {code: code('DVVC'), name: 'Viettel Post', phone: '1900 8095', price1: 45000, price2: 25000, price3: 0, price4: 120000},
    {code: code('DVVC'), name: 'Giao hàng tiết kiệm', phone: '1900 6092', price1: 40000, price2: 22000, price3: 0, price4: 100000},
    {code: code('DVVC'), name: 'Vận chuyển TQ - VN Hải Phát', phone: '0988 000 111', price1: 0, price2: 0, price3: 35000, price4: 2500000},
  ]);

  await db.insert(schema.warehouses).values([
    {code: code('KHO'), name: 'Kho tổng Hà Nội', branchId: hn.id, address: 'Cầu Giấy, Hà Nội', keeperName: 'Phạm Quốc Huy'},
    {code: code('KHO'), name: 'Kho bảo hành Hà Nội', branchId: hn.id, address: 'Cầu Giấy, Hà Nội'},
    {code: code('KHO'), name: 'Kho Hồ Chí Minh', branchId: hcm.id, address: 'Quận 10, TP.HCM'},
  ]);

  // ---------------------------------------------------------------- products
  const [ptNormal, ptTax] = await db
    .insert(schema.productTypes)
    .values([
      {code: code('LSP'), name: 'Hàng thường', isTax: false},
      {code: code('LSP'), name: 'Sản phẩm thuế', isTax: true, description: 'Có hóa đơn VAT, hiện ở bản quản lý thuế'},
      {code: code('LSP'), name: 'Hàng linh kiện tháo máy', isTax: false},
    ])
    .returning();

  const [gBattery, gCharger, gKeyboard] = await db
    .insert(schema.productGroups)
    .values([
      {code: code('NSP'), name: 'Pin laptop', supplierIds: [supRows[0].id, supRows[1].id, supRows[3].id]},
      {code: code('NSP'), name: 'Sạc laptop', supplierIds: [supRows[2].id, supRows[3].id]},
      {code: code('NSP'), name: 'Bàn phím laptop', supplierIds: [supRows[1].id, supRows[4].id]},
    ])
    .returning();
  const [gBatDell, gBatHp, gBatMac] = await db
    .insert(schema.productGroups)
    .values([
      {code: code('NSP'), name: 'Pin Dell', parentId: gBattery.id, supplierIds: [supRows[0].id, supRows[3].id]},
      {code: code('NSP'), name: 'Pin HP', parentId: gBattery.id, supplierIds: [supRows[0].id, supRows[1].id]},
      {code: code('NSP'), name: 'Pin Macbook', parentId: gBattery.id, supplierIds: [supRows[1].id]},
    ])
    .returning();

  const p = (name: string, groupId: number, models: string, warranty: number, typeId = ptNormal.id, unit = 'Cái') => ({
    code: code('SP'),
    name,
    groupId,
    typeId,
    compatibleModels: models,
    warrantyMonths: warranty,
    unit,
  });
  await db.insert(schema.products).values([
    p('Pin Dell Precision 5550 - 69KF2 86Wh zin', gBatDell.id, 'Precision 5550, XPS 15 9500', 12),
    p('Pin Dell Latitude 5490 - 68Wh', gBatDell.id, 'Latitude 5480, 5490, 5590', 12, ptTax.id),
    p('Pin Dell Inspiron 5567 - M5Y1K', gBatDell.id, 'Inspiron 5567, 5565, 3467', 6),
    p('Pin HP 13-AQ SO04XL zin', gBatHp.id, 'Spectre x360 13-AQ', 12),
    p('Pin HP ProBook 450 G7 - HT03XL', gBatHp.id, 'ProBook 440/450 G7', 6, ptTax.id),
    p('Pin Macbook A1417 Retina 15 (2012-2013)', gBatMac.id, 'A1398 2012, 2013', 12),
    p('Pin Macbook Air A1466 - A1496', gBatMac.id, 'A1466 2013-2017', 12, ptTax.id),
    p('Sạc Dell 65W đầu kim nhỏ', gCharger.id, 'Dell Inspiron, Vostro', 6),
    p('Sạc HP 90W đầu xanh', gCharger.id, 'HP ProBook, EliteBook', 6),
    p('Sạc Macbook USB-C 61W', gCharger.id, 'Macbook Pro 13 2016+', 12, ptTax.id),
    p('Bàn phím Dell Latitude 5490 có đèn', gKeyboard.id, 'Latitude 5490, 5491', 3),
    p('Bàn phím HP 840 G5', gKeyboard.id, 'EliteBook 840 G5, G6', 3),
  ]);

  await db.insert(schema.printTemplates).values([
    {code: code('MI'), name: 'Phiếu xuất bán A5', documentType: 'phieu-xuat', paperSize: 'A5', footerNote: 'Quý khách kiểm tra hàng trước khi nhận. Hàng đã xuất không đổi trả sau 7 ngày.'},
    {code: code('MI'), name: 'Phiếu nhập kho A4', documentType: 'phieu-nhap', paperSize: 'A4'},
    {code: code('MI'), name: 'Biên bản bàn giao tài sản', documentType: 'ban-giao', paperSize: 'A4'},
  ]);

  await db.insert(schema.settings).values([
    {key: 'fifo', value: true},
    {key: 'allowNegativeStock', value: false},
    {key: 'manageSerial', value: true},
    {key: 'manageLot', value: false},
    {key: 'currency', value: 'VND'},
    {key: 'vatRate', value: 10},
    {key: 'workDaysPerMonth', value: 26},
    {key: 'debtCollectionRate', value: 70},
  ]);

  // keep generated codes in step with the sequence table
  await db
    .insert(schema.codeSequences)
    .values(Object.entries(seq).map(([prefix, value]) => ({prefix, value})));
}
