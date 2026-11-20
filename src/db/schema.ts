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
} from 'drizzle-orm/pg-core';

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

