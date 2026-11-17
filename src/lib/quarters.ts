/** Bron Afon financial year runs April–March. Quarter maths lives here so it can be unit-tested. */
export interface Quarter { start: Date; end: Date; label: string; range: string; }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local-date ISO (yyyy-mm-dd) without the UTC shift that toISOString() introduces in BST. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function quarterStart(today: Date, offsetQuarters: number): Date {
  const m = Math.floor(today.getMonth() / 3) * 3 + offsetQuarters * 3;
  return new Date(today.getFullYear(), m, 1);
}

export function fiscalLabel(start: Date): string {
  const fy = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1;
  const qn = Math.floor(((start.getMonth() - 3 + 12) % 12) / 3) + 1;
  return `Q${qn} ${String(fy).slice(2)}/${String(fy + 1).slice(2)}`;
}

export function quarters(today: Date, offsetQuarters: number, count = 6): Quarter[] {
  const q0 = quarterStart(today, offsetQuarters);
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(q0.getFullYear(), q0.getMonth() + i * 3, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    return { start, end, label: fiscalLabel(start), range: `${MONTHS[start.getMonth()]}–${MONTHS[end.getMonth()]} ${String(end.getFullYear()).slice(2)}` };
  });
}

/** Inclusive overlap of a dated item with a quarter. Items without both dates never overlap. */
export function overlaps(item: { start_date: string | null; end_date: string | null }, q: Quarter): boolean {
  if (!item.start_date || !item.end_date) return false;
  return item.start_date <= isoDate(q.end) && item.end_date >= isoDate(q.start);
}

export function isCurrent(q: Quarter, today: Date): boolean {
  return today >= q.start && today <= q.end;
}

export function formatShort(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

export type Zoom = "months" | "quarters" | "years";
export const ZOOMS: { id: Zoom; label: string; hint: string }[] = [
  { id: "months", label: "Months", hint: "12 months, month by month" },
  { id: "quarters", label: "Quarters", hint: "18 months, quarter by quarter" },
  { id: "years", label: "3 years", hint: "12 quarters at a glance" },
];

/** Columns for the roadmap at a given zoom. Offset is in columns. */
export function periods(today: Date, offset: number, zoom: Zoom): Quarter[] {
  if (zoom === "months") {
    const m0 = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(m0.getFullYear(), m0.getMonth() + i, 1), end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { start, end, label: `${MONTHS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`, range: fiscalLabel(start) };
    });
  }
  return quarters(today, offset, zoom === "years" ? 12 : 6);
}
