import 'server-only';
import {cache} from 'react';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {eq} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {SESSION_COOKIE, verifySession} from './session';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'propose' | 'approve';

export type PermissionSet = Record<string, Partial<Record<PermissionAction, boolean>>>;

export type CurrentUser = {
  id: number;
  username: string;
  fullName: string;
  roleId: number | null;
  roleName: string | null;
  isAdmin: boolean;
  /** Branch the user is working in (switchable for multi-branch users). */
  branchId: number | null;
  homeBranchId: number | null;
  allBranches: boolean;
  permissions: PermissionSet;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const db = await getDb();
  const [row] = await db
    .select({user: schema.users, role: schema.roles})
    .from(schema.users)
    .leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .where(eq(schema.users.id, session.uid));
  if (!row || !row.user.isActive) return null;

  const permissions: PermissionSet = {};
  if (row.user.roleId) {
    const perms = await db
      .select()
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.roleId, row.user.roleId));
    for (const p of perms) {
      permissions[p.feature] = {
        view: p.canView,
        create: p.canCreate,
        edit: p.canEdit,
        delete: p.canDelete,
        propose: p.canPropose,
        approve: p.canApprove,
      };
    }
  }
  const isAdmin = !!row.role?.isAdmin;
  const canSwitch = isAdmin || row.user.allBranches;
  return {
    id: row.user.id,
    username: row.user.username,
    fullName: row.user.fullName,
    roleId: row.user.roleId,
    roleName: row.role?.name ?? null,
    isAdmin,
    branchId: canSwitch && session.bid ? session.bid : row.user.branchId,
    homeBranchId: row.user.branchId,
    allBranches: canSwitch,
    permissions,
  };
});

export function can(user: CurrentUser, feature: string, action: PermissionAction = 'view') {
  if (user.isAdmin) return true;
  return !!user.permissions[feature]?.[action];
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/dang-nhap');
  return user;
}

export async function requirePermission(feature: string, action: PermissionAction = 'view') {
  const user = await requireUser();
  if (!can(user, feature, action)) {
    throw new PermissionError(feature, action);
  }
  return user;
}

export class PermissionError extends Error {
  constructor(feature: string, action: string) {
    super(`Bạn không có quyền "${action}" ở chức năng ${feature}.`);
  }
}
