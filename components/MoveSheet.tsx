"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppData } from "@/lib/types";
import { categoryName, colorFor, envelopeBudgets, envelopeCats, getMonth, spentByCategory } from "@/lib/calc";
import { eur, parseAmount, round2, uid } from "@/lib/format";
import { inPeriod, paydayOf } from "@/lib/period";
import { updateData } from "@/lib/store";
import { Button, useToast } from "./ui";

/** Déplace de l’argent d’une enveloppe à une autre pour ce mois seulement (le budget prévu ne change pas). */
export function MoveSheet({ data, month, to: initialTo, amount: initialAmount, onClose }: { data: AppData; month: string; to?: string; amount?: number; onClose: () => void }) {
  const toast = useToast();
  const envs = envelopeCats(data);
  const budgets = envelopeBudgets(data, month);
  const spent = spentByCategory(data, month);
  const left = useMemo(() => Object.fromEntries(envs.map((c) => [c.id, round2(budgets[c.id] - (spent[c.id] ?? 0))])), [envs, budgets, spent]);
  const richest = (except: string) => envs.filter((c) => c.id !== except).sort((a, b) => left[b.id] - left[a.id])[0]?.id ?? "";

  const [to, setTo] = useState(initialTo ?? envs[0]?.id ?? "");
  const [from, setFrom] = useState(() => richest(initialTo ?? envs[0]?.id ?? ""));
  const [amount, setAmount] = useState(initialAmount ? round2(initialAmount).toFixed(2).replace(".", ",") : "");
  const [error, setError] = useState("");
  const moves = getMonth(data, month).moves ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const a = parseAmount(amount) ?? 0;
  const name = (id: string) => categoryName(data, id);

  const pickTo = (id: string) => {
    setTo(id);
    if (id === from) setFrom(richest(id));
  };

  const save = () => {
    if (!from || !to || from === to) return setError("Choisis deux enveloppes différentes.");
    if (a <= 0) return setError("Indique un montant supérieur à 0.");
    if (a > left[from] + 0.004) return setError(left[from] > 0 ? `Il ne reste que ${eur(left[from])} dans ${name(from)}.` : `${name(from)} n’a plus rien à donner.`);
    const ok = updateData((d) => {
      const m = (d.months[month] ??= { expenses: [], savingsDone: 0, bonus: 0 });
      (m.moves ??= []).push({ id: uid(), from, to, amount: a, createdAt: Date.now() });
    });
    if (!ok) return setError("Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
    toast(`${eur(a)} déplacés de ${name(from)} vers ${name(to)}`);
    onClose();
  };

  const cancel = (id: string) => {
    updateData((d) => {
      const m = d.months[month];
      if (m?.moves) m.moves = m.moves.filter((x) => x.id !== id);
    });
    toast("Déplacement annulé");
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.88rem] ${active ? "border-2 border-ink bg-accent text-on-accent shadow-ink-sm" : "border-2 border-line bg-surface-2"}`;
  const money = (n: number) => (n < 0 ? `− ${eur(-n)}` : eur(n));

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 min-[600px]:items-center" role="dialog" aria-modal="true" aria-labelledby="move-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="max-h-[92vh] w-full max-w-[520px] overflow-auto rounded-t-[22px] border-2 border-b-0 border-ink bg-surface px-[18px] pt-[18px] min-[600px]:rounded-[22px] min-[600px]:border-b-2 min-[600px]:shadow-ink"
        style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))" }}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 id="move-title" className="font-manga text-[1.7rem] leading-none">
          Déplacer de l’argent
        </h2>
        <p className="mt-1 text-sm text-ink-2">Pour {inPeriod(month, paydayOf(data)).replace(/^en /, "")} seulement : ton budget prévu des autres périodes ne change pas.</p>

        <p className="mt-4 text-sm text-ink-2">Vers</p>
        <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Vers">
          {envs.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === to} onClick={() => pickTo(c.id)} className={chip(c.id === to)}>
              <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: colorFor(data, c.id) }} />
              {c.name}
              <span className={`tabular ${c.id === to ? "" : left[c.id] < 0 ? "text-over" : "text-ink-2"}`}>{money(left[c.id])}</span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-ink-2">Pris dans</p>
        <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Pris dans">
          {envs
            .filter((c) => c.id !== to)
            .map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === from} onClick={() => setFrom(c.id)} className={chip(c.id === from)}>
                <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: colorFor(data, c.id) }} />
                {c.name}
                <span className={`tabular ${c.id === from ? "" : left[c.id] <= 0 ? "text-over" : "text-ink-2"}`}>{money(left[c.id])}</span>
              </button>
            ))}
        </div>

        <div className="my-4 flex items-baseline justify-center gap-1.5">
          <input
            aria-label="Montant à déplacer"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-[6ch] bg-transparent p-0 text-center font-manga text-5xl tabular outline-none placeholder:text-ink-2/50"
          />
          <span className="font-display text-2xl font-semibold text-ink-2">€</span>
        </div>

        {from && to && a > 0 && (
          <div className="rounded-xl border-2 border-line px-3 py-2 text-[0.88rem]">
            <div className="flex justify-between gap-3">
              <span>{name(from)}</span>
              <span className="tabular">
                {money(left[from])} → <b className={left[from] - a < 0 ? "text-over" : ""}>{money(round2(left[from] - a))}</b>
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span>{name(to)}</span>
              <span className="tabular">
                {money(left[to])} → <b className={left[to] + a < 0 ? "text-over" : "text-save"}>{money(round2(left[to] + a))}</b>
              </span>
            </div>
          </div>
        )}

        <p className="min-h-[1.3em] pt-1 text-sm text-over" role="alert">
          {error}
        </p>
        <div className="mt-2 flex gap-2.5">
          <Button variant="ghost" className="flex-1 py-3" onClick={onClose}>
            Annuler
          </Button>
          <button type="submit" className="flex-1 rounded-xl border-2 border-ink bg-accent py-3 font-semibold text-on-accent shadow-ink-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            Déplacer
          </button>
        </div>

        {moves.length > 0 && (
          <div className="mt-5 border-t-2 border-line pt-3">
            <p className="text-sm font-semibold">Déjà déplacé sur cette période</p>
            {moves.map((mv) => (
              <div key={mv.id} className="flex items-center gap-2 py-1.5 text-[0.88rem]">
                <span className="min-w-0 flex-1 truncate">
                  {name(mv.from)} → {name(mv.to)}
                </span>
                <b className="tabular">{eur(mv.amount)}</b>
                <button type="button" aria-label={`Annuler le déplacement de ${eur(mv.amount)}`} onClick={() => cancel(mv.id)} className="h-8 w-8 rounded-full hover:bg-surface-2">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
