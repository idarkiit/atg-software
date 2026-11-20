import 'server-only';
import {and, desc, eq, inArray} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {can, type CurrentUser} from '@/lib/auth';
import {RESOURCE_DEFS} from '@/lib/resources/definitions';
import {col, nextCode, notifyApprovers, resolveResource, writeAudit} from './resources';

export type ProposalView = {
  id: number;
  code: string;
  kind: 'proposal' | 'draft';
  resource: string;
  resourceTitle: string;
  recordId: number | null;
  recordCode: string | null;
  recordLabel: string | null;
  action: string;
  changes: {field: string; label: string; before: string; after: string}[];
  reason: string | null;
  status: string;
  requestedByName: string | null;
  requestedById: number | null;
  createdAt: string;
  canApprove: boolean;
};

function display(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/** Pending proposals plus draft records the user can approve or created. */
export async function listPending(user: CurrentUser): Promise<ProposalView[]> {
  const db = await getDb();
  const users = await db.select({id: schema.users.id, name: schema.users.fullName}).from(schema.users);
  const userName = new Map(users.map(u => [u.id, u.name]));

  const proposals = await db
    .select()
    .from(schema.proposals)
    .orderBy(desc(schema.proposals.createdAt))
    .limit(300);

  const out: ProposalView[] = [];
  for (const p of proposals) {
    const approver = can(user, p.resource, 'approve');
    if (!approver && p.requestedBy !== user.id) continue;
    const def = RESOURCE_DEFS.find(d => d.key === p.resource);
    let recordCode: string | null = null;
    let recordLabel: string | null = null;
    if (p.recordId && def) {
      const {table} = resolveResource(p.resource);
      const [r] = await db
        .select({code: col(table, 'code'), label: col(table, def.labelField)})
        .from(table)
        .where(eq(col(table, 'id'), p.recordId));
      recordCode = (r?.code as string) ?? null;
      recordLabel = (r?.label as string) ?? null;
    }
    const changes = Object.entries(p.payload)
      .filter(([k]) => !k.startsWith('__'))
      .map(([k, after]) => ({
        field: k,
        label: def?.fields.find(f => f.name === k)?.label ?? (k === 'passwordHash' ? 'Mật khẩu' : k),
        before: display(p.before?.[k]),
        after: k === 'passwordHash' ? '***' : display(after),
      }));
    out.push({
      id: p.id,
      code: p.code,
      kind: 'proposal',
      resource: p.resource,
      resourceTitle: def?.title ?? p.resource,
      recordId: p.recordId,
      recordCode,
      recordLabel: recordLabel ?? (p.payload[def?.labelField ?? 'name'] as string) ?? null,
      action: p.action,
      changes,
      reason: p.reason,
      status: p.status,
      requestedByName: p.requestedBy ? (userName.get(p.requestedBy) ?? null) : null,
      requestedById: p.requestedBy ?? null,
      createdAt: p.createdAt.toISOString(),
      canApprove: approver && p.status === 'pending',
    });
  }

  // Draft records ("lưu nháp") waiting to become official.
  for (const def of RESOURCE_DEFS.filter(d => d.editMode === 'draft')) {
    const approver = can(user, def.key, 'approve');
    const {table} = resolveResource(def.key);
    const rows = await db
      .select()
      .from(table)
      .where(eq(col(table, 'recordStatus'), 'draft'))
      .limit(200);
    for (const raw of rows as Record<string, unknown>[]) {
      if (!approver && raw.createdBy !== user.id) continue;
      out.push({
        id: raw.id as number,
        code: raw.code as string,
        kind: 'draft',
        resource: def.key,
        resourceTitle: def.title,
        recordId: raw.id as number,
        recordCode: raw.code as string,
        recordLabel: (raw[def.labelField] as string) ?? null,
        action: 'publish',
        changes: def.fields
          .filter(f => f.type !== 'image' && raw[f.name] != null && raw[f.name] !== '')
          .slice(0, 8)
          .map(f => ({field: f.name, label: f.label, before: '', after: display(raw[f.name])})),
        reason: null,
        status: 'pending',
        requestedByName: raw.createdBy ? (userName.get(raw.createdBy as number) ?? null) : null,
        requestedById: (raw.createdBy as number) ?? null,
        createdAt: (raw.createdAt as Date).toISOString(),
        canApprove: approver,
      });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countPendingForUser(user: CurrentUser) {
  const items = await listPending(user);
  return items.filter(i => i.status === 'pending' && i.canApprove).length;
}

export async function reviewProposal(
  user: CurrentUser,
  kind: 'proposal' | 'draft',
  resource: string,
  id: number,
  approve: boolean,
  note?: string,
): Promise<{ok: boolean; message: string}> {
  if (!can(user, resource, 'approve')) return {ok: false, message: 'Bạn không có quyền duyệt chức năng này.'};
  const db = await getDb();
  const {def, table} = resolveResource(resource);

  if (kind === 'draft') {
    if (approve) {
      await db
        .update(table)
        .set({recordStatus: 'official', updatedAt: new Date()} as never)
        .where(eq(col(table, 'id'), id));
    } else {
      await db.delete(table).where(and(eq(col(table, 'id'), id), eq(col(table, 'recordStatus'), 'draft')));
    }
    await writeAudit(db, user.id, approve ? 'approve' : 'reject', resource, id);
    return {ok: true, message: approve ? 'Đã duyệt thành hồ sơ chính thức.' : 'Đã từ chối và xóa bản nháp.'};
  }

  const [p] = await db.select().from(schema.proposals).where(eq(schema.proposals.id, id));
  if (!p || p.status !== 'pending') return {ok: false, message: 'Đề xuất đã được xử lý.'};

  let recordId = p.recordId;
  if (approve) {
    const payload = Object.fromEntries(Object.entries(p.payload).filter(([k]) => !k.startsWith('__')));
    if (p.action === 'create') {
      const code = await nextCode(db, def.codePrefix);
      const [row] = await db
        .insert(table)
        .values({...payload, code, createdBy: p.requestedBy, recordStatus: 'official'} as never)
        .returning({id: col(table, 'id')});
      recordId = row.id as number;
    } else if (p.recordId) {
      await db
        .update(table)
        .set({...payload, updatedAt: new Date()} as never)
        .where(eq(col(table, 'id'), p.recordId));
    }
  }
  await db
    .update(schema.proposals)
    .set({
      status: approve ? 'approved' : 'rejected',
      reviewedBy: user.id,
      reviewedAt: new Date(),
      reviewNote: note ?? null,
      recordId,
    })
    .where(eq(schema.proposals.id, id));
  if (p.requestedBy) {
    await db.insert(schema.notifications).values({
      userId: p.requestedBy,
      feature: resource,
      title: `${def.title}: đề xuất ${p.code} ${approve ? 'đã được duyệt' : 'bị từ chối'}`,
      body: note ?? null,
      link: '/canh-bao/duyet-de-xuat',
    });
  }
  await writeAudit(db, user.id, approve ? 'approve' : 'reject', resource, recordId, {proposal: p.code});
  return {ok: true, message: approve ? `Đã duyệt ${p.code}.` : `Đã từ chối ${p.code}.`};
}

/** Self-service onboarding form: creates a pending "create employee" proposal. */
export async function submitOnboarding(user: CurrentUser, values: Record<string, unknown>) {
  const db = await getDb();
  const code = await nextCode(db, 'DX');
  await db.insert(schema.proposals).values({
    code,
    resource: 'doi-tuong/nhan-vien',
    action: 'create',
    payload: values,
    requestedBy: user.id,
    branchId: user.branchId,
    reason: 'Nhân viên mới tự khai báo hồ sơ',
  });
  await notifyApprovers(
    db,
    'doi-tuong/nhan-vien',
    'Hồ sơ nhân viên mới chờ duyệt',
    `${values.fullName ?? user.fullName} vừa khai báo hồ sơ.`,
    '/canh-bao/duyet-de-xuat',
    user.id,
  );
  return code;
}

export async function markNotificationsRead(user: CurrentUser, ids?: number[]) {
  const db = await getDb();
  await db
    .update(schema.notifications)
    .set({isRead: true})
    .where(
      ids?.length
        ? and(eq(schema.notifications.userId, user.id), inArray(schema.notifications.id, ids))
        : eq(schema.notifications.userId, user.id),
    );
}
