"use client";

import { useEffect, useRef, useState } from "react";
import type { AppData } from "@/lib/types";
import { colorFor, envelopeCats, getMonth } from "@/lib/calc";
import { daysInMonth, eur, isoDate, monthKey, parseAmount, round2, uid } from "@/lib/format";
import { updateData } from "@/lib/store";
import { Button, TextInput, useToast } from "./ui";

function defaultDate(month: string) {
  const now = monthKey();
  if (month === now) return isoDate();
  if (month < now) return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  return `${month}-01`;
}

export function ExpenseSheet({ data, month, expenseId, onClose }: { data: AppData; month: string; expenseId?: string; onClose: () => void }) {
  const toast = useToast();
  const existing = expenseId ? getMonth(data, month).expenses.find((e) => e.id === expenseId) : undefined;
  const envs = envelopeCats(data);
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace(".", ",") : "");
  const [cat, setCat] = useState(existing?.categoryId ?? envs[0]?.id ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
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

  const save = () => {
    const a = parseAmount(amount);
    if (a === null || a <= 0) return setError("Indique un montant supérieur à 0.");
    if (!cat) return setError("Choisis une enveloppe.");
    let left = 0;
    const ok = updateData((d) => {
      const m = d.months[month] ?? { expenses: [], savingsDone: 0, bonus: 0 };
      if (existing) {
        const e = m.expenses.find((x) => x.id === existing.id);
        if (e) Object.assign(e, { amount: a, categoryId: cat, label: label.trim() });
      } else {
        m.expenses.push({ id: uid(), date: defaultDate(month), amount: a, categoryId: cat, label: label.trim(), createdAt: Date.now() });
      }
      d.months[month] = m;
      const c = d.categories.find((x) => x.id === cat);
      left = round2((c?.budget ?? 0) - m.expenses.filter((x) => x.categoryId === cat).reduce((s, x) => s + x.amount, 0));
    });
    if (!ok) return setError("Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
    const name = envs.find((c) => c.id === cat)?.name ?? "";
    toast(existing ? "Dépense modifiée" : left < 0 ? `${name} : dépassée de ${eur(-left)}` : `${name} : ${eur(left)} restants`);
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    updateData((d) => {
      const m = d.months[month];
      if (m) m.expenses = m.expenses.filter((x) => x.id !== existing.id);
    });
    toast("Dépense supprimée");
    onClose();
  };

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
        <h2 id="sheet-title" className="font-manga text-[1.7rem] leading-none">
          {existing ? "Modifier la dépense" : "Nouvelle dépense"}
        </h2>
        {envs.length === 0 ? (
          <p className="my-6 text-ink-2">Crée d’abord une enveloppe dans les réglages.</p>
        ) : (
          <>
            <div className="my-3 flex items-baseline justify-center gap-1.5">
              <input
                ref={amountRef}
                aria-label="Montant"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-[6ch] bg-transparent p-0 text-center font-manga text-6xl tabular outline-none placeholder:text-ink-2/50"
              />
              <span className="font-display text-3xl font-semibold text-ink-2">€</span>
            </div>
            <p className="text-sm text-ink-2">Enveloppe</p>
            <div className="mt-1 mb-4 flex flex-wrap gap-2" role="group" aria-label="Enveloppe">
              {envs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === cat}
                  onClick={() => setCat(c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[0.9rem] ${c.id === cat ? "border-2 border-ink bg-accent text-on-accent shadow-ink-sm" : "border-2 border-line bg-surface-2"}`}
                >
                  <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: colorFor(data, c.id) }} />
                  {c.name}
                </button>
              ))}
            </div>
            <TextInput aria-label="Libellé" placeholder="Libellé (facultatif)" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
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
            <button type="submit" className="flex-1 rounded-xl border-2 border-ink bg-accent py-3 font-semibold text-on-accent shadow-ink-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              {existing ? "Enregistrer" : "Ajouter"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
