/**
 * Database schema for ATG software.
 *
 * Conventions every table follows:
 * - `id` serial primary key, `code` auto-generated business code (see lib/codes.ts).
 * - `isActive` soft on/off flag, `createdAt`/`updatedAt`/`createdBy`.
 * - Products hold only product information: prices live in pricing tables and
 *   stock is derived from the stock ledger (phase 2), never stored on products.
 */
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,
  primaryKey,
  unique,
  index,
} from 'drizzle-orm/pg-core';

/** Money in VND (no rounding issues up to 18 digits). */
const money = (name: string) => numeric(name, {precision: 18, scale: 2, mode: 'number'});

const audit = {
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
  createdBy: integer('created_by'),
};

/** Two-layer save: draft records are visible to their creator and reviewers only. */
const recordStatus = {
  recordStatus: text('record_status').notNull().default('official'), // draft | official
};

// ---------------------------------------------------------------- 1. Hệ thống

export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  taxCode: text('tax_code'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  logoUrl: text('logo_url'),
  ...audit,
});

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  unitId: integer('unit_id').references(() => units.id),
  address: text('address'),
  phone: text('phone'),
  managerName: text('manager_name'),
  ...audit,
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isAdmin: boolean('is_admin').notNull().default(false),
  ...audit,
});

/** One row per role × feature. A missing row means no access. */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, {onDelete: 'cascade'}),
    feature: text('feature').notNull(),
    canView: boolean('can_view').notNull().default(false),
    canCreate: boolean('can_create').notNull().default(false),
    canEdit: boolean('can_edit').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),
    canPropose: boolean('can_propose').notNull().default(false),
    canApprove: boolean('can_approve').notNull().default(false),
  },
  t => [primaryKey({columns: [t.roleId, t.feature]})],
);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  roleId: integer('role_id').references(() => roles.id),
  branchId: integer('branch_id').references(() => branches.id),
  employeeId: integer('employee_id'),
  /** Branches this user may switch to; empty = only their own branch. */
  allBranches: boolean('all_branches').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', {withTimezone: true}),
  ...audit,
});

/** On/off switch per module or function (admin only). */
export const featureToggles = pgTable('feature_toggles', {
  feature: text('feature').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value'),
  updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
});

export const codeSequences = pgTable('code_sequences', {
  prefix: text('prefix').primaryKey(),
  value: integer('value').notNull().default(0),
});

export const printTemplates = pgTable('print_templates', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  documentType: text('document_type').notNull(),
  paperSize: text('paper_size').notNull().default('A4'),
  headerNote: text('header_note'),
  footerNote: text('footer_note'),
  ...audit,
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: text('action').notNull(), // create | update | delete | approve | reject | login
  resource: text('resource').notNull(),
  recordId: integer('record_id'),
  detail: jsonb('detail'),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

// ---------------------------------------------------------------- 2. Đối tượng

export const supplierTypes = pgTable('supplier_types', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  scope: text('scope').notNull().default('domestic'), // foreign | domestic | both
  description: text('description'),
  ...audit,
});

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  typeId: integer('type_id')
    .notNull()
    .references(() => supplierTypes.id),
  country: text('country'),
  contactName: text('contact_name'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxCode: text('tax_code'),
  bankAccount: text('bank_account'),
  currency: text('currency').default('VND'),
  note: text('note'),
  ...recordStatus,
  ...audit,
});

export const customerTypes = pgTable('customer_types', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  allowDebt: boolean('allow_debt').notNull().default(false),
  debtDays: integer('debt_days').default(0),
  description: text('description'),
  ...audit,
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  typeId: integer('type_id')
    .notNull()
    .references(() => customerTypes.id),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxCode: text('tax_code'),
  branchId: integer('branch_id').references(() => branches.id),
  salesUserId: integer('sales_user_id'),
  debtLimit: numeric('debt_limit', {precision: 18, scale: 2, mode: 'number'}),
  note: text('note'),
  ...recordStatus,
  ...audit,
});

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  branchId: integer('branch_id').references(() => branches.id),
  managerName: text('manager_name'),
  description: text('description'),
  ...audit,
});

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  fullName: text('full_name').notNull(),
  departmentId: integer('department_id').references(() => departments.id),
  branchId: integer('branch_id').references(() => branches.id),
  position: text('position'),
  phone: text('phone'),
  email: text('email'),
  birthDate: date('birth_date'),
  idNumber: text('id_number'),
  idCardImageUrl: text('id_card_image_url'),
  address: text('address'),
  startDate: date('start_date'),
  bankAccount: text('bank_account'),
  ...recordStatus,
  ...audit,
});

export const shippingCarriers = pgTable('shipping_carriers', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  price1: numeric('price_1', {precision: 18, scale: 2, mode: 'number'}),
  price1Label: text('price_1_label').default('Chuyển nhanh'),
  price2: numeric('price_2', {precision: 18, scale: 2, mode: 'number'}),
  price2Label: text('price_2_label').default('Chuyển chậm'),
  price3: numeric('price_3', {precision: 18, scale: 2, mode: 'number'}),
  price3Label: text('price_3_label').default('Quốc tế'),
  price4: numeric('price_4', {precision: 18, scale: 2, mode: 'number'}),
  price4Label: text('price_4_label').default('Theo khối'),
  note: text('note'),
  ...audit,
});

// ---------------------------------------------------------------- 3. Sản phẩm

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  branchId: integer('branch_id')
    .notNull()
    .references(() => branches.id),
  address: text('address'),
  keeperName: text('keeper_name'),
  ...audit,
});

export const productGroups = pgTable('product_groups', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  parentId: integer('parent_id'),
  /** Suppliers that sell items in this group, used for supplier price comparison. */
  supplierIds: jsonb('supplier_ids').$type<number[]>().notNull().default([]),
  description: text('description'),
  ...audit,
});

export const productTypes = pgTable('product_types', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  /** Products of a tax type appear in the separate tax copy of the software. */
  isTax: boolean('is_tax').notNull().default(false),
  description: text('description'),
  ...audit,
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  typeId: integer('type_id')
    .notNull()
    .references(() => productTypes.id),
  groupId: integer('group_id').references(() => productGroups.id),
  compatibleModels: text('compatible_models'),
  specs: text('specs'),
  unit: text('unit').notNull().default('Cái'),
  warrantyMonths: integer('warranty_months').default(0),
  barcode: text('barcode'),
  usesRfid: boolean('uses_rfid').notNull().default(false),
  note: text('note'),
  ...audit,
});

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, {onDelete: 'cascade'}),
  url: text('url').notNull(),
  caption: text('caption'),
  ...audit,
});

export const supplierImages = pgTable('supplier_images', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id, {onDelete: 'cascade'}),
  url: text('url').notNull(),
  kind: text('kind').default('label'), // label | facility | document
  caption: text('caption'),
  ...audit,
});

// ---------------------------------------------------------------- Đề xuất / duyệt & thông báo

/**
 * Generic propose → approve record. `payload` holds the proposed field values;
 * `before` keeps the values at proposal time so reviewers see the diff.
 */
export const proposals = pgTable('proposals', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  resource: text('resource').notNull(),
  recordId: integer('record_id'),
  action: text('action').notNull().default('update'), // create | update
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  before: jsonb('before').$type<Record<string, unknown>>(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  requestedBy: integer('requested_by'),
  reviewedBy: integer('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', {withTimezone: true}),
  reviewNote: text('review_note'),
  branchId: integer('branch_id'),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  feature: text('feature').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

// ---------------------------------------------------------------- 4. Cảnh báo (ghi chú)

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  content: text('content'),
  productId: integer('product_id'),
  customerId: integer('customer_id'),
  supplierId: integer('supplier_id'),
  remindAt: date('remind_at'),
  ...audit,
});

export const defectiveProducts = pgTable('defective_products', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  defectType: text('defect_type').notNull(),
  detail: text('detail'),
  isWarning: boolean('is_warning').notNull().default(true),
  ...audit,
});


// ---------------------------------------------------------------- 6. Bảng giá

/** One row per product, created on demand. Changed only by approving a price proposal. */
export const salePrices = pgTable('sale_prices', {
  productId: integer('product_id')
    .primaryKey()
    .references(() => products.id, {onDelete: 'cascade'}),
  price1: money('price_1').notNull().default(0),
  price2: money('price_2').notNull().default(0),
  price3: money('price_3').notNull().default(0),
  updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
  updatedBy: integer('updated_by'),
});

/** Every change of the sale price table, for audit and "lịch sử thay đổi giá". */
export const salePriceHistory = pgTable('sale_price_history', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  price1: money('price_1').notNull(),
  price2: money('price_2').notNull(),
  price3: money('price_3').notNull(),
  proposalId: integer('proposal_id'),
  changedBy: integer('changed_by'),
  changedAt: timestamp('changed_at', {withTimezone: true}).notNull().defaultNow(),
});

export const supplierPrices = pgTable(
  'supplier_prices',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    price: money('price').notNull(),
    currency: text('currency').notNull().default('VND'),
    note: text('note'),
    ...audit,
  },
  t => [unique('supplier_prices_supplier_product').on(t.supplierId, t.productId)],
);

/** Average purchase price typed in by ATG (not computed), used to estimate margin. */
export const avgCosts = pgTable('avg_costs', {
  productId: integer('product_id')
    .primaryKey()
    .references(() => products.id, {onDelete: 'cascade'}),
  avgCost: money('avg_cost').notNull().default(0),
  extraCost: money('extra_cost').notNull().default(0), // chi phí (vận chuyển, thuế…) per unit
  note: text('note'),
  updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
  updatedBy: integer('updated_by'),
});

/** Staff propose new sale prices; a manager reviews them on "Tính lãi giá bán". */
export const priceProposals = pgTable('price_proposals', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  currentPrice1: money('current_price_1').notNull().default(0),
  currentPrice2: money('current_price_2').notNull().default(0),
  currentPrice3: money('current_price_3').notNull().default(0),
  proposedPrice1: money('proposed_price_1').notNull(),
  proposedPrice2: money('proposed_price_2'),
  proposedPrice3: money('proposed_price_3'),
  reason: text('reason'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  // filled by the reviewer on "Tính lãi giá bán"
  approvedPrice1: money('approved_price_1'),
  approvedPrice2: money('approved_price_2'),
  approvedPrice3: money('approved_price_3'),
  costBasis: money('cost_basis'),
  otherCost: money('other_cost'),
  requestedBy: integer('requested_by'),
  reviewedBy: integer('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', {withTimezone: true}),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

// ---------------------------------------------------------------- 9. Xuất nhập

/**
 * Loại xuất nhập. `kind` decides the business rules (see lib/stock/kinds.ts);
 * ATG can add several named types per kind (e.g. "Xuất bán lẻ", "Xuất bán sỉ").
 */
export const stockDocTypes = pgTable('stock_doc_types', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  description: text('description'),
  ...audit,
});

/**
 * Every warehouse voucher (phiếu). Posting a voucher writes stock_moves;
 * cancelling it removes them. Vouchers are never edited after posting.
 */
export const stockDocs = pgTable(
  'stock_docs',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    kind: text('kind').notNull(),
    typeId: integer('type_id').references(() => stockDocTypes.id),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    toWarehouseId: integer('to_warehouse_id').references(() => warehouses.id),
    customerId: integer('customer_id').references(() => customers.id),
    supplierId: integer('supplier_id').references(() => suppliers.id),
    employeeId: integer('employee_id').references(() => employees.id),
    refDocId: integer('ref_doc_id'),
    docDate: date('doc_date').notNull(),
    dueDate: date('due_date'),
    priceLevel: integer('price_level').notNull().default(1),
    isVat: boolean('is_vat').notNull().default(false),
    isTax: boolean('is_tax').notNull().default(false),
    invoiceNo: text('invoice_no'),
    vatRate: numeric('vat_rate', {precision: 5, scale: 2, mode: 'number'}).notNull().default(0),
    subtotal: money('subtotal').notNull().default(0),
    discountAmount: money('discount_amount').notNull().default(0),
    vatAmount: money('vat_amount').notNull().default(0),
    otherCost: money('other_cost').notNull().default(0),
    total: money('total').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    paymentMethod: text('payment_method'), // cash | bank
    costTotal: money('cost_total').notNull().default(0),
    status: text('status').notNull().default('posted'), // posted | cancelled
    reason: text('reason'),
    note: text('note'),
    cancelledAt: timestamp('cancelled_at', {withTimezone: true}),
    cancelledBy: integer('cancelled_by'),
    cancelReason: text('cancel_reason'),
    ...audit,
  },
  t => [index('stock_docs_kind_date').on(t.kind, t.docDate)],
);

export const stockDocLines = pgTable('stock_doc_lines', {
  id: serial('id').primaryKey(),
  docId: integer('doc_id')
    .notNull()
    .references(() => stockDocs.id, {onDelete: 'cascade'}),
  lineNo: integer('line_no').notNull().default(0),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  /** Chuyển đổi tồn only: out = mã bị trừ, in = mã được cộng. */
  lineDir: text('line_dir'),
  qty: numeric('qty', {precision: 14, scale: 3, mode: 'number'}).notNull(),
  unitPrice: money('unit_price').notNull().default(0),
  discount: money('discount').notNull().default(0), // tiền giảm trên cả dòng
  amount: money('amount').notNull().default(0),
  unitCost: money('unit_cost').notNull().default(0), // giá vốn tại thời điểm ghi sổ
  note: text('note'),
});

/** Stock ledger. On-hand = sum(qty) per product & warehouse. Value uses moving average cost. */
export const stockMoves = pgTable(
  'stock_moves',
  {
    id: serial('id').primaryKey(),
    docId: integer('doc_id')
      .notNull()
      .references(() => stockDocs.id, {onDelete: 'cascade'}),
    lineId: integer('line_id'),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    branchId: integer('branch_id').notNull(),
    qty: numeric('qty', {precision: 14, scale: 3, mode: 'number'}).notNull(), // + nhập, - xuất
    unitCost: money('unit_cost').notNull().default(0),
    moveDate: date('move_date').notNull(),
    isTax: boolean('is_tax').notNull().default(false),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => [index('stock_moves_product_wh').on(t.productId, t.warehouseId)],
);

/**
 * Money received from customers / paid to suppliers against debt.
 * Phase 5 (Thu chi) creates these from receipts; phase 2 records them on the debt screens.
 */
export const debtPayments = pgTable('debt_payments', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  partyType: text('party_type').notNull(), // customer | supplier
  customerId: integer('customer_id').references(() => customers.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  docId: integer('doc_id').references(() => stockDocs.id),
  branchId: integer('branch_id'),
  amount: money('amount').notNull(),
  payDate: date('pay_date').notNull(),
  method: text('method').notNull().default('cash'), // cash | bank
  note: text('note'),
  ...audit,
});
