const number = new Intl.NumberFormat('vi-VN');
const dateTime = new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'short'});

/** VND with vi-VN grouping: 1.250.000 đ */
export function vnd(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${number.format(value)} đ`;
}

export function formatNumber(value: number) {
  return number.format(value);
}

export function formatDateTime(iso: string | null) {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

/** Price cell: a product without a price shows 0 đ. */
export function percent(value: number) {
  return `${new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value)}%`;
}
