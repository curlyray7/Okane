import { SAVINGS, type AppData, type Category, type MonthData } from "./types";
import { addMonths, monthKey, monthsBetween, round2 } from "./format";

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

/** Remboursements du mois par enveloppe (montants positifs) : à afficher à part, jamais comme une dépense négative. */
export function refundsByCategory(d: AppData, key: string) {
  const map: Record<string, number> = {};
  for (const e of getMonth(d, key).expenses) if (e.amount < 0) map[e.categoryId] = round2((map[e.categoryId] ?? 0) - e.amount);
  return map;
}

export const savedInMonth = (m: MonthData) => round2((m.savingsDone || 0) + (m.bonus || 0) + extraSavings(m));

/**
 * Budget de chaque enveloppe pour ce mois : budget prévu + rentrées en plus qui lui sont données ± argent déplacé,
 * + pour une enveloppe cumulative, ce qui restait (ou manquait) à la fin du mois précédent, depuis le premier mois suivi.
 */
export function envelopeBudgets(d: AppData, key: string) {
  const map = monthBudgets(d, key);
  const rolling = envelopeCats(d).filter((c) => c.rollover);
  if (rolling.length === 0 || key <= d.startMonth) return map;
  const carry: Record<string, number> = {};
  for (let k = d.startMonth; k < key; k = addMonths(k, 1)) {
    const b = monthBudgets(d, k);
    const s = spentByCategory(d, k);
    for (const c of rolling) carry[c.id] = round2(b[c.id] + (carry[c.id] ?? 0) - (s[c.id] ?? 0));
  }
  for (const c of rolling) map[c.id] = round2(map[c.id] + (carry[c.id] ?? 0));
  return map;
}

/** Report reçu du mois précédent par une enveloppe cumulative. */
export function rolledOver(d: AppData, key: string, c: Category) {
  return c.rollover ? round2(envelopeBudgets(d, key)[c.id] - monthBudgets(d, key)[c.id]) : 0;
}

function monthBudgets(d: AppData, key: string) {
  const map: Record<string, number> = {};
  for (const c of envelopeCats(d)) map[c.id] = c.budget;
  const m = getMonth(d, key);
  for (const x of m.extras ?? []) if (x.target in map) map[x.target] = round2(map[x.target] + x.amount);
  for (const mv of m.moves ?? []) {
    if (mv.from in map) map[mv.from] = round2(map[mv.from] - mv.amount);
    if (mv.to in map) map[mv.to] = round2(map[mv.to] + mv.amount);
  }
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
  const purchases = sumBy(m.expenses, (e) => Math.max(0, e.amount));
  const refunds = round2(purchases - allSpent);
  const saved = savedInMonth(m);
  // Les enveloppes cumulatives gardent leur reste : il n’est pas proposé en épargne bonus.
  const leftover = sumBy(
    envs.filter((c) => !c.rollover),
    (c) => Math.max(0, budgets[c.id] - (spent[c.id] ?? 0)),
  );
  const overruns = envs
    .filter((c) => (spent[c.id] ?? 0) > budgets[c.id] + 0.004)
    .map((c) => ({ cat: c, by: round2((spent[c.id] ?? 0) - budgets[c.id]) }));
  return {
    income,
    extra,
    fixed,
    envBudget,
    envSpent: allSpent,
    purchases,
    refunds,
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
