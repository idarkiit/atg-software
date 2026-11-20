import type {FieldDef, RefOptions} from '@/lib/resources/types';

const money = new Intl.NumberFormat('vi-VN');

/** Plain-text display of a field value (tables, search, approvals). */
export function formatValue(field: FieldDef, value: unknown, refOptions: RefOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'money':
      return `${money.format(Number(value))} đ`;
    case 'number':
      return money.format(Number(value));
    case 'bool':
      return value ? 'Có' : 'Không';
    case 'date':
      return new Date(String(value)).toLocaleDateString('vi-VN');
    case 'select':
      return field.options?.find(o => o.value === String(value))?.label ?? String(value);
    case 'ref':
      return refOptions[field.ref!]?.find(o => o.value === String(value))?.label ?? `#${value}`;
    case 'multiref': {
      const ids = Array.isArray(value) ? value.map(String) : [];
      const opts = refOptions[field.ref!] ?? [];
      return ids.map(id => opts.find(o => o.value === id)?.label ?? `#${id}`).join(', ') || '—';
    }
    case 'image':
      return 'Ảnh';
    case 'password':
      return '••••••';
    default:
      return String(value);
  }
}
