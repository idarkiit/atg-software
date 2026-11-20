'use client';

import {useState} from 'react';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Selector} from '@astryxdesign/core/Selector';
import {MultiSelector} from '@astryxdesign/core/MultiSelector';
import {Switch} from '@astryxdesign/core/Switch';
import {FileInput} from '@astryxdesign/core/FileInput';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {VStack} from '@astryxdesign/core/Stack';
import type {FieldDef, RefOptions} from '@/lib/resources/types';

type Props = {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  refOptions: RefOptions;
  error?: string;
  isRequiredOverride?: boolean;
};

type ISODate = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

const statusOf = (error?: string) => (error ? {type: 'error' as const, message: error} : undefined);

export function FieldInput({field, value, onChange, refOptions, error, isRequiredOverride}: Props) {
  const isRequired = isRequiredOverride ?? !!field.required;
  const common = {
    label: field.label,
    description: field.description,
    isRequired,
    status: statusOf(error),
  };
  switch (field.type) {
    case 'textarea':
      return (
        <TextArea
          {...common}
          value={(value as string) ?? ''}
          onChange={v => onChange(v)}
          placeholder={field.placeholder}
        />
      );
    case 'number':
    case 'money':
      return (
        <NumberInput
          {...common}
          value={value === null || value === undefined || value === '' ? null : Number(value)}
          onChange={v => onChange(v)}
          step={field.type === 'money' ? 1000 : 1}
          min={0}
          hasClear
          placeholder={field.type === 'money' ? 'VNĐ' : undefined}
        />
      );
    case 'date':
      return (
        <DateInput
          {...common}
          value={((value as string) || undefined) as ISODate | undefined}
          onChange={v => onChange(v ?? null)}
          format="system_date"
          hasClear
        />
      );
    case 'bool':
      return (
        <Switch
          label={field.label}
          description={field.description}
          value={!!value}
          onChange={v => onChange(v)}
        />
      );
    case 'select':
      return (
        <Selector
          {...common}
          options={field.options ?? []}
          value={value ? String(value) : null}
          onChange={(v: string | null) => onChange(v)}
          placeholder={`Chọn ${field.label.toLowerCase()}`}
          hasClear
        />
      );
    case 'ref':
      return (
        <Selector
          {...common}
          options={refOptions[field.ref!] ?? []}
          value={value !== null && value !== undefined && value !== '' ? String(value) : null}
          onChange={(v: string | null) => onChange(v)}
          placeholder={`Chọn ${field.label.toLowerCase()}`}
          hasSearch
          hasClear
        />
      );
    case 'multiref':
      return (
        <MultiSelector
          label={field.label}
          description={field.description}
          isRequired={isRequired}
          options={refOptions[field.ref!] ?? []}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={v => onChange(v)}
          placeholder={`Chọn ${field.label.toLowerCase()}`}
          triggerDisplay="badges"
          hasSearch
        />
      );
    case 'image':
      return <ImageField {...common} value={value as string | null} onChange={onChange} />;
    case 'password':
      return (
        <TextInput
          {...common}
          type="password"
          value={(value as string) ?? ''}
          onChange={v => onChange(v)}
          placeholder="Tối thiểu 6 ký tự"
        />
      );
    default:
      return (
        <TextInput
          {...common}
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
          value={(value as string) ?? ''}
          onChange={v => onChange(v)}
          placeholder={field.placeholder}
        />
      );
  }
}

/**
 * Picks an image and stores it as a compressed data URL (max 1024px JPEG).
 * Good enough for the review build; production switches to Vercel Blob.
 */
function ImageField({
  label,
  description,
  isRequired,
  status,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  isRequired: boolean;
  status?: {type: 'error'; message: string};
  value: string | null;
  onChange: (v: unknown) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  return (
    <VStack gap={2}>
      <FileInput
        label={label}
        description={description ?? 'Ảnh JPG/PNG, tự thu nhỏ khi lưu'}
        isRequired={isRequired}
        accept="image/*"
        value={file}
        isLoading={isLoading}
        status={status}
        onChange={async f => {
          const picked = Array.isArray(f) ? f[0] : f;
          setFile(picked ?? null);
          if (!picked) return;
          setIsLoading(true);
          try {
            onChange(await toDataUrl(picked));
          } finally {
            setIsLoading(false);
          }
        }}
      />
      {value && (
        <Thumbnail
          src={value}
          alt={label}
          onRemove={() => {
            setFile(null);
            onChange(null);
          }}
        />
      )}
    </VStack>
  );
}

async function toDataUrl(file: File, maxSize = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
