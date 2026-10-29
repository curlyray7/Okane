"use client";

import { useEffect, useState } from "react";
import type { AppData } from "@/lib/types";
import { colorFor, envelopeBudgets, envelopeCats, refundsByCategory, rolledOver, envelopeStatus, fixedCats, getMonth, goalProgress, spentByCategory, sumBy, toAllocate, totalSaved } from "@/lib/calc";
import { eur, eur0, round2 } from "@/lib/format";
import { currentPeriod, ofPeriod, paydayOf, periodEndLabel, periodProgress } from "@/lib/period";
import { updateData } from "@/lib/store";
import { AllocateAlert } from "./Onboarding";
import { Bar, Button, LifeBar, Panel, useToast, type LifeState } from "./ui";
import { Mascot, type Mood } from "./Mascot";
import { SafetyTip } from "./SafetyTip";
import { MoveSheet } from "./MoveSheet";

export function Home({ data, month }: { data: AppData; month: string }) {
  const toast = useToast();
  const [move, setMove] = useState<{ to?: string; amount?: number } | null>(null);
  const envs = envelopeCats(data);
  // Net = achats − remboursements. Un remboursement plus gros que les achats du mois ne s’affiche jamais en « dépense négative ».
  const spent = spentByCategory(data, month);
  const refunds = refundsByCategory(data, month);
  const refunded = sumBy(envs, (c) => refunds[c.id] ?? 0);
  // Budget du mois : budget prévu + rentrées en plus données à l’enveloppe ± argent déplacé.
  const budgets = envelopeBudgets(data, month);
  const budget = sumBy(envs, (c) => budgets[c.id]);
  const used = sumBy(envs, (c) => spent[c.id] ?? 0);
  const available = round2(budget - used);
  const payday = paydayOf(data);
  const now = currentPeriod(payday);
  const period = periodProgress(month, payday);
  const progress = month === now ? (period.day - 0.5) / period.total : month < now ? 1 : 0;
  // Ce qu’on peut dépenser par jour d’ici la fin de la période, aujourd’hui compris.
  const daysLeft = month === now ? period.left : 0;
  const perDay = daysLeft > 0 && available > 0 ? round2(available / daysLeft) : 0;
  const lastDay = periodEndLabel(month, payday);
  const fixed = fixedCats(data);
  const m = getMonth(data, month);
  const rest = toAllocate(data);
  const goals = goalProgress(data);
  const overCat = envs.find((c) => envelopeStatus(c, spent[c.id] ?? 0, budgets[c.id]).level === "over");
  const doneGoal = goals.find((g) => g.done);
  const showPace = month === now && progress > 0 && progress < 1;
  // Même règle que l’alerte « Ça part vite » sous chaque enveloppe, pour que la mascotte ne dise pas le contraire.
  const fastCat = showPace ? envs.find((c) => budgets[c.id] > 0 && envelopeStatus(c, spent[c.id] ?? 0, budgets[c.id]).level !== "over" && envelopeStatus(c, spent[c.id] ?? 0, budgets[c.id]).ratio - progress > 0.15) : undefined;
  const [mood, line]: [Mood, string] =
    available < 0 || overCat
      ? ["inquiete", overCat ? `Aïe, « ${overCat.name} » est vide. Prends dans une autre enveloppe, ganbatte !` : "Aïe, tes enveloppes sont dans le rouge. On se reprend !"]
      : doneGoal
        ? ["victoire", `Sugoi ! Objectif « ${doneGoal.goal.name} » atteint.`]
        : fastCat
          ? ["neutre", `« ${fastCat.name} » part vite. Lève le pied quelques jours et ça passe !`]
          : m.savingsDone > 0
            ? ["contente", "Épargne versée, yosh ! Continue comme ça."]
            : ["neutre", month === now ? "Tu tiens le rythme. Ganbatte !" : "Voilà où en était cette période."];

  // Teinte d’alerte des pétales du fond : ambre si une enveloppe part vite, rouge si une enveloppe est vide ; rien si tout va bien.
  const aura = month !== now ? "" : available < 0 || overCat ? "var(--over)" : fastCat ? "var(--gauge-warn)" : "";
  useEffect(() => {
    const root = document.documentElement.style;
    if (aura) root.setProperty("--aura-tone", aura);
    else root.removeProperty("--aura-tone");
    return () => void root.removeProperty("--aura-tone");
  }, [aura]);

  const toggleSavings = () => {
    updateData((d) => {
      const cur = d.months[month] ?? { expenses: [], savingsDone: 0, bonus: 0 };
      cur.savingsDone = cur.savingsDone > 0 ? 0 : d.savingsMonthly;
      d.months[month] = cur;
    }) || toast("Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 min-[860px]:grid-cols-[1.15fr_.85fr] min-[860px]:gap-10">
      <div className="grid gap-8">
        {/* La case de manga : le seul bloc encadré de l’écran. La mascotte en sort par le coin. */}
        <section aria-label="Ce qu’il te reste" className="relative mt-4 mr-1">
          <div className="speed-lines overflow-hidden rounded-[6px] border-[3px] border-ink bg-hero text-on-hero shadow-ink">
            <div className="relative z-[1] max-w-[64%] px-5 pt-5 pb-4">
              <p className="text-[0.95rem] font-semibold text-pop">Il te reste</p>
              <p
                className={`mt-0.5 font-manga text-[clamp(2.9rem,13.5vw,4.6rem)] leading-[0.9] whitespace-nowrap tabular [text-shadow:3px_3px_0_var(--accent)] ${available < 0 ? "text-over" : ""}`}
              >
                {eur(available)}
              </p>
              {perDay > 0 && (
                <p className="mt-2 text-[0.9rem] leading-snug text-on-hero/85">
                  soit <b className="text-pop">{eur(perDay)}</b> par jour jusqu’au {lastDay}
                </p>
              )}
              <p className="mt-1 text-[0.78rem] text-on-hero/55">
                {eur(round2(used + refunded))} dépensés sur {eur(budget)}
                {refunded > 0 && ` · ${eur(refunded)} remboursés`}
              </p>
            </div>
            <div className="relative z-[1] mx-3 mb-3 rounded-[14px] bg-bubble px-3.5 py-2.5 text-[0.9rem] text-on-bubble">
              <span className="absolute -top-[7px] right-[22%] h-3.5 w-3.5 rotate-45 bg-bubble" aria-hidden="true" />
              <span className="relative">{line}</span>
            </div>
          </div>
          <div className="sticker pointer-events-none absolute -top-6 -right-2 z-[2]">
            <Mascot mood={mood} size={150} />
          </div>
        </section>

        {Math.abs(rest) >= 0.01 && (
          <AllocateAlert
            value={rest}
            onSave={() => {
              updateData((d) => void (d.savingsMonthly = round2(d.savingsMonthly + rest)));
              toast(`Épargne mensuelle : ${eur(round2(data.savingsMonthly + rest))}. Chaque euro a sa mission !`);
            }}
            onAdjust={() => (window.location.hash = "reglages")}
          />
        )}

        <Panel
          title="Enveloppes"
          action={
            envs.length >= 2 && (
              <button type="button" className="text-sm font-semibold text-accent underline-offset-4 hover:underline" onClick={() => setMove({})}>
                Déplacer de l’argent
              </button>
            )
          }
        >
          {envs.length === 0 && <p className="text-ink-2">Aucune enveloppe. Crée-en une dans les réglages.</p>}
          {showPace && envs.length > 0 && (
            <p className="-mt-1 mb-4 flex items-center gap-2 text-[0.8rem] text-ink-2">
              <span className="inline-block h-3.5 w-[3px] flex-none rounded-full bg-ink" aria-hidden="true" />
              Aujourd’hui. Si la partie vide dépasse ce trait, tu dépenses trop vite.
            </p>
          )}
          <ul className="grid gap-6">
            {envs.map((c) => {
              const s = spent[c.id] ?? 0;
              const st = envelopeStatus(c, s, budgets[c.id]);
              // Rythme : part du budget dépensée nettement au-dessus de la part de période écoulée.
              const pace = showPace && budgets[c.id] > 0;
              const fast = pace && st.level !== "over" && st.ratio - progress > 0.15;
              const state: LifeState = st.left <= 0 && budgets[c.id] > 0 ? "empty" : st.level === "over" ? "empty" : fast ? "fast" : "ok";
              const changed = Math.abs(budgets[c.id] - c.budget) >= 0.01;
              const carried = rolledOver(data, month, c);
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <i className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ background: colorFor(data, c.id) }} />
                      <span className="truncate">{c.name}</span>
                      {c.rollover && (
                        <span className="flex-none rounded-full bg-surface-2 px-1.5 text-[0.7rem] font-semibold text-ink-2" title="Garde son reste d’une période à l’autre">
                          cumul
                        </span>
                      )}
                    </span>
                    <span className={`text-[1.12rem] font-bold whitespace-nowrap tabular ${state === "empty" ? "text-over" : state === "fast" ? "text-warn" : ""}`}>
                      {st.left < 0 ? `− ${eur(-st.left)}` : eur(st.left)}
                    </span>
                  </div>
                  <div className="mt-2 px-1">
                    <LifeBar left={st.left} total={budgets[c.id]} state={state} marker={pace ? progress : undefined} />
                  </div>
                  <p className="mt-1.5 text-[0.8rem] text-ink-2">
                    {eur(Math.max(0, s))} dépensés sur {eur(budgets[c.id])}
                    {Math.abs(carried) < 0.01 && changed && ` (prévu ${eur(c.budget)})`}
                  </p>
                  {fast && (
                    <p className="text-[0.8rem] font-semibold text-warn">
                      Ça part vite : {Math.round(st.ratio * 100)} % dépensés pour {Math.round(progress * 100)} % de la période
                    </p>
                  )}
                  {(refunds[c.id] ?? 0) > 0 && <p className="text-[0.8rem] text-save">↩ {eur(refunds[c.id])} remboursés, revenus dans l’enveloppe</p>}
                  {Math.abs(carried) >= 0.01 && (
                    <p className={`text-[0.8rem] ${carried > 0 ? "text-save" : "text-over"}`}>
                      ↻ {carried > 0 ? "+" : "−"}
                      {eur(Math.abs(carried))} {carried > 0 ? "gardés" : "à rattraper"} {payday > 1 ? "de la période précédente" : "du mois dernier"}
                    </p>
                  )}
                  {st.left < 0 && envs.length >= 2 && (
                    <button
                      type="button"
                      className="mt-1 text-[0.85rem] font-semibold text-accent underline underline-offset-4"
                      onClick={() => setMove({ to: c.id, amount: -st.left })}
                    >
                      Combler les {eur(-st.left)} avec une autre enveloppe
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {fixed.length > 0 && (
            <details className="mt-6 border-t border-line pt-3 text-[0.92rem]">
              <summary className="flex cursor-pointer list-none justify-between">
                <span>
                  Charges fixes <span className="text-ink-2">· déjà comptées</span>
                </span>
                <span className="tabular">{eur(sumBy(fixed, (c) => c.budget))}</span>
              </summary>
              {fixed.map((c) => (
                <div key={c.id} className="flex justify-between py-1.5 text-ink-2">
                  <span>{c.name}</span>
                  <span className="tabular">{eur(c.budget)}</span>
                </div>
              ))}
            </details>
          )}
        </Panel>
      </div>

      <div className="grid gap-8">
        <Panel title="Épargne" action={<b className="text-[1.12rem] text-save tabular">{eur(totalSaved(data))}</b>}>
          {data.savingsMonthly > 0 && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
              <button
                type="button"
                onClick={toggleSavings}
                aria-pressed={m.savingsDone > 0}
                aria-label={m.savingsDone > 0 ? "Marquer l’épargne comme non versée" : "Marquer l’épargne comme versée"}
                className={`grid h-7 w-7 flex-none place-items-center rounded-lg border-2 border-ink text-on-accent ${m.savingsDone > 0 ? "power-up bg-save" : "bg-surface"}`}
              >
                {m.savingsDone > 0 ? "✓" : ""}
              </button>
              <span className="min-w-0 flex-1 text-[0.92rem]">
                {payday > 1 && month === now ? "Épargne de cette période" : `Épargne ${ofPeriod(month, payday)}`}
                <small className="block text-[0.78rem] text-ink-2">{m.savingsDone > 0 ? "Versée" : "Coche quand le virement est fait"}</small>
              </span>
              <b className="tabular">{eur(m.savingsDone || data.savingsMonthly)}</b>
            </label>
          )}
          <ul className="mt-5 grid gap-5">
            {goals.map((g) => (
              <li key={g.goal.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{g.goal.name}</span>
                  <span className="tabular">
                    <b>{eur0(g.reached)}</b>
                    <span className="text-[0.85rem] text-ink-2"> / {eur0(g.goal.target)}</span>
                  </span>
                </div>
                <div className="my-2">
                  <Bar value={g.goal.target ? g.reached / g.goal.target : 0} color="var(--save)" height={10} />
                </div>
                <p className="text-[0.8rem] text-ink-2">
                  {g.done ? "Objectif atteint. Sugoi !" : g.monthsLeft > 0 ? `Encore ${g.monthsLeft} mois : ${eur0(g.perMonth)} par mois.` : "Échéance dépassée."}
                </p>
              </li>
            ))}
          </ul>
          {data.goals.length === 0 && <p className="mt-3 text-[0.85rem] text-ink-2">Ajoute un objectif dans les réglages pour suivre ta progression.</p>}
        </Panel>
        <SafetyTip data={data} />
        <QuickTip data={data} month={month} />
        {move && <MoveSheet data={data} month={month} to={move.to} amount={move.amount} onClose={() => setMove(null)} />}
      </div>
    </div>
  );
}

function QuickTip({ data, month }: { data: AppData; month: string }) {
  const m = getMonth(data, month);
  if (m.expenses.length > 0) return null;
  return (
    <Panel soft>
      <p className="text-[0.92rem]">Note ta première dépense avec le bouton + : montant, enveloppe, et c’est tout.</p>
      <Button variant="ghost" className="mt-3 py-2 text-sm" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="Ajouter une dépense"]')?.click()}>
        Ajouter une dépense
      </Button>
    </Panel>
  );
}
