'use client';

// Form dialog from the Astryx "DialogFormDialog" block: header, scrolling fields, footer actions.
import {useState, useTransition} from 'react';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Grid, GridSpan} from '@astryxdesign/core/Grid';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Switch} from '@astryxdesign/core/Switch';
import {TextArea} from '@astryxdesign/core/TextArea';
import type {RecordRow, RefOptions, ResourceDef} from '@/lib/resources/types';
import {saveRecordAction} from '@/server/actions';
import {reviewAction} from '@/server/actions';
import {FieldInput} from './FieldInput';
import type {ResourcePerms} from './ResourcePage';

type Props = {
  def: ResourceDef;
  record: RecordRow | null;
  refOptions: RefOptions;
  perms: ResourcePerms;
  currentUserId: number;
  onClose: () => void;
  onSaved: (message: string) => void;
};

type Mode = 'create' | 'edit' | 'propose' | 'editDraft' | 'view';

function resolveMode(def: ResourceDef, record: RecordRow | null, perms: ResourcePerms, userId: number): Mode {
  if (!record) return 'create';
  if (def.editMode === 'direct') return perms.edit ? 'edit' : 'view';
  if (perms.approve) return 'edit';
  if (def.editMode === 'draft' && record.recordStatus === 'draft' && record.createdBy === userId) return 'editDraft';
  return perms.propose || perms.create ? 'propose' : 'view';
}

export function RecordFormDialog({def, record, refOptions, perms, currentUserId, onClose, onSaved}: Props) {
  const mode = resolveMode(def, record, perms, currentUserId);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of def.fields) {
      if (f.type === 'password') init[f.name] = '';
      else init[f.name] = record ? (record[f.name] ?? null) : (f.defaultValue ?? (f.type === 'bool' ? false : null));
    }
    return init;
  });
  const [isActive, setIsActive] = useState(record ? record.isActive !== false : true);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDraftRecord = record?.recordStatus === 'draft';
  const readOnly = mode === 'view';

  const submit = (asDraft = false) => {
    // Client-side required check mirrors the server (red asterisk fields).
    const missing: Record<string, string> = {};
    for (const f of def.fields) {
      if (!f.required || f.type === 'bool') continue;
      const v = values[f.name];
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) {
        missing[f.name] = `Vui lòng nhập ${f.label.toLowerCase()}`;
      }
    }
    if (!record && def.fields.some(f => f.type === 'password') && !values.password) {
      missing.password = 'Bắt buộc nhập mật khẩu';
    }
    setErrors(missing);
    if (Object.keys(missing).length) {
      setMessage('Vui lòng nhập đủ các trường bắt buộc.');
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await saveRecordAction(def.key, {
        id: record?.id ?? null,
        values: mode === 'propose' ? {...values, __reason: reason} : values,
        isActive,
        asDraft,
      });
      if (result.ok) onSaved(result.message);
      else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });
  };

  const approveDraft = (approve: boolean) =>
    startTransition(async () => {
      const result = await reviewAction('draft', def.key, record!.id, approve);
      if (result.ok) onSaved(result.message);
      else setMessage(result.message);
    });

  const title =
    mode === 'create'
      ? `Thêm ${def.noun}`
      : mode === 'propose'
        ? `Đề xuất sửa ${record!.code}`
        : mode === 'view'
          ? `${record!.code}`
          : `Sửa ${record!.code}`;

  const subtitle =
    mode === 'propose'
      ? 'Thay đổi sẽ được gửi cho người có quyền duyệt, chưa cập nhật ngay.'
      : mode === 'create' && def.editMode === 'draft' && !perms.approve
        ? 'Hồ sơ sẽ được lưu nháp và chờ người có quyền duyệt.'
        : 'Mã được phần mềm tự sinh. Trường có dấu * là bắt buộc.';

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="form" width={720}>
      <Layout
        header={<DialogHeader title={title} subtitle={subtitle} onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {message && <Banner status="error" title={message} container="card" collapsible={false} />}
              {isDraftRecord && (
                <Banner
                  status="warning"
                  title="Bản ghi đang ở dạng nháp"
                  description="Chưa phải hồ sơ chính thức cho đến khi được duyệt."
                  container="card"
                  collapsible={false}
                />
              )}
              <Grid columns={{minWidth: 260, max: 2}} gap={4}>
                {def.fields
                  .filter(f => !f.hideInForm)
                  .map(f => {
                    const input = (
                      <FieldInput
                        field={f}
                        value={values[f.name]}
                        refOptions={refOptions}
                        error={errors[f.name]}
                        isRequiredOverride={f.type === 'password' ? !record : undefined}
                        onChange={v => {
                          if (readOnly) return;
                          setValues(prev => ({...prev, [f.name]: v}));
                        }}
                      />
                    );
                    return f.wide || f.type === 'textarea' || f.type === 'image' ? (
                      <GridSpan key={f.name} columns="full">
                        {input}
                      </GridSpan>
                    ) : (
                      <VStack key={f.name}>{input}</VStack>
                    );
                  })}
                {record && mode !== 'propose' && mode !== 'view' && (
                  <GridSpan columns="full">
                    <Switch
                      label="Đang hoạt động"
                      description="Tắt để ngừng dùng mà vẫn giữ lịch sử."
                      value={isActive}
                      onChange={setIsActive}
                    />
                  </GridSpan>
                )}
                {mode === 'propose' && (
                  <GridSpan columns="full">
                    <TextArea
                      label="Lý do đề xuất"
                      value={reason}
                      onChange={setReason}
                      placeholder="VD: khách đổi số điện thoại"
                    />
                  </GridSpan>
                )}
              </Grid>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label={readOnly ? 'Đóng' : 'Hủy'} variant="secondary" onClick={onClose} />
              {isDraftRecord && perms.approve && (
                <>
                  <Button label="Từ chối nháp" variant="destructive" isLoading={isPending} onClick={() => approveDraft(false)} />
                  <Button label="Lưu và duyệt" variant="primary" isLoading={isPending} onClick={() => submit(false)} />
                </>
              )}
              {!isDraftRecord && mode === 'edit' && (
                <Button label="Lưu" variant="primary" isLoading={isPending} onClick={() => submit(false)} />
              )}
              {mode === 'create' && def.editMode === 'draft' && perms.approve && (
                <Button label="Lưu nháp" variant="secondary" isLoading={isPending} onClick={() => submit(true)} />
              )}
              {mode === 'create' && (
                <Button
                  label={def.editMode === 'draft' && !perms.approve ? 'Lưu nháp, gửi duyệt' : def.editMode === 'draft' ? 'Lưu cố định' : 'Lưu'}
                  variant="primary"
                  isLoading={isPending}
                  onClick={() => submit(false)}
                />
              )}
              {mode === 'editDraft' && (
                <Button label="Lưu nháp" variant="primary" isLoading={isPending} onClick={() => submit(true)} />
              )}
              {mode === 'propose' && (
                <Button label="Gửi đề xuất" variant="primary" isLoading={isPending} onClick={() => submit(false)} />
              )}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
