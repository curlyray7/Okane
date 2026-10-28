"use client";

import type { AppData } from "@/lib/types";
import { colorFor, envelopeCats, envelopeStatus, fixedCats, getMonth, goalProgress, spentByCategory, sumBy, toAllocate, totalSaved } from "@/lib/calc";
import { daysInMonth, eur, eur0, monthKey, monthLabel } from "@/lib/format";
import { updateData } from "@/lib/store";
import { AllocateAlert } from "./Onboarding";
import { Bar, Button, Panel, useToast } from "./ui";

export function Home({ data, month }: { data: AppData; month: string }) {
  const toast = useToast();
  const envs = envelopeCats(data);
  const spent = spentByCategory(data, month);
  const budget = sumBy(envs, (c) => c.budget);
  const used = sumBy(envs, (c) => spent[c.id] ?? 0);
  const available = budget - used;
  const now = monthKey();
  const progress = month === now ? (new Date().getDate() - 0.5) / daysInMonth(month) : month < now ? 1 : 0;
  const scale = Math.max(budget, used, 1);
  const fixed = fixedCats(data);
  const m = getMonth(data, month);
  const rest = toAllocate(data);

  const toggleSavings = () => {
    updateData((d) => {
      const cur = d.months[month] ?? { expenses: [], savingsDone: 0, bonus: 0 };
      cur.savingsDone = cur.savingsDone > 0 ? 0 : d.savingsMonthly;
      d.months[month] = cur;
    }) || toast("Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
  };

  return (
    <div className="grid items-start gap-4 min-[860px]:grid-cols-[1.15fr_.85fr]">
      <div className="grid gap-4">
        <section aria-label="Disponible ce mois" className="rounded-[28px] bg-ink px-5 pt-5 pb-5 text-surface">
          <p className="text-[0.95rem] text-surface/70">Disponible dans tes enveloppes</p>
          <p className={`mt-1.5 font-display text-[clamp(2.8rem,11vw,4.2rem)] leading-none font-black tracking-tight tabular ${available < 0 ? "text-over" : ""}`}>
            {eur(available)}
          </p>
          <p className="mt-1.5 text-sm text-surface/70">
            {eur(used)} dépensés sur {eur(budget)}
          </p>
          <div className="relative mt-5 mb-3 flex h-[30px] gap-1.5">
            {envs
              .filter((c) => c.budget > 0 || (spent[c.id] ?? 0) > 0)
              .map((c) => {
                const s = spent[c.id] ?? 0;
                const w = (Math.max(c.budget, s) / scale) * 100;
                const f = c.budget > 0 ? Math.min(1, s / c.budget) * 100 : 100;
                return (
                  <div key={c.id} className="relative h-full min-w-[10px] overflow-hidden rounded-full" style={{ width: `${w}%`, color: colorFor(data, c.id) }} title={`${c.name} : ${eur(s)} sur ${eur(c.budget)}`}>
                    <div className="absolute inset-0 bg-current opacity-30" />
                    <div className="absolute inset-y-0 left-0 bg-current" style={{ width: `${f}%` }} />
                  </div>
                );
              })}
            {progress > 0 && progress < 1 && <div className="absolute -top-1.5 -bottom-1.5 w-[3px] rounded bg-surface" style={{ left: `${progress * 100}%` }} title="Aujourd’hui" />}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.82rem] text-surface/75">
            {envs
              .filter((c) => c.budget > 0)
              .map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorFor(data, c.id) }} />
                  {c.name}
                </span>
              ))}
          </div>
        </section>

        {Math.abs(rest) >= 0.01 && <AllocateAlert value={rest} />}

        <Panel title="Enveloppes">
          {envs.length === 0 && <p className="text-ink-2">Aucune enveloppe. Crée-en une dans les réglages.</p>}
          {envs.map((c) => {
            const s = spent[c.id] ?? 0;
            const st = envelopeStatus(c, s);
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
                  <span>sur {eur(c.budget)}</span>
                </div>
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
          <div className="mb-4 flex items-baseline justify-between rounded-2xl bg-save-soft px-4 py-3 text-save">
            <span>Épargne totale</span>
            <b className="font-display text-2xl tabular">{eur(totalSaved(data))}</b>
          </div>
          {data.savingsMonthly > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSavings}
                aria-pressed={m.savingsDone > 0}
                className={`grid h-7 w-7 flex-none place-items-center rounded-lg border-2 text-on-accent ${m.savingsDone > 0 ? "border-save bg-save" : "border-line"}`}
              >
                {m.savingsDone > 0 ? "✓" : ""}
              </button>
              <span className="flex-1">
                Épargne de {monthLabel(month)}
                <small className="block text-[0.8rem] text-ink-2">{m.savingsDone > 0 ? "Versée" : "Coche quand le virement est fait"}</small>
              </span>
              <b className="font-display tabular">{eur(m.savingsDone || data.savingsMonthly)}</b>
            </div>
          )}
          {goalProgress(data).map((g) => (
            <div key={g.goal.id} className="mb-4 last:mb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span>{g.goal.name}</span>
                <b className="font-display text-xl tabular">{eur0(g.reached)}</b>
              </div>
              <div className="my-2">
                <Bar value={g.goal.target ? g.reached / g.goal.target : 0} color="var(--save)" height={10} />
              </div>
              <p className="text-sm text-ink-2">
                {g.done
                  ? "Objectif atteint."
                  : g.monthsLeft > 0
                    ? `Objectif ${eur0(g.goal.target)}, encore ${g.monthsLeft} mois : ${eur0(g.perMonth)} par mois.`
                    : `Objectif ${eur0(g.goal.target)}, échéance dépassée.`}
              </p>
            </div>
          ))}
          {data.goals.length === 0 && <p className="text-sm text-ink-2">Ajoute un objectif dans les réglages pour suivre ta progression.</p>}
        </Panel>
        <QuickTip data={data} month={month} />
      </div>
    </div>
  );
}

function QuickTip({ data, month }: { data: AppData; month: string }) {
  const m = getMonth(data, month);
  if (m.expenses.length > 0) return null;
  return (
    <Panel>
      <p className="text-[0.95rem]">Yallah, note ta première dépense avec le bouton jaune. Montant, enveloppe, libellé : c’est tout.</p>
      <Button variant="ghost" className="mt-3" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="Ajouter une dépense"]')?.click()}>
        Ajouter une dépense
      </Button>
    </Panel>
  );
}
