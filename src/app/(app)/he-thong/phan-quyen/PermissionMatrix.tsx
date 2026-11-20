'use client';

import {useMemo, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';
import {Banner} from '@astryxdesign/core/Banner';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {useToast} from '@astryxdesign/core/Toast';
import {savePermissionsAction, type PermissionRow} from '@/server/actions';

export type MatrixFeature = {
  key: string;
  title: string;
  moduleKey: string;
  moduleTitle: string;
  canApprove: boolean;
};

type Props = {
  roles: {id: number; name: string; isAdmin: boolean}[];
  features: MatrixFeature[];
  permissions: (PermissionRow & {roleId: number})[];
  canEdit: boolean;
};

type Flag = 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canPropose' | 'canApprove';
type Flags = Record<Flag, boolean>;

const ACTIONS: {flag: Flag; label: string}[] = [
  {flag: 'canView', label: 'Xem'},
  {flag: 'canCreate', label: 'Thêm'},
  {flag: 'canEdit', label: 'Sửa'},
  {flag: 'canDelete', label: 'Xóa'},
  {flag: 'canPropose', label: 'Đề xuất'},
  {flag: 'canApprove', label: 'Duyệt'},
];

const EMPTY: Flags = {canView: false, canCreate: false, canEdit: false, canDelete: false, canPropose: false, canApprove: false};

type Row = {id: string; kind: 'module' | 'fn'; moduleKey: string; title: string; feature?: MatrixFeature};

function toFlags(p?: PermissionRow): Flags {
  return p
    ? {canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, canPropose: p.canPropose, canApprove: p.canApprove}
    : {...EMPTY};
}

export function PermissionMatrix({roles, features, permissions, canEdit}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [roleId, setRoleId] = useState<string>(String(roles[0]?.id ?? ''));
  // Local edits per role; roles not touched fall back to the server data.
  const [edits, setEdits] = useState<Record<number, Record<string, Flags>>>({});

  const role = roles.find(r => String(r.id) === roleId);
  const locked = !canEdit || !!role?.isAdmin;

  const current = useMemo(() => {
    const base: Record<string, Flags> = {};
    for (const p of permissions) if (p.roleId === Number(roleId)) base[p.feature] = toFlags(p);
    return {...base, ...(edits[Number(roleId)] ?? {})};
  }, [permissions, edits, roleId]);

  const flagsOf = (key: string): Flags => current[key] ?? EMPTY;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let last = '';
    for (const f of features) {
      if (f.moduleKey !== last) {
        out.push({id: `m:${f.moduleKey}`, kind: 'module', moduleKey: f.moduleKey, title: f.moduleTitle});
        last = f.moduleKey;
      }
      out.push({id: f.key, kind: 'fn', moduleKey: f.moduleKey, title: f.title, feature: f});
    }
    return out;
  }, [features]);

  const apply = (updates: Record<string, Flags>) => {
    setEdits(prev => ({...prev, [Number(roleId)]: {...(prev[Number(roleId)] ?? {}), ...updates}}));
  };

  const setFlag = (f: MatrixFeature, flag: Flag, value: boolean) => {
    const next = {...flagsOf(f.key), [flag]: value};
    if (value && flag !== 'canView') next.canView = true;
    if (!value && flag === 'canView') return apply({[f.key]: {...EMPTY}});
    apply({[f.key]: next});
  };

  const moduleFeatures = (moduleKey: string) => features.filter(f => f.moduleKey === moduleKey);

  const setModuleFlag = (moduleKey: string, flag: Flag, value: boolean) => {
    const updates: Record<string, Flags> = {};
    for (const f of moduleFeatures(moduleKey)) {
      if (flag === 'canApprove' && !f.canApprove) continue;
      const next = {...flagsOf(f.key), [flag]: value};
      if (value && flag !== 'canView') next.canView = true;
      updates[f.key] = !value && flag === 'canView' ? {...EMPTY} : next;
    }
    apply(updates);
  };

  const setModuleAll = (moduleKey: string, value: boolean) => {
    const updates: Record<string, Flags> = {};
    for (const f of moduleFeatures(moduleKey)) {
      updates[f.key] = value
        ? {canView: true, canCreate: true, canEdit: true, canDelete: true, canPropose: true, canApprove: f.canApprove}
        : {...EMPTY};
    }
    apply(updates);
  };

  const viewAll = () => {
    const updates: Record<string, Flags> = {};
    for (const f of features) updates[f.key] = {...flagsOf(f.key), canView: true};
    apply(updates);
  };

  const columnState = (moduleKey: string, flag: Flag): boolean | 'indeterminate' => {
    const list = moduleFeatures(moduleKey).filter(f => flag !== 'canApprove' || f.canApprove);
    if (!list.length) return false;
    const n = list.filter(f => flagsOf(f.key)[flag]).length;
    return n === 0 ? false : n === list.length ? true : 'indeterminate';
  };

  const columns: TableColumn<Row>[] = [
    {
      key: 'title',
      header: 'Chức năng',
      width: proportional(3, {minWidth: 220}),
      renderCell: row =>
        row.kind === 'module' ? (
          <HStack gap={2} vAlign="center">
            <Text type="body" weight="semibold">{row.title}</Text>
            {!locked && (
              <>
                <Button label="Chọn tất cả" variant="ghost" size="sm" onClick={() => setModuleAll(row.moduleKey, true)} />
                <Button label="Bỏ chọn" variant="ghost" size="sm" onClick={() => setModuleAll(row.moduleKey, false)} />
              </>
            )}
          </HStack>
        ) : (
          <Text type="body">{row.title}</Text>
        ),
    },
    ...ACTIONS.map(
      (a): TableColumn<Row> => ({
        key: a.flag,
        header: a.label,
        width: pixel(96),
        align: 'center',
        renderCell: row => {
          if (row.kind === 'module') {
            return (
              <CheckboxInput
                label={`${a.label} cả nhóm ${row.title}`}
                isLabelHidden
                size="sm"
                value={columnState(row.moduleKey, a.flag)}
                isDisabled={locked}
                onChange={v => setModuleFlag(row.moduleKey, a.flag, v)}
              />
            );
          }
          const f = row.feature!;
          if (a.flag === 'canApprove' && !f.canApprove) {
            return <Text type="body" color="secondary">—</Text>;
          }
          return (
            <CheckboxInput
              label={`${a.label} ${f.title}`}
              isLabelHidden
              size="sm"
              value={role?.isAdmin ? true : flagsOf(f.key)[a.flag]}
              isDisabled={locked}
              onChange={v => setFlag(f, a.flag, v)}
            />
          );
        },
      }),
    ),
  ];

  const save = () => {
    if (!role) return;
    const payload: PermissionRow[] = features.map(f => ({feature: f.key, ...flagsOf(f.key), canApprove: f.canApprove && flagsOf(f.key).canApprove}));
    startTransition(async () => {
      const res = await savePermissionsAction(role.id, payload);
      toast({body: res.message, type: res.ok ? 'info' : 'error'});
      if (res.ok) {
        setEdits(prev => {
          const {[role.id]: _drop, ...rest} = prev;
          void _drop;
          return rest;
        });
        router.refresh();
      }
    });
  };

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <HStack vAlign="center" hAlign="between" gap={3}>
              <VStack gap={1}>
                <Heading level={2}>Phân quyền</Heading>
                <Text type="body" color="secondary" size="sm">
                  Chọn nhóm quyền và tick các thao tác được phép trên từng chức năng.
                </Text>
              </VStack>
              <HStack gap={2}>
                <Button label="Cho xem tất cả" variant="secondary" isDisabled={locked} onClick={viewAll} />
                <Button
                  label="Lưu phân quyền"
                  variant="primary"
                  isDisabled={locked}
                  isLoading={isPending}
                  onClick={save}
                />
              </HStack>
            </HStack>
            <Selector
              label="Nhóm quyền"
              width={320}
              value={roleId}
              onChange={setRoleId}
              options={roles.map(r => ({value: String(r.id), label: r.name}))}
            />
            {role?.isAdmin && <Banner status="info" title="Nhóm này có toàn quyền" description="Quản trị viên luôn được truy cập mọi chức năng, không cần phân quyền." />}
            {!canEdit && <Banner status="warning" title="Bạn chỉ có quyền xem" description="Liên hệ quản trị để được cấp quyền sửa phân quyền." />}
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <Table<Row> data={rows} columns={columns} idKey="id" density="compact" />
        </LayoutContent>
      }
    />
  );
}
