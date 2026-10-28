import type { AppData, Category, Goal, Income } from "@/lib/types";
import { parseAmount, round2, uid } from "@/lib/format";
import type { GoalRow, Row } from "./editors";

export interface Draft {
  incomes: Row[];
  fixed: Row[];
  envelopes: Row[];
  goals: GoalRow[];
  savingsMonthly: string;
  margin: string;
  initialSavings: string;
  /** Jour de paie, vide = le 1er */
  payday: string;
}

const num = (s: string) => parseAmount(s) ?? 0;
const filled = (rows: Row[]) => rows.filter((r) => r.name.trim() !== "" || (parseAmount(r.amount) ?? 0) !== 0);
const toStr = (n: number) => (n ? String(n).replace(".", ",") : "");

export function draftTotals(d: Draft) {
  const income = round2(filled(d.incomes).reduce((s, r) => s + num(r.amount), 0));
  const fixed = round2(filled(d.fixed).reduce((s, r) => s + num(r.amount), 0));
  const envelopes = round2(filled(d.envelopes).reduce((s, r) => s + num(r.amount), 0));
  const savings = num(d.savingsMonthly);
  const margin = num(d.margin);
  return { income, fixed, envelopes, savings, margin, toAllocate: round2(income - fixed - envelopes - savings - margin) };
}

/** Renvoie la liste des problèmes empêchant d'enregistrer. */
export function validateDraft(d: Draft, step?: "incomes" | "fixed" | "envelopes" | "savings" | "goals"): string[] {
  const errs: string[] = [];
  const checkRows = (rows: Row[], label: string) => {
    for (const r of filled(rows)) {
      if (!r.name.trim()) errs.push(`Donne un nom à chaque ligne (${label}).`);
      const a = parseAmount(r.amount);
      if (a === null || a < 0) errs.push(`Montant invalide pour « ${r.name || "sans nom"} ».`);
    }
  };
  if (!step || step === "incomes") {
    const p = d.payday.trim();
    if (p !== "" && !(/^\d{1,2}$/.test(p) && Number(p) >= 1 && Number(p) <= 31)) errs.push("Le jour de paie doit être entre 1 et 31.");
    checkRows(d.incomes, "revenus");
    if (draftTotals(d).income <= 0) errs.push("Ajoute au moins un revenu.");
  }
  if (!step || step === "fixed") checkRows(d.fixed, "charges fixes");
  if (!step || step === "envelopes") {
    checkRows(d.envelopes, "enveloppes");
    if (filled(d.envelopes).length === 0) errs.push("Crée au moins une enveloppe pour suivre tes dépenses.");
  }
  if (!step || step === "savings") {
    for (const [v, l] of [
      [d.savingsMonthly, "l’épargne mensuelle"],
      [d.margin, "la marge"],
      [d.initialSavings, "l’épargne actuelle"],
    ] as const) {
      if (v.trim() !== "" && (parseAmount(v) === null || (parseAmount(v) ?? 0) < 0)) errs.push(`Montant invalide pour ${l}.`);
    }
  }
  if (!step || step === "goals") {
    for (const g of d.goals) {
      if (!g.name.trim() && !g.target && !g.deadline) continue;
      if (!g.name.trim()) errs.push("Donne un nom à chaque objectif.");
      if ((parseAmount(g.target) ?? 0) <= 0) errs.push(`Indique un montant pour « ${g.name || "l’objectif"} ».`);
      if (!/^\d{4}-\d{2}$/.test(g.deadline)) errs.push(`Choisis une échéance pour « ${g.name || "l’objectif"} ».`);
    }
  }
  return Array.from(new Set(errs));
}

export function draftToData(d: Draft, base?: AppData): Omit<AppData, "months" | "createdAt" | "startMonth" | "version"> {
  const keepId = (r: Row) => r.id;
  const incomes: Income[] = filled(d.incomes).map((r) => ({ id: keepId(r), name: r.name.trim(), amount: num(r.amount) }));
  const cat = (rows: Row[], kind: Category["kind"]): Category[] =>
    filled(rows).map((r) => ({ id: keepId(r), name: r.name.trim(), kind, budget: num(r.amount), ...(kind === "envelope" && r.rollover ? { rollover: true } : {}) }));
  const goals: Goal[] = d.goals
    .filter((g) => g.name.trim() && (parseAmount(g.target) ?? 0) > 0 && /^\d{4}-\d{2}$/.test(g.deadline))
    .map((g) => ({ id: g.id, name: g.name.trim(), target: num(g.target), deadline: g.deadline }));
  void base;
  return {
    incomes,
    categories: [...cat(d.fixed, "fixed"), ...cat(d.envelopes, "envelope")],
    goals,
    savingsMonthly: num(d.savingsMonthly),
    payday: Number(d.payday) > 1 ? Number(d.payday) : undefined,
    margin: num(d.margin),
    initialSavings: num(d.initialSavings),
  };
}

export function dataToDraft(a: AppData): Draft {
  const rows = (kind: Category["kind"]) =>
    a.categories.filter((c) => c.kind === kind).map((c) => ({ id: c.id, name: c.name, amount: toStr(c.budget), ...(c.rollover ? { rollover: true } : {}) }));
  return {
    incomes: a.incomes.map((i) => ({ id: i.id, name: i.name, amount: toStr(i.amount) })),
    fixed: rows("fixed"),
    envelopes: rows("envelope"),
    goals: a.goals.map((g) => ({ id: g.id, name: g.name, target: toStr(g.target), deadline: g.deadline })),
    savingsMonthly: toStr(a.savingsMonthly),
    payday: a.payday && a.payday > 1 ? String(a.payday) : "",
    margin: toStr(a.margin),
    initialSavings: toStr(a.initialSavings),
  };
}

export const emptyDraft = (): Draft => ({
  incomes: [{ id: uid(), name: "", amount: "" }],
  fixed: [{ id: uid(), name: "", amount: "" }],
  envelopes: [{ id: uid(), name: "", amount: "" }],
  goals: [],
  savingsMonthly: "",
  payday: "",
  margin: "",
  initialSavings: "",
});
