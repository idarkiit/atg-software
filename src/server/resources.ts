import 'server-only';
import {and, desc, eq, inArray, or, sql, getTableColumns} from 'drizzle-orm';
import type {PgColumn, PgTable} from 'drizzle-orm/pg-core';
import bcrypt from 'bcryptjs';
import {getDb, schema, type DB} from '@/db';
import {can, type CurrentUser} from '@/lib/auth';
import {getResourceDef} from '@/lib/resources/definitions';
import type {FieldDef, RecordRow, RefOptions, ResourceDef} from '@/lib/resources/types';
import {RESOURCE_TABLES} from './registry';

export function resolveResource(key: string): {def: ResourceDef; table: PgTable} {
  const def = getResourceDef(key);
  const table = RESOURCE_TABLES[key];
  if (!def || !table) throw new Error(`Không tìm thấy danh mục ${key}`);
  return {def, table};
}

export function col(table: PgTable, name: string): PgColumn {
  const c = getTableColumns(table)[name];
  if (!c) throw new Error(`Bảng không có cột ${name}`);
  return c as PgColumn;
}

function hasCol(table: PgTable, name: string) {
  return name in getTableColumns(table);
}

/** Next business code for a prefix, e.g. KH-000012. Atomic across requests. */
export async function nextCode(db: DB, prefix: string) {
  const result = await db.execute(
    sql`insert into code_sequences (prefix, value) values (${prefix}, 1)
        on conflict (prefix) do update set value = code_sequences.value + 1
        returning value`,
  );
  const rows = (result as unknown as {rows: {value: number}[]}).rows;
  return `${prefix}-${String(rows[0].value).padStart(6, '0')}`;
}

// ------------------------------------------------------------------ reading

export async function listRecords(key: string, user: CurrentUser): Promise<RecordRow[]> {
  const {def, table} = resolveResource(key);
  const db = await getDb();
  const conditions = [];
  if (def.branchScoped && user.branchId && hasCol(table, 'branchId')) {
    conditions.push(eq(col(table, 'branchId'), user.branchId));
  }
  // Drafts are only visible to their creator and to approvers.
  if (def.editMode === 'draft' && hasCol(table, 'recordStatus') && !can(user, key, 'approve')) {
    conditions.push(
      or(eq(col(table, 'recordStatus'), 'official'), eq(col(table, 'createdBy'), user.id)),
    );
  }
  const rows = await db
    .select()
    .from(table)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(col(table, 'id')))
    .limit(5000);
  return rows.map(r => sanitizeRow(def, r as Record<string, unknown>));
}

export async function getRecord(key: string, id: number) {
  const {def, table} = resolveResource(key);
  const db = await getDb();
  const [row] = await db.select().from(table).where(eq(col(table, 'id'), id));
  return row ? sanitizeRow(def, row as Record<string, unknown>) : null;
}

/** Strip secrets and make values serializable for client components. */
function sanitizeRow(def: ResourceDef, row: Record<string, unknown>): RecordRow {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'passwordHash') continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as RecordRow;
}

/** Options for every ref/multiref field of a resource: {resourceKey: [{value,label}]}. */
export async function loadRefOptions(def: ResourceDef): Promise<RefOptions> {
  const db = await getDb();
  const refKeys = [...new Set(def.fields.filter(f => f.ref).map(f => f.ref!))];
  const out: RefOptions = {};
  for (const refKey of refKeys) {
    const {def: refDef, table} = resolveResource(refKey);
    const labelCol = col(table, refDef.labelField);
    const rows = await db
      .select({id: col(table, 'id'), code: col(table, 'code'), label: labelCol})
      .from(table)
      .where(eq(col(table, 'isActive'), true))
      .orderBy(labelCol);
    out[refKey] = rows.map(r => ({
      value: String(r.id),
      label: String(r.label ?? r.code),
      description: String(r.code),
    }));
  }
  return out;
}

// ------------------------------------------------------------------ writing

export type SaveInput = {
  id?: number | null;
  values: Record<string, unknown>;
  isActive?: boolean;
  /** draft: keep as draft (lưu nháp). */
  asDraft?: boolean;
};

export type SaveResult =
  | {ok: true; id: number; code: string; proposed?: boolean; message: string}
  | {ok: false; message: string; fieldErrors?: Record<string, string>};

/** Validate and convert raw form values to column values. */
export async function coerceValues(def: ResourceDef, raw: Record<string, unknown>, isCreate: boolean) {
  const values: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.hideInForm) continue;
    const v = raw[f.name];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (f.type === 'password') {
      if (empty) {
        if (isCreate) fieldErrors[f.name] = 'Bắt buộc nhập mật khẩu';
        continue;
      }
      if (String(v).length < 6) {
        fieldErrors[f.name] = 'Mật khẩu tối thiểu 6 ký tự';
        continue;
      }
      values.passwordHash = await bcrypt.hash(String(v), 10);
      continue;
    }
    if (empty) {
      if (f.required) fieldErrors[f.name] = `Vui lòng nhập ${f.label.toLowerCase()}`;
      values[f.name] = f.type === 'bool' ? false : f.type === 'multiref' ? [] : null;
      continue;
    }
    values[f.name] = coerceOne(f, v);
    if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) {
      fieldErrors[f.name] = 'Email không hợp lệ';
    }
  }
  return {values, fieldErrors};
}

function coerceOne(f: FieldDef, v: unknown): unknown {
  switch (f.type) {
    case 'number':
    case 'money': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    case 'ref':
      return Number(v);
    case 'multiref':
      return (Array.isArray(v) ? v : [v]).map(Number).filter(Number.isFinite);
    case 'bool':
      return v === true || v === 'true';
    default:
      return String(v).trim();
  }
}

export async function writeAudit(
  db: DB,
  userId: number,
  action: string,
  resource: string,
  recordId: number | null,
  detail?: unknown,
) {
  await db.insert(schema.auditLogs).values({userId, action, resource, recordId, detail: detail ?? null});
}

/** Notify everyone who can approve a feature (admins included). */
export async function notifyApprovers(
  db: DB,
  feature: string,
  title: string,
  body: string,
  link: string,
  excludeUserId?: number,
) {
  const approverRoles = await db
    .select({id: schema.roles.id})
    .from(schema.roles)
    .leftJoin(
      schema.rolePermissions,
      and(
        eq(schema.rolePermissions.roleId, schema.roles.id),
        eq(schema.rolePermissions.feature, feature),
      ),
    )
    .where(or(eq(schema.roles.isAdmin, true), eq(schema.rolePermissions.canApprove, true)));
  const roleIds = [...new Set(approverRoles.map(r => r.id))];
  if (!roleIds.length) return;
  const approvers = await db
    .select({id: schema.users.id})
    .from(schema.users)
    .where(and(inArray(schema.users.roleId, roleIds), eq(schema.users.isActive, true)));
  const rows = approvers
    .filter(u => u.id !== excludeUserId)
    .map(u => ({userId: u.id, feature, title, body, link}));
  if (rows.length) await db.insert(schema.notifications).values(rows);
}

export async function saveRecord(key: string, user: CurrentUser, input: SaveInput): Promise<SaveResult> {
  const {def, table} = resolveResource(key);
  const db = await getDb();
  const isCreate = !input.id;
  const isApprover = can(user, key, 'approve');

  if (isCreate && !can(user, key, 'create')) {
    return {ok: false, message: 'Bạn không có quyền thêm mới ở chức năng này.'};
  }

  const {values, fieldErrors} = await coerceValues(def, input.values, isCreate);
  if (Object.keys(fieldErrors).length) {
    return {ok: false, message: 'Vui lòng kiểm tra các trường được đánh dấu.', fieldErrors};
  }
  if (input.isActive !== undefined) values.isActive = input.isActive;

  if (isCreate) {
    if (def.branchScoped && hasCol(table, 'branchId') && values.branchId == null && user.branchId) {
      values.branchId = user.branchId;
    }
    const staffDraft = def.editMode === 'draft' && (!isApprover || input.asDraft);
    if (hasCol(table, 'recordStatus')) values.recordStatus = staffDraft ? 'draft' : 'official';
    const code = await nextCode(db, def.codePrefix);
    try {
      const [row] = await db
        .insert(table)
        .values({...values, code, createdBy: user.id} as never)
        .returning({id: col(table, 'id')});
      const id = row.id as number;
      await writeAudit(db, user.id, 'create', key, id);
      if (staffDraft && !isApprover) {
        await notifyApprovers(
          db,
          key,
          `${def.title}: có hồ sơ nháp chờ duyệt`,
          `${user.fullName} vừa lưu nháp ${def.noun} ${code}.`,
          `/${key}`,
          user.id,
        );
      }
      return {
        ok: true,
        id,
        code,
        message: staffDraft ? `Đã lưu nháp ${code}, chờ duyệt.` : `Đã thêm ${def.noun} ${code}.`,
      };
    } catch (err) {
      return {ok: false, message: friendlyDbError(err)};
    }
  }

  // ----- update
  const id = input.id!;
  const [current] = await db.select().from(table).where(eq(col(table, 'id'), id));
  if (!current) return {ok: false, message: 'Bản ghi không còn tồn tại.'};
  const currentRow = current as Record<string, unknown>;

  const mustPropose = def.editMode !== 'direct' && !isApprover;
  const canDirect = can(user, key, 'edit') && !mustPropose;
  // A staff member may still edit their own draft directly.
  const ownDraft =
    def.editMode === 'draft' && currentRow.recordStatus === 'draft' && currentRow.createdBy === user.id;

  if (!canDirect && !ownDraft) {
    if (!can(user, key, 'propose') && !can(user, key, 'create')) {
      return {ok: false, message: 'Bạn không có quyền sửa hoặc đề xuất sửa.'};
    }
    // Create a proposal with only the changed fields.
    const changed: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (JSON.stringify(currentRow[k] ?? null) !== JSON.stringify(v ?? null)) {
        changed[k] = v;
        before[k] = k === 'passwordHash' ? '***' : (currentRow[k] ?? null);
      }
    }
    if (!Object.keys(changed).length) {
      return {ok: false, message: 'Bạn chưa thay đổi thông tin nào.'};
    }
    const code = await nextCode(db, 'DX');
    await db.insert(schema.proposals).values({
      code,
      resource: key,
      recordId: id,
      action: 'update',
      payload: changed,
      before,
      requestedBy: user.id,
      branchId: user.branchId,
      reason: typeof input.values.__reason === 'string' ? input.values.__reason : null,
    });
    await notifyApprovers(
      db,
      key,
      `${def.title}: đề xuất sửa ${currentRow.code}`,
      `${user.fullName} đề xuất sửa ${def.noun} ${currentRow.code}.`,
      '/canh-bao/duyet-de-xuat',
      user.id,
    );
    await writeAudit(db, user.id, 'propose', key, id, changed);
    return {
      ok: true,
      id,
      code: String(currentRow.code),
      proposed: true,
      message: `Đã gửi đề xuất ${code}. Thông tin sẽ cập nhật sau khi được duyệt.`,
    };
  }

  if (def.editMode === 'draft' && hasCol(table, 'recordStatus')) {
    values.recordStatus = isApprover && !input.asDraft ? 'official' : 'draft';
  }
  try {
    await db
      .update(table)
      .set({...values, updatedAt: new Date()} as never)
      .where(eq(col(table, 'id'), id));
    await writeAudit(db, user.id, 'update', key, id);
    return {ok: true, id, code: String(currentRow.code), message: `Đã lưu ${currentRow.code}.`};
  } catch (err) {
    return {ok: false, message: friendlyDbError(err)};
  }
}

export async function deleteRecord(key: string, user: CurrentUser, id: number): Promise<SaveResult> {
  const {table} = resolveResource(key);
  if (!can(user, key, 'delete')) return {ok: false, message: 'Bạn không có quyền xóa.'};
  const db = await getDb();
  try {
    const [row] = await db
      .delete(table)
      .where(eq(col(table, 'id'), id))
      .returning({code: col(table, 'code')});
    await writeAudit(db, user.id, 'delete', key, id);
    return {ok: true, id, code: String(row?.code ?? ''), message: `Đã xóa ${row?.code ?? ''}.`};
  } catch (err) {
    const msg = friendlyDbError(err);
    return {
      ok: false,
      message: msg.includes('đang được dùng')
        ? msg
        : `Không xóa được: ${msg}. Bạn có thể tắt "Đang hoạt động" thay vì xóa.`,
    };
  }
}

export function friendlyDbError(err: unknown): string {
  const e = err as {code?: string; cause?: {code?: string}; message?: string};
  const code = e.code ?? e.cause?.code;
  if (code === '23505') return 'Giá trị này đã tồn tại (trùng mã hoặc tên đăng nhập).';
  if (code === '23503') return 'Bản ghi đang được dùng ở chức năng khác nên không xóa được. Hãy tắt "Đang hoạt động".';
  return e.message ?? 'Lỗi không xác định';
}
