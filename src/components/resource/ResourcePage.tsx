'use client';

// List page scaffolded from the Astryx "table" template (Layout header + Table),
// with the collapsible filter bar ATG asked for and a form dialog from "DialogFormDialog".
import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Grid} from '@astryxdesign/core/Grid';
import {Pagination} from '@astryxdesign/core/Pagination';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Token} from '@astryxdesign/core/Token';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {useToast} from '@astryxdesign/core/Toast';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {PlusIcon, FunnelIcon} from '@heroicons/react/24/outline';
import type {FieldDef, RecordRow, RefOptions, ResourceDef} from '@/lib/resources/types';
import {deleteRecordAction} from '@/server/actions';
import {RecordFormDialog} from './RecordFormDialog';
import {formatValue} from './format';

export type ResourcePerms = {
  create: boolean;
  edit: boolean;
  delete: boolean;
  propose: boolean;
  approve: boolean;
};

type Props = {
  def: ResourceDef;
  rows: RecordRow[];
  refOptions: RefOptions;
  perms: ResourcePerms;
  currentUserId: number;
};

const PAGE_SIZE = 20;

export function ResourcePage({def, rows, refOptions, perms, currentUserId}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<RecordRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);

  const filterFields = def.fields.filter(f => f.filterable && (f.type === 'ref' || f.type === 'select' || f.type === 'bool' || f.type === 'text'));
  const tableFields = def.fields.filter(f => f.inTable && f.type !== 'password');
  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (activeFilter !== 'all' ? 1 : 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(row => {
      if (activeFilter === 'active' && row.isActive === false) return false;
      if (activeFilter === 'inactive' && row.isActive !== false) return false;
      if (activeFilter === 'draft' && row.recordStatus !== 'draft') return false;
      for (const [name, v] of Object.entries(filters)) {
        if (!v) continue;
        const field = def.fields.find(f => f.name === name)!;
        const cell = row[name];
        if (field.type === 'bool' ? String(!!cell) !== v : field.type === 'text' ? !String(cell ?? '').toLowerCase().includes(v.toLowerCase()) : String(cell ?? '') !== v) {
          return false;
        }
      }
      if (!q) return true;
      return [row.code, ...def.fields.map(f => formatValue(f, row[f.name], refOptions))]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, filters, activeFilter, def.fields, refOptions]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: TableColumn<RecordRow>[] = [
    {
      key: 'code',
      header: def.codeLabel ?? 'Mã',
      width: pixel(130),
      renderCell: row => (
        <Text type="body" weight="semibold">
          {row.code}
        </Text>
      ),
    },
    ...tableFields.map(
      (f: FieldDef): TableColumn<RecordRow> => ({
        key: f.name,
        header: f.label,
        width: f.type === 'image' ? pixel(88) : f.wide ? proportional(2, {minWidth: 180}) : proportional(1, {minWidth: 110}),
        align: f.type === 'money' || f.type === 'number' ? 'end' : 'start',
        renderCell: row => <Cell field={f} value={row[f.name]} refOptions={refOptions} />,
      }),
    ),
    {
      key: '__status',
      header: 'Trạng thái',
      width: pixel(150),
      renderCell: row =>
        row.recordStatus === 'draft' ? (
          <HStack gap={1} vAlign="center">
            <StatusDot variant="warning" label="Nháp" />
            <Text type="body" size="sm">Nháp chờ duyệt</Text>
          </HStack>
        ) : row.isActive === false ? (
          <HStack gap={1} vAlign="center">
            <StatusDot variant="neutral" label="Ngừng" />
            <Text type="body" size="sm">Ngừng hoạt động</Text>
          </HStack>
        ) : (
          <HStack gap={1} vAlign="center">
            <StatusDot variant="success" label="Hoạt động" />
            <Text type="body" size="sm">Đang hoạt động</Text>
          </HStack>
        ),
    },
    {
      key: '__actions',
      header: '',
      width: pixel(56),
      renderCell: row => (
        <MoreMenu
          size="sm"
          label={`Thao tác với ${row.code}`}
          alignment="end"
          items={[
            {label: editLabel(def, perms, row, currentUserId), onClick: () => setEditing(row)},
            ...(perms.delete
              ? [{type: 'divider' as const}, {label: 'Xóa', variant: 'destructive' as const, onClick: () => setDeleting(row)}]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={3}>
            <HStack vAlign="center" hAlign="between" gap={3}>
              <VStack gap={1}>
                <Heading level={2}>{def.title}</Heading>
                {def.description && (
                  <Text type="body" color="secondary" size="sm">
                    {def.description}
                  </Text>
                )}
              </VStack>
              {perms.create && (
                <Button
                  label={`Thêm ${def.noun}`}
                  variant="primary"
                  icon={<Icon icon={PlusIcon} />}
                  onClick={() => setEditing('new')}
                />
              )}
            </HStack>
            <HStack gap={2} vAlign="end">
              <TextInput
                label="Tìm kiếm"
                isLabelHidden
                type="search"
                value={query}
                onChange={v => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder={`Tìm theo mã, tên, điện thoại…`}
                hasClear
              />
            </HStack>
            <Collapsible
              defaultIsOpen={false}
              chevronPosition="start"
              trigger={
                <HStack gap={1} vAlign="center">
                  <Icon icon={FunnelIcon} size="sm" />
                  <Text type="body" size="sm" weight="semibold">
                    {activeFilterCount ? `Bộ lọc (${activeFilterCount} đang áp dụng)` : 'Bộ lọc'}
                  </Text>
                </HStack>
              }>
              <Grid columns={{minWidth: 200}} gap={3}>
                <Selector
                  label="Trạng thái"
                  options={[
                    {value: 'all', label: 'Tất cả'},
                    {value: 'active', label: 'Đang hoạt động'},
                    {value: 'inactive', label: 'Ngừng hoạt động'},
                    ...(def.editMode === 'draft' ? [{value: 'draft', label: 'Nháp chờ duyệt'}] : []),
                  ]}
                  value={activeFilter}
                  onChange={(v: string) => {
                    setActiveFilter(v || 'all');
                    setPage(1);
                  }}
                />
                {filterFields.map(f =>
                  f.type === 'text' ? (
                    <TextInput
                      key={f.name}
                      label={f.label}
                      value={filters[f.name] ?? ''}
                      onChange={v => {
                        setFilters(prev => ({...prev, [f.name]: v}));
                        setPage(1);
                      }}
                      hasClear
                    />
                  ) : (
                    <Selector
                      key={f.name}
                      label={f.label}
                      options={
                        f.type === 'bool'
                          ? [
                              {value: 'true', label: 'Có'},
                              {value: 'false', label: 'Không'},
                            ]
                          : f.type === 'select'
                            ? (f.options ?? [])
                            : (refOptions[f.ref!] ?? [])
                      }
                      value={filters[f.name] || null}
                      placeholder="Tất cả"
                      hasSearch={f.type === 'ref'}
                      hasClear
                      onChange={v => {
                        setFilters(prev => ({...prev, [f.name]: v ?? ''}));
                        setPage(1);
                      }}
                    />
                  ),
                )}
                {activeFilterCount > 0 && (
                  <Button
                    label="Xóa bộ lọc"
                    variant="ghost"
                    onClick={() => {
                      setFilters({});
                      setActiveFilter('all');
                    }}
                  />
                )}
              </Grid>
            </Collapsible>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            <Table<RecordRow>
              data={pageRows}
              columns={columns}
              idKey="id"
              hasHover
              density="compact"
              textOverflow="truncate"
            />
            <HStack hAlign="between" vAlign="center">
              <Text type="body" color="secondary" size="sm">
                {filtered.length} bản ghi
              </Text>
              {pageCount > 1 && (
                <Pagination page={currentPage} totalPages={pageCount} onChange={setPage} />
              )}
            </HStack>
          </VStack>
          {editing && (
            <RecordFormDialog
              def={def}
              record={editing === 'new' ? null : editing}
              refOptions={refOptions}
              perms={perms}
              currentUserId={currentUserId}
              onClose={() => setEditing(null)}
              onSaved={message => {
                setEditing(null);
                toast({body: message});
                router.refresh();
              }}
            />
          )}
          <AlertDialog
            isOpen={!!deleting}
            onOpenChange={open => !open && setDeleting(null)}
            title={`Xóa ${deleting?.code ?? ''}?`}
            description="Không thể hoàn tác. Nếu bản ghi đã dùng ở chứng từ khác, hãy tắt Đang hoạt động thay vì xóa."
            actionLabel="Xóa"
            cancelLabel="Hủy"
            actionVariant="destructive"
            onAction={async () => {
              if (!deleting) return;
              const result = await deleteRecordAction(def.key, deleting.id);
              setDeleting(null);
              toast({body: result.message, type: result.ok ? 'info' : 'error'});
              if (result.ok) router.refresh();
            }}
          />
        </LayoutContent>
      }
    />
  );
}

function editLabel(def: ResourceDef, perms: ResourcePerms, row: RecordRow, userId: number) {
  if (def.editMode === 'direct') return perms.edit ? 'Sửa' : 'Xem';
  if (perms.approve) return row.recordStatus === 'draft' ? 'Xem và duyệt' : 'Sửa';
  if (def.editMode === 'draft' && row.recordStatus === 'draft' && row.createdBy === userId) return 'Sửa bản nháp';
  return perms.propose || perms.create ? 'Đề xuất sửa' : 'Xem';
}

function Cell({field, value, refOptions}: {field: FieldDef; value: unknown; refOptions: RefOptions}) {
  if (field.type === 'image') {
    return value ? <Thumbnail src={String(value)} alt={field.label} /> : <Text type="body" color="secondary">—</Text>;
  }
  if (field.type === 'bool') {
    return value ? <Token label="Có" /> : <Text type="body" color="secondary">Không</Text>;
  }
  return <Text type="body">{formatValue(field, value, refOptions)}</Text>;
}
