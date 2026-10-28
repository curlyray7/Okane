"use client";

import { useEffect, useRef, useState } from "react";
import { SAVINGS, type AppData } from "@/lib/types";
import { colorFor, envelopeBudgets, envelopeCats, getMonth, spentByCategory } from "@/lib/calc";
import { eur, isoDate, parseAmount, round2, uid } from "@/lib/format";
import { currentPeriod, inPeriod, paydayOf, periodKeyOf, periodRange } from "@/lib/period";
import { updateData } from "@/lib/store";
import { Button, TextInput, useToast } from "./ui";

/** Dépense, remboursement (l’argent revient dans une enveloppe) ou rentrée en plus (ajoutée à une enveloppe ou à l’épargne). */
type Kind = "expense" | "refund" | "extra";

const TITLES: Record<Kind, [string, string]> = {
  expense: ["Nouvelle dépense", "Modifier la dépense"],
  refund: ["Nouveau remboursement", "Modifier le remboursement"],
  extra: ["Nouvelle rentrée", "Modifier la rentrée"],
};

/** Aujourd’hui dans la période en cours, sinon son dernier jour (passée) ou son premier (à venir). */
function defaultDate(month: string, payday: number) {
  const now = currentPeriod(payday);
  if (month === now) return isoDate();
  const { start, end } = periodRange(month, payday);
  return month < now ? end : start;
}

export function ExpenseSheet({ data, month, expenseId, onClose }: { data: AppData; month: string; expenseId?: string; onClose: () => void }) {
  const toast = useToast();
  const m0 = getMonth(data, month);
  const existingExpense = expenseId ? m0.expenses.find((e) => e.id === expenseId) : undefined;
  const existingExtra = expenseId ? m0.extras?.find((x) => x.id === expenseId) : undefined;
  const existing = existingExpense ?? existingExtra;
  const envs = envelopeCats(data);
  const [kind, setKind] = useState<Kind>(existingExtra ? "extra" : existingExpense && existingExpense.amount < 0 ? "refund" : "expense");
  const [amount, setAmount] = useState(existing ? String(Math.abs(existing.amount)).replace(".", ",") : "");
  const [cat, setCat] = useState(existingExtra?.target ?? existingExpense?.categoryId ?? envs[0]?.id ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const payday = paydayOf(data);
  const [date, setDate] = useState(existing?.date ?? defaultDate(month, payday));
  const today = isoDate();
  const yesterday = isoDate(new Date(Date.now() - 86400000));
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const pick = (k: Kind) => {
    setKind(k);
    if (k !== "extra" && cat === SAVINGS) setCat(envs[0]?.id ?? "");
  };

  const save = () => {
    const a = parseAmount(amount);
    if (a === null || a <= 0) return setError("Indique un montant supérieur à 0.");
    if (!cat) return setError(kind === "extra" ? "Choisis où va cet argent." : "Choisis une enveloppe.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Choisis une date.");
    const key = periodKeyOf(date, payday);
    let left = 0;
    const ok = updateData((d) => {
      // Une modification peut changer de sorte ou de mois : on retire l’ancienne ligne et on la recrée au bon endroit.
      const old = d.months[month];
      if (old) {
        old.expenses = old.expenses.filter((x) => x.id !== existing?.id);
        if (old.extras) old.extras = old.extras.filter((x) => x.id !== existing?.id);
      }
      const m = (d.months[key] ??= { expenses: [], savingsDone: 0, bonus: 0 });
      if (key < d.startMonth) d.startMonth = key;
      const base = {
        id: existing?.id ?? uid(),
        date,
        label: label.trim(),
        createdAt: existing?.createdAt ?? Date.now(),
        ...(existing?.importId ? { importId: existing.importId } : {}),
      };
      if (kind === "extra") (m.extras ??= []).push({ ...base, amount: a, target: cat });
      else m.expenses.push({ ...base, amount: kind === "refund" ? -a : a, categoryId: cat });
      if (cat !== SAVINGS) left = round2((envelopeBudgets(d, key)[cat] ?? 0) - (spentByCategory(d, key)[cat] ?? 0));
    });
    if (!ok) return setError("Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
    const name = cat === SAVINGS ? "Épargne" : (envs.find((c) => c.id === cat)?.name ?? "");
    if (key !== month) toast(payday > 1 ? `Noté dans la période ${inPeriod(key, payday)}` : `Noté ${inPeriod(key, payday)}`);
    else if (existing) toast("Modification enregistrée");
    else if (cat === SAVINGS) toast(`${eur(a)} ajoutés à ton épargne. Sugoi !`);
    else toast(left < 0 ? `${name} : dépassée de ${eur(-left)}` : `${name} : ${eur(left)} restants`);
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    updateData((d) => {
      const m = d.months[month];
      if (!m) return;
      m.expenses = m.expenses.filter((x) => x.id !== existing.id);
      if (m.extras) m.extras = m.extras.filter((x) => x.id !== existing.id);
    });
    toast("Supprimé");
    onClose();
  };

  const income = kind !== "expense";
  // Ce qu’il reste dans l’enveloppe choisie, avant cette dépense (sans compter la ligne qu’on modifie).
  const leftNow = round2(
    (envelopeBudgets(data, month)[cat] ?? 0) - (spentByCategory(data, month)[cat] ?? 0) + (existingExpense && existingExpense.categoryId === cat ? existingExpense.amount : 0),
  );
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.9rem] ${active ? "border-2 border-ink bg-accent text-on-accent" : "border-2 border-line bg-surface"}`;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 min-[600px]:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="max-h-[92vh] w-full max-w-[520px] overflow-auto rounded-t-[22px] border-2 border-b-0 border-ink bg-surface px-[18px] pt-[18px] min-[600px]:rounded-[22px] min-[600px]:border-b-2 min-[600px]:shadow-ink"
        style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))" }}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 id="sheet-title" className="text-[1.25rem] leading-tight font-bold">
          {TITLES[kind][existing ? 1 : 0]}
        </h2>
        {envs.length === 0 ? (
          <p className="my-6 text-ink-2">Crée d’abord une enveloppe dans les réglages.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border-2 border-ink p-1" role="group" aria-label="Type">
              {(
                [
                  [false, "Dépense"],
                  [true, "Rentrée d’argent"],
                ] as const
              ).map(([isIncome, l]) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={income === isIncome}
                  onClick={() => pick(isIncome ? (income ? kind : "refund") : "expense")}
                  className={`rounded-lg py-2 text-[0.9rem] font-semibold ${income === isIncome ? (isIncome ? "bg-save text-on-accent" : "bg-accent text-on-accent") : "text-ink-2"}`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="my-3 flex items-baseline justify-center gap-1.5">
              {income && <span className="font-manga text-5xl text-save">+</span>}
              <input
                ref={amountRef}
                aria-label="Montant"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-[6ch] bg-transparent p-0 text-center font-manga text-6xl tabular outline-none placeholder:text-ink-2/50 ${income ? "text-save" : ""}`}
              />
              <span className="font-display text-3xl font-semibold text-ink-2">€</span>
            </div>

            {income && (
              <div className="mb-4 grid gap-2" role="group" aria-label="Sorte de rentrée">
                {(
                  [
                    ["refund", "Remboursement", "L’argent revient dans une enveloppe (Uber Eats, article renvoyé, un pote qui te rembourse)."],
                    ["extra", "En plus", "Argent imprévu (virement d’un parent, prime) ajouté à une enveloppe ou à ton épargne."],
                  ] as const
                ).map(([k, l, hint]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => pick(k)}
                    className={`rounded-xl border-2 px-3 py-2 text-left ${kind === k ? "border-ink bg-save-soft" : "border-line"}`}
                  >
                    <b className="block text-[0.92rem]">{l}</b>
                    <small className="block text-[0.78rem] text-ink-2">{hint}</small>
                  </button>
                ))}
              </div>
            )}

            <p className="flex justify-between gap-3 text-sm text-ink-2">
              <span>{kind === "expense" ? "Enveloppe" : kind === "refund" ? "Revient dans" : "Ajoutée à"}</span>
              {kind === "expense" && cat && cat !== SAVINGS && (
                <span className={leftNow < 0 ? "text-over" : ""}>Il reste {eur(leftNow)} dans {envs.find((c) => c.id === cat)?.name}</span>
              )}
            </p>
            <div className="mt-1 mb-4 flex flex-wrap gap-2" role="group" aria-label="Destination">
              {envs.map((c) => (
                <button key={c.id} type="button" aria-pressed={c.id === cat} onClick={() => setCat(c.id)} className={chip(c.id === cat)}>
                  <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: colorFor(data, c.id) }} />
                  {c.name}
                </button>
              ))}
              {kind === "extra" && (
                <button type="button" aria-pressed={cat === SAVINGS} onClick={() => setCat(SAVINGS)} className={chip(cat === SAVINGS)}>
                  <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-save" />
                  Épargne
                </button>
              )}
            </div>
            <TextInput aria-label="Libellé" placeholder="Libellé (facultatif)" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Date">
              <button type="button" aria-pressed={date === today} onClick={() => setDate(today)} className={chip(date === today)}>
                Aujourd’hui
              </button>
              <button type="button" aria-pressed={date === yesterday} onClick={() => setDate(yesterday)} className={chip(date === yesterday)}>
                Hier
              </button>
              <input
                type="date"
                aria-label="Autre date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className={`min-w-0 flex-1 rounded-full border-2 px-3 py-1.5 text-[0.9rem] ${date !== today && date !== yesterday ? "border-ink bg-accent-soft" : "border-line bg-surface-2"}`}
              />
            </div>
          </>
        )}
        <p className="min-h-[1.3em] pt-1 text-sm text-over" role="alert">
          {error}
        </p>
        <div className="mt-2 flex gap-2.5">
          {existing && (
            <Button variant="danger" onClick={remove}>
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="flex-1 py-3" onClick={onClose}>
            Annuler
          </Button>
          {envs.length > 0 && (
            <button
              type="submit"
              className={`flex-1 rounded-xl border-2 border-ink py-3 font-semibold text-on-accent shadow-ink-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${income ? "bg-save" : "bg-accent"}`}
            >
              {existing ? "Enregistrer" : "Ajouter"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
