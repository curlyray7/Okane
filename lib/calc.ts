import { SAVINGS, type AppData, type Category, type MonthData } from "./types";
import { monthKey, monthsBetween, round2 } from "./format";

export const EMPTY_MONTH: MonthData = { expenses: [], savingsDone: 0, bonus: 0 };

export const sumBy = <T,>(items: T[], f: (x: T) => number) =>
  round2(items.reduce((s, x) => s + (Number(f(x)) || 0), 0));

export const getMonth = (d: AppData, key: string): MonthData => d.months[key] ?? EMPTY_MONTH;
export const fixedCats = (d: AppData) => d.categories.filter((c) => c.kind === "fixed");
export const envelopeCats = (d: AppData) => d.categories.filter((c) => c.kind === "envelope");
export const totalIncome = (d: AppData) => sumBy(d.incomes, (i) => i.amount);

export function toAllocate(d: AppData) {
  return round2(totalIncome(d) - sumBy(d.categories, (c) => c.budget) - d.margin - d.savingsMonthly);
}

export function spentByCategory(d: AppData, key: string) {
  const map: Record<string, number> = {};
  for (const e of getMonth(d, key).expenses) map[e.categoryId] = round2((map[e.categoryId] ?? 0) + e.amount);
  return map;
}

/** Rentrées en plus du mois versées à l'épargne. */
export const extraSavings = (m: MonthData) => sumBy((m.extras ?? []).filter((x) => x.target === SAVINGS), (x) => x.amount);

export const savedInMonth = (m: MonthData) => round2((m.savingsDone || 0) + (m.bonus || 0) + extraSavings(m));

/** Budget de chaque enveloppe pour ce mois : budget prévu + rentrées en plus qui lui sont données. */
export function envelopeBudgets(d: AppData, key: string) {
  const map: Record<string, number> = {};
  for (const c of envelopeCats(d)) map[c.id] = c.budget;
  for (const x of getMonth(d, key).extras ?? []) if (x.target in map) map[x.target] = round2(map[x.target] + x.amount);
  return map;
}

export function totalSaved(d: AppData) {
  return round2(d.initialSavings + sumBy(Object.values(d.months), savedInMonth));
}

/** Répartit l'épargne totale entre les objectifs, dans leur ordre de priorité. */
export function goalProgress(d: AppData) {
  let pool = totalSaved(d);
  const now = monthKey();
  return d.goals.map((g) => {
    const reached = Math.max(0, Math.min(pool, g.target));
    pool = round2(pool - reached);
    const monthsLeft = Math.max(0, monthsBetween(now, g.deadline));
    const remaining = round2(Math.max(0, g.target - reached));
    return {
      goal: g,
      reached,
      remaining,
      monthsLeft,
      perMonth: monthsLeft > 0 ? round2(remaining / monthsLeft) : remaining,
      done: remaining <= 0,
    };
  });
}

export function envelopeStatus(c: Category, spent: number, budget = c.budget) {
  const ratio = budget > 0 ? Math.max(0, spent) / budget : spent > 0 ? 2 : 0;
  const level: "over" | "near" | "ok" = ratio > 1 ? "over" : ratio >= 0.9 ? "near" : "ok";
  return { left: round2(budget - spent), ratio, level };
}

export function monthReview(d: AppData, key: string) {
  const spent = spentByCategory(d, key);
  const budgets = envelopeBudgets(d, key);
  const envs = envelopeCats(d);
  const m = getMonth(d, key);
  const income = totalIncome(d);
  const extra = sumBy(m.extras ?? [], (x) => x.amount);
  const fixed = sumBy(fixedCats(d), (c) => c.budget);
  const envBudget = sumBy(envs, (c) => budgets[c.id]);
  const allSpent = sumBy(m.expenses, (e) => e.amount);
  const saved = savedInMonth(m);
  const leftover = sumBy(envs, (c) => Math.max(0, budgets[c.id] - (spent[c.id] ?? 0)));
  const overruns = envs
    .filter((c) => (spent[c.id] ?? 0) > budgets[c.id] + 0.004)
    .map((c) => ({ cat: c, by: round2((spent[c.id] ?? 0) - budgets[c.id]) }));
  return {
    income,
    extra,
    fixed,
    envBudget,
    envSpent: allSpent,
    saved,
    plannedSavings: d.savingsMonthly,
    balance: round2(income + extra - fixed - allSpent - saved),
    leftover,
    overruns,
    spent,
    budgets,
  };
}

export const ENVELOPE_COLORS = [
  "var(--c1)",
  "var(--c2)",
  "var(--c3)",
  "var(--c4)",
  "var(--c5)",
  "var(--c6)",
  "var(--c7)",
];

export function colorFor(d: AppData, categoryId: string) {
  const i = envelopeCats(d).findIndex((c) => c.id === categoryId);
  return i < 0 ? "var(--ink-2)" : ENVELOPE_COLORS[i % ENVELOPE_COLORS.length];
}

export function categoryName(d: AppData, id: string) {
  return d.categories.find((c) => c.id === id)?.name ?? "Catégorie supprimée";
}
