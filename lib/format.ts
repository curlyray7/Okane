const eurFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eur0Fmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const eur = (n: number) => eurFmt.format(round2(n));
export const eur0 = (n: number) => eur0Fmt.format(Math.round(Number(n) || 0));

/** Accepte « 12,50 », « 12.5 », « 1 200 ». Renvoie null si invalide. */
export function parseAmount(value: string): number | null {
  const cleaned = String(value).replace(/[\s\u00a0\u202f€]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

export const monthKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const isoDate = (d: Date = new Date()) =>
  `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;

function parseKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return { y, m };
}

export function addMonths(key: string, n: number) {
  const { y, m } = parseKey(key);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function monthsBetween(from: string, to: string) {
  const a = parseKey(from);
  const b = parseKey(to);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function daysInMonth(key: string) {
  const { y, m } = parseKey(key);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(key: string) {
  const { y, m } = parseKey(key);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
}

export function monthShort(key: string) {
  const { y, m } = parseKey(key);
  return new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(new Date(y, m - 1, 1))
    .replace(".", "");
}

export function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, d),
  );
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
