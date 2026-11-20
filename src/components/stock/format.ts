const nf = new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 3});

/** Vietnamese money: 1.234.567 đ */
export function fmtMoney(n: number | null | undefined): string {
  return `${nf.format(Math.round(Number(n) || 0))} đ`;
}

export function fmtQty(n: number | null | undefined): string {
  return nf.format(Number(n) || 0);
}

/** ISO date (yyyy-mm-dd) -> dd/mm/yyyy */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN');
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Same shape as Astryx's ISODateString (DateInput value). */
export type ISODate = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;
