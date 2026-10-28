import type { AppData } from "./types";
import { addMonths, daysInMonth, isoDate, monthLabel, ofMonth } from "./format";

/**
 * Période budgétaire : du jour de paie au veille de la paie suivante (26 oct → 25 nov).
 * Elle est rangée sous le mois où elle se termine (« 2026-11 »). Avec une paie le 1er, c’est le mois calendaire.
 */
export const paydayOf = (d: Pick<AppData, "payday">) => (d.payday && d.payday > 1 ? Math.min(31, Math.round(d.payday)) : 1);

/** Jour où commence la période dans le mois `key` (le 31 devient le dernier jour d’un mois plus court). */
const startDay = (key: string, payday: number) => Math.min(payday, daysInMonth(key));

/** Période d’une date YYYY-MM-DD. */
export function periodKeyOf(date: string, payday: number) {
  const key = date.slice(0, 7);
  if (payday <= 1) return key;
  return Number(date.slice(8, 10)) >= startDay(key, payday) ? addMonths(key, 1) : key;
}

export const currentPeriod = (payday: number) => periodKeyOf(isoDate(), payday);

const pad = (n: number) => String(n).padStart(2, "0");

/** Premier et dernier jour (YYYY-MM-DD) de la période `key`. */
export function periodRange(key: string, payday: number) {
  if (payday <= 1) return { start: `${key}-01`, end: `${key}-${pad(daysInMonth(key))}` };
  const prev = addMonths(key, -1);
  const start = `${prev}-${pad(startDay(prev, payday))}`;
  const endDay = startDay(key, payday) - 1;
  // Paie le 1er du mois suivant après un mois court : la période se termine la veille, dans `key`.
  const end = endDay >= 1 ? `${key}-${pad(endDay)}` : `${prev}-${pad(daysInMonth(prev))}`;
  return { start, end };
}

const dateOf = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const long = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const fmt = (f: Intl.DateTimeFormat, iso: string) => f.format(dateOf(iso)).replace(".", "");

/** Titre : « octobre 2026 », ou « 26 oct → 25 nov » avec un jour de paie. */
export function periodTitle(key: string, payday: number) {
  if (payday <= 1) return monthLabel(key);
  const { start, end } = periodRange(key, payday);
  return `${fmt(short, start)} → ${fmt(short, end)}`;
}

/** Dans une phrase : « d’octobre 2026 » / « du 26 oct au 25 nov ». */
export function ofPeriod(key: string, payday: number) {
  if (payday <= 1) return ofMonth(key);
  const { start, end } = periodRange(key, payday);
  return `du ${fmt(short, start)} au ${fmt(short, end)}`;
}

/** Dans une phrase : « en octobre 2026 » / « du 26 oct au 25 nov ». */
export const inPeriod = (key: string, payday: number) => (payday <= 1 ? `en ${monthLabel(key)}` : ofPeriod(key, payday));

/** Dernier jour en toutes lettres : « 31 octobre », « 25 novembre ». */
export const periodEndLabel = (key: string, payday: number) => fmt(long, periodRange(key, payday).end);

/** Jour courant dans la période (1 = jour de paie), nombre de jours, jours restants aujourd’hui compris. */
export function periodProgress(key: string, payday: number) {
  const { start, end } = periodRange(key, payday);
  const total = Math.round((dateOf(end).getTime() - dateOf(start).getTime()) / 86400000) + 1;
  const today = isoDate();
  const cur = currentPeriod(payday);
  if (key < cur) return { day: total, total, left: 0 };
  if (key > cur) return { day: 0, total, left: total };
  const day = Math.round((dateOf(today).getTime() - dateOf(start).getTime()) / 86400000) + 1;
  return { day, total, left: total - day + 1 };
}

/** Range chaque dépense et rentrée dans la période de sa date (après un changement de jour de paie). */
export function rebucket(d: AppData) {
  const payday = paydayOf(d);
  for (const [key, m] of Object.entries(d.months)) {
    for (const e of [...m.expenses]) {
      const k = periodKeyOf(e.date, payday);
      if (k === key) continue;
      m.expenses = m.expenses.filter((x) => x.id !== e.id);
      (d.months[k] ??= { expenses: [], savingsDone: 0, bonus: 0 }).expenses.push(e);
      if (k < d.startMonth) d.startMonth = k;
    }
    for (const x of [...(m.extras ?? [])]) {
      const k = periodKeyOf(x.date, payday);
      if (k === key) continue;
      m.extras = (m.extras ?? []).filter((y) => y.id !== x.id);
      ((d.months[k] ??= { expenses: [], savingsDone: 0, bonus: 0 }).extras ??= []).push(x);
      if (k < d.startMonth) d.startMonth = k;
    }
  }
}
