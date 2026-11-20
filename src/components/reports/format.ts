const nf = new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 3});

/** Vietnamese money: 1.234.567 đ */
export function money(n: number | null | undefined): string {
  return `${nf.format(Math.round(Number(n) || 0))} đ`;
}

export function qty(n: number | null | undefined): string {
  return nf.format(Number(n) || 0);
}

/** yyyy-mm-dd -> dd/mm/yyyy */
export function dateVN(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function dateTimeVN(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'});
}

export function pct(n: number | null | undefined): string {
  return `${new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(Number(n) || 0)}%`;
}

/** Same shape as Astryx's ISODateString (DateInput value). */
export type ISODate = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;
