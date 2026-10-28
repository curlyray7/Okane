"use client";

import { useState } from "react";
import type { AppData } from "@/lib/types";
import { colorFor, envelopeBudgets, envelopeCats, envelopeStatus, fixedCats, getMonth, goalProgress, spentByCategory, sumBy, toAllocate, totalSaved } from "@/lib/calc";
import { daysInMonth, eur, eur0, monthKey, ofMonth, round2 } from "@/lib/format";
import { updateData } from "@/lib/store";
import { AllocateAlert } from "./Onboarding";
import { Bar, Button, Panel, useToast } from "./ui";
import { MascotSays, type Mood } from "./Mascot";
import { SafetyTip } from "./SafetyTip";
import { MoveSheet } from "./MoveSheet";

export function Home({ data, month }: { data: AppData; month: string }) {
  const toast = useToast();
  const [move, setMove] = useState<{ to?: string; amount?: number } | null>(null);
  const envs = envelopeCats(data);
  const spent = spentByCategory(data, month);
  // Budget du mois : budget prévu + rentrées en plus données à l’enveloppe ± argent déplacé.
  const budgets = envelopeBudgets(data, month);
  const budget = sumBy(envs, (c) => budgets[c.id]);
  const used = sumBy(envs, (c) => spent[c.id] ?? 0);
  const available = budget - used;
  const now = monthKey();
  const progress = month === now ? (new Date().getDate() - 0.5) / daysInMonth(month) : month < now ? 1 : 0;
  // Ce qu’on peut dépenser par jour d’ici la fin du mois, aujourd’hui compris.
  const daysLeft = month === now ? daysInMonth(month) - new Date().getDate() + 1 : 0;
  const perDay = daysLeft > 0 && available > 0 ? round2(available / daysLeft) : 0;
  const lastDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  const scale = Math.max(budget, used, 1);
  const fixed = fixedCats(data);
  const m = getMonth(data, month);
  const rest = toAllocate(data);
  const goals = goalProgress(data);
  const overCat = envs.find((c) => envelopeStatus(c, spent[c.id] ?? 0, budgets[c.id]).level === "over");
  const doneGoal = goals.find((g) => g.done);
  const [mood, line]: [Mood, string] =
    available < 0 || overCat
      ? [
          "inquiete",
          overCat
            ? `Aïe, « ${overCat.name} » est dépassée. Comble-la avec une autre enveloppe, ganbatte !`
            : "Aïe, tes enveloppes sont dans le rouge. On se reprend, ganbatte !",
        ]
      : doneGoal
        ? ["victoire", `Sugoi ! Objectif « ${doneGoal.goal.name} » atteint.`]
        : m.savingsDone > 0
          ? ["contente", "Épargne versée, yosh ! Continue comme ça."]
          : ["neutre", `Encore ${eur(available)} à dépenser ce mois-ci. Ganbatte !`];

  const toggleSavings = () => {
    updateData((d) => {
      const cur = d.months[month] ?? { expenses: [], savingsDone: 0, bonus: 0 };
      cur.savingsDone = cur.savingsDone > 0 ? 0 : d.savingsMonthly;
      d.months[month] = cur;
    }) || toast("Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 min-[860px]:grid-cols-[1.15fr_.85fr]">
      <div className="grid gap-4">
        <section aria-label="Disponible ce mois" className="speed-lines rounded-[24px] border-2 border-ink bg-hero px-5 pt-5 pb-5 text-on-hero shadow-ink">
          <p className="font-manga text-xl text-pop">Disponible dans tes enveloppes</p>
          <p className={`mt-1 font-manga text-[clamp(3.2rem,13vw,4.8rem)] leading-none tabular [text-shadow:3px_3px_0_var(--accent)] ${available < 0 ? "text-over" : ""}`}>
            {eur(available)}
          </p>
          <p className="mt-1.5 text-sm text-on-hero/75">
            {eur(used)} dépensés sur {eur(budget)}
          </p>
          {perDay > 0 && (
            <p className="mt-2 inline-block rounded-full border-2 border-pop px-3 py-1 text-sm font-semibold text-pop">
              ≈ {eur(perDay)} par jour jusqu’au {lastDay}
            </p>
          )}
          <div className="relative mt-5 mb-3 flex h-[30px] gap-1.5">
            {envs
              .filter((c) => budgets[c.id] > 0 || (spent[c.id] ?? 0) > 0)
              .map((c) => {
                const s = Math.max(0, spent[c.id] ?? 0);
                const b = budgets[c.id];
                const w = (Math.max(b, s) / scale) * 100;
                const f = b > 0 ? Math.min(1, s / b) * 100 : 100;
                return (
                  <div key={c.id} className="relative h-full min-w-[10px] overflow-hidden rounded-full" style={{ width: `${w}%`, color: colorFor(data, c.id) }} title={`${c.name} : ${eur(s)} sur ${eur(b)}`}>
                    <div className="absolute inset-0 bg-current opacity-30" />
                    <div className="absolute inset-y-0 left-0 bg-current" style={{ width: `${f}%` }} />
                  </div>
                );
              })}
            {progress > 0 && progress < 1 && <div className="absolute -top-1.5 -bottom-1.5 w-[3px] rounded bg-on-hero" style={{ left: `${progress * 100}%` }} title="Aujourd’hui" />}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.82rem] text-on-hero/80">
            {envs
              .filter((c) => budgets[c.id] > 0)
              .map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorFor(data, c.id) }} />
                  {c.name}
                </span>
              ))}
          </div>
        </section>

        <MascotSays mood={mood}>{line}</MascotSays>

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
              <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => setMove({})}>
                Déplacer
              </Button>
            )
          }
        >
          {envs.length === 0 && <p className="text-ink-2">Aucune enveloppe. Crée-en une dans les réglages.</p>}
          {envs.map((c) => {
            const s = spent[c.id] ?? 0;
            const st = envelopeStatus(c, s, budgets[c.id]);
            const changed = Math.abs(budgets[c.id] - c.budget) >= 0.01;
            const col = st.level === "over" ? "var(--over)" : st.level === "near" ? "var(--warn)" : colorFor(data, c.id);
            return (
              <div key={c.id} className="border-b border-line py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold">
                    <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: colorFor(data, c.id) }} />
                    {c.name}
                  </span>
                  <span className={`font-display font-semibold tabular ${st.level === "over" ? "text-over" : st.level === "near" ? "text-warn" : ""}`}>
                    {st.left < 0 ? `− ${eur(-st.left)}` : eur(st.left)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={st.ratio} color={col} />
                </div>
                <div className="mt-1 flex justify-between text-[0.82rem] text-ink-2">
                  <span>{eur(s)} dépensés</span>
                  <span>
                    sur {eur(budgets[c.id])}
                    {changed && <span className={budgets[c.id] > c.budget ? "text-save" : ""}> (prévu {eur(c.budget)})</span>}
                  </span>
                </div>
                {st.left < 0 && envs.length >= 2 && (
                  <Button variant="ghost" className="mt-2 px-3 py-1.5 text-left text-sm !whitespace-normal" onClick={() => setMove({ to: c.id, amount: -st.left })}>
                    Combler les {eur(-st.left)} avec une autre enveloppe
                  </Button>
                )}
              </div>
            );
          })}
          {fixed.length > 0 && (
            <details className="mt-2 border-t border-line pt-3">
              <summary className="flex cursor-pointer list-none justify-between font-semibold">
                <span>Charges fixes</span>
                <span className="tabular">{eur(sumBy(fixed, (c) => c.budget))}</span>
              </summary>
              {fixed.map((c) => (
                <div key={c.id} className="flex justify-between py-1.5 text-[0.92rem] text-ink-2">
                  <span>{c.name}</span>
                  <span className="tabular">{eur(c.budget)}</span>
                </div>
              ))}
            </details>
          )}
        </Panel>
      </div>

      <div className="grid gap-4">
        <Panel title="Épargne">
          <div className="mb-4 flex items-baseline justify-between rounded-2xl border-2 border-save bg-save-soft px-4 py-3 text-save">
            <span>Épargne totale</span>
            <b className="font-manga text-3xl tabular">{eur(totalSaved(data))}</b>
          </div>
          {data.savingsMonthly > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSavings}
                aria-pressed={m.savingsDone > 0}
                className={`grid h-7 w-7 flex-none place-items-center rounded-lg border-2 text-on-accent ${m.savingsDone > 0 ? "power-up border-ink bg-save" : "border-ink"}`}
              >
                {m.savingsDone > 0 ? "✓" : ""}
              </button>
              <span className="flex-1">
                Épargne {ofMonth(month)}
                <small className="block text-[0.8rem] text-ink-2">{m.savingsDone > 0 ? "Versée" : "Coche quand le virement est fait"}</small>
              </span>
              <b className="font-display tabular">{eur(m.savingsDone || data.savingsMonthly)}</b>
            </div>
          )}
          {goals.map((g) => (
            <div key={g.goal.id} className="mb-4 last:mb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span>{g.goal.name}</span>
                <b className="font-display text-xl tabular">{eur0(g.reached)}</b>
              </div>
              <div className="my-2">
                <Bar value={g.goal.target ? g.reached / g.goal.target : 0} color="var(--save)" height={14} />
              </div>
              <p className="text-sm text-ink-2">
                {g.done
                  ? "Objectif atteint. Sugoi !"
                  : g.monthsLeft > 0
                    ? `Objectif ${eur0(g.goal.target)}, encore ${g.monthsLeft} mois : ${eur0(g.perMonth)} par mois.`
                    : `Objectif ${eur0(g.goal.target)}, échéance dépassée.`}
              </p>
            </div>
          ))}
          {data.goals.length === 0 && <p className="text-sm text-ink-2">Ajoute un objectif dans les réglages pour suivre ta progression.</p>}
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
    <Panel>
      <p className="text-[0.95rem]">Yosh ! Note ta première dépense avec le bouton cyan. Montant, enveloppe, libellé : c’est tout.</p>
      <Button variant="ghost" className="mt-3" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="Ajouter une dépense"]')?.click()}>
        Ajouter une dépense
      </Button>
    </Panel>
  );
}
