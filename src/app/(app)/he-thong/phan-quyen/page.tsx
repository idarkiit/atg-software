import {asc} from 'drizzle-orm';
import {getDb, schema} from '@/db';
import {can, requireUser} from '@/lib/auth';
import {allFeatures} from '@/lib/features';
import {getResourceDef} from '@/lib/resources/definitions';
import {PageState} from '@/components/PageState';
import {PermissionMatrix, type MatrixFeature} from './PermissionMatrix';

export default async function PermissionPage() {
  const user = await requireUser();
  if (!can(user, 'he-thong/phan-quyen', 'view')) {
    return <PageState title="Bạn chưa được cấp quyền" description='Liên hệ quản trị để được cấp quyền xem "Phân quyền".' />;
  }
  const db = await getDb();
  const [roles, perms] = await Promise.all([
    db.select().from(schema.roles).orderBy(asc(schema.roles.id)),
    db.select().from(schema.rolePermissions),
  ]);

  const features: MatrixFeature[] = allFeatures().map(f => {
    const def = getResourceDef(f.feature);
    return {
      key: f.feature,
      title: f.title,
      moduleKey: f.module.key,
      moduleTitle: f.module.title,
      canApprove: !!f.approvable || (!!def && def.editMode !== 'direct'),
    };
  });

  return (
    <PermissionMatrix
      roles={roles.map(r => ({id: r.id, name: r.name, isAdmin: r.isAdmin}))}
      features={features}
      permissions={perms}
      canEdit={can(user, 'he-thong/phan-quyen', 'edit')}
    />
  );
}
