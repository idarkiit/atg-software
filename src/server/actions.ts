'use server';

import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {and, eq} from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {getDb, schema} from '@/db';
import {can, requireUser} from '@/lib/auth';
import {SESSION_COOKIE, sessionCookieOptions, signSession} from '@/lib/session';
import {deleteRecord, saveRecord, writeAudit, type SaveInput, type SaveResult} from './resources';
import {markNotificationsRead, reviewProposal, submitOnboarding} from './proposals';

// ------------------------------------------------------------------ auth

export async function loginAction(username: string, password: string): Promise<{ok: false; message: string} | void> {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username.trim().toLowerCase()));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return {ok: false, message: 'Sai tên đăng nhập hoặc mật khẩu.'};
  }
  if (!user.isActive) return {ok: false, message: 'Tài khoản đang bị khóa. Liên hệ quản trị.'};
  await db.update(schema.users).set({lastLoginAt: new Date()}).where(eq(schema.users.id, user.id));
  await writeAudit(db, user.id, 'login', 'he-thong/tai-khoan', user.id);
  const token = await signSession({uid: user.id, bid: user.branchId});
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect('/');
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/dang-nhap');
}

export async function switchBranchAction(branchId: number) {
  const user = await requireUser();
  if (!user.allBranches) return;
  const token = await signSession({uid: user.id, bid: branchId});
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  revalidatePath('/', 'layout');
}

export async function changePasswordAction(current: string, next: string) {
  const user = await requireUser();
  const db = await getDb();
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
    return {ok: false, message: 'Mật khẩu hiện tại không đúng.'};
  }
  if (next.length < 6) return {ok: false, message: 'Mật khẩu mới tối thiểu 6 ký tự.'};
  await db
    .update(schema.users)
    .set({passwordHash: await bcrypt.hash(next, 10)})
    .where(eq(schema.users.id, user.id));
  return {ok: true, message: 'Đã đổi mật khẩu.'};
}

// ------------------------------------------------------------------ catalogs

export async function saveRecordAction(resource: string, input: SaveInput): Promise<SaveResult> {
  const user = await requireUser();
  const result = await saveRecord(resource, user, input);
  if (result.ok) revalidatePath(`/${resource}`);
  return result;
}

export async function deleteRecordAction(resource: string, id: number): Promise<SaveResult> {
  const user = await requireUser();
  const result = await deleteRecord(resource, user, id);
  if (result.ok) revalidatePath(`/${resource}`);
  return result;
}

// ------------------------------------------------------------------ approvals & notifications

export async function reviewAction(
  kind: 'proposal' | 'draft',
  resource: string,
  id: number,
  approve: boolean,
  note?: string,
) {
  const user = await requireUser();
  const result = await reviewProposal(user, kind, resource, id, approve, note);
  revalidatePath('/', 'layout');
  return result;
}

export async function onboardingAction(values: Record<string, unknown>) {
  const user = await requireUser();
  if (!values.fullName || !values.phone || !values.idNumber) {
    return {ok: false, message: 'Vui lòng nhập họ tên, điện thoại và số CCCD.'};
  }
  const code = await submitOnboarding(user, values);
  revalidatePath('/', 'layout');
  return {ok: true, message: `Đã gửi hồ sơ (${code}). HR sẽ kiểm tra và duyệt.`};
}

export async function markReadAction(ids?: number[]) {
  const user = await requireUser();
  await markNotificationsRead(user, ids);
  revalidatePath('/', 'layout');
}

export async function deleteNotificationAction(id: number) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .delete(schema.notifications)
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)));
  revalidatePath('/', 'layout');
}

// ------------------------------------------------------------------ permissions, toggles, settings

export type PermissionRow = {
  feature: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPropose: boolean;
  canApprove: boolean;
};

export async function savePermissionsAction(roleId: number, rows: PermissionRow[]) {
  const user = await requireUser();
  if (!can(user, 'he-thong/phan-quyen', 'edit')) return {ok: false, message: 'Bạn không có quyền phân quyền.'};
  const db = await getDb();
  await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, roleId));
  const values = rows
    .filter(r => r.canView || r.canCreate || r.canEdit || r.canDelete || r.canPropose || r.canApprove)
    .map(r => ({...r, roleId}));
  if (values.length) await db.insert(schema.rolePermissions).values(values);
  await writeAudit(db, user.id, 'update', 'he-thong/phan-quyen', roleId);
  revalidatePath('/', 'layout');
  return {ok: true, message: 'Đã lưu phân quyền.'};
}

export async function saveTogglesAction(toggles: {feature: string; enabled: boolean}[]) {
  const user = await requireUser();
  if (!user.isAdmin) return {ok: false, message: 'Chỉ quản trị viên được bật/tắt chức năng.'};
  const db = await getDb();
  for (const t of toggles) {
    await db
      .insert(schema.featureToggles)
      .values({feature: t.feature, enabled: t.enabled})
      .onConflictDoUpdate({
        target: schema.featureToggles.feature,
        set: {enabled: t.enabled, updatedAt: new Date()},
      });
  }
  revalidatePath('/', 'layout');
  return {ok: true, message: 'Đã lưu bật/tắt chức năng.'};
}

export async function saveSettingsAction(values: Record<string, unknown>) {
  const user = await requireUser();
  if (!can(user, 'he-thong/cai-dat', 'edit')) return {ok: false, message: 'Bạn không có quyền sửa cài đặt.'};
  const db = await getDb();
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(schema.settings)
      .values({key, value})
      .onConflictDoUpdate({target: schema.settings.key, set: {value, updatedAt: new Date()}});
  }
  await writeAudit(db, user.id, 'update', 'he-thong/cai-dat', null, values);
  revalidatePath('/he-thong/cai-dat');
  return {ok: true, message: 'Đã lưu cài đặt.'};
}
