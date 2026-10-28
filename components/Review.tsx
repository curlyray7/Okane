"use client";

import type { AppData } from "@/lib/types";
import { colorFor, envelopeCats, fixedCats, getMonth, monthReview, savedInMonth, sumBy } from "@/lib/calc";
import { addMonths, eur, monthKey, monthLabel, monthShort } from "@/lib/format";
import { updateData } from "@/lib/store";
import { Alert, Button, Panel, useToast } from "./ui";
import { MascotSays } from "./Mascot";

export function Review({ data, month }: { data: AppData; month: string }) {
  const toast = useToast();
  const r = monthReview(data, month);
  const m = getMonth(data, month);
  const now = monthKey();
  const ended = month < now || (month === now && new Date().getDate() >= 25);

  const setBonus = (amount: number) =>
    updateData((d) => {
      const cur = d.months[month] ?? { expenses: [], savingsDone: 0, bonus: 0 };
      cur.bonus = amount;
      d.months[month] = cur;
    });

  return (
    <div className="grid items-start gap-4 min-[860px]:grid-cols-[1.1fr_.9fr]">
      <div className="grid gap-4">
        {r.overruns.length === 0 && ended ? (
          <MascotSays mood="fierte">
            <span className="inline-block first-letter:uppercase">{monthLabel(month)}</span> bouclé sans aucun dépassement. Sugoi !
          </MascotSays>
        ) : r.overruns.length === 0 ? (
          <Alert tone="ok">Aucune enveloppe dépassée en {monthLabel(month)}. Yosh !</Alert>
        ) : (
          <Alert tone="bad">
            {r.overruns.length === 1 ? "Enveloppe dépassée : " : `${r.overruns.length} enveloppes dépassées : `}
            {r.overruns.map((o) => `${o.cat.name} (+${eur(o.by)})`).join(", ")}.
          </Alert>
        )}

        {m.bonus > 0 ? (
          <Alert
            tone="ok"
            action={
              <Button variant="ghost" onClick={() => setBonus(0)}>
                Annuler
              </Button>
            }
          >
            {eur(m.bonus)} ajoutés en épargne bonus. Pense à faire le virement vers ton épargne.
          </Alert>
        ) : r.leftover > 0 ? (
          <Alert
            tone={ended ? "ok" : "warn"}
            action={
              ended ? (
                <Button
                  variant="save"
                  onClick={() => {
                    setBonus(r.leftover);
                    toast("Épargne bonus enregistrée");
                  }}
                >
                  Ajouter {eur(r.leftover)} à l’épargne
                </Button>
              ) : undefined
            }
          >
            {ended
              ? `Il te reste ${eur(r.leftover)} non dépensés dans tes enveloppes.`
              : `Pour l’instant, ${eur(r.leftover)} non dépensés. Le bilan définitif est proposé à partir du 25.`}
          </Alert>
        ) : null}

        {data.savingsMonthly > 0 && m.savingsDone === 0 && (
          <Alert tone="warn">L’épargne du mois ({eur(data.savingsMonthly)}) n’est pas encore cochée comme versée. Tu peux la cocher sur l’accueil.</Alert>
        )}

        <Panel title={`Bilan de ${monthLabel(month)}`}>
          <Row label="Revenus prévus" value={eur(r.income)} />
          {r.extra > 0 && <Row label="Rentrées en plus" value={`+ ${eur(r.extra)}`} />}
          <Row label="Charges fixes" value={`− ${eur(r.fixed)}`} />
          <Row label="Dépenses des enveloppes" note={`budget ${eur(r.envBudget)}`} value={`− ${eur(r.envSpent)}`} />
          <Row label="Épargne versée" note={`prévu ${eur(r.plannedSavings)}`} value={`− ${eur(r.saved)}`} />
          <div className="flex justify-between pt-3 font-semibold">
            <span>Reste sur le compte courant</span>
            <span className={`font-display tabular ${r.balance < 0 ? "text-over" : "text-save"}`}>{eur(r.balance)}</span>
          </div>
        </Panel>

        <Panel title="Historique">
          <History data={data} month={month} />
        </Panel>
      </div>

      <Panel title="Par enveloppe">
        {envelopeCats(data).map((c) => {
          const s = r.spent[c.id] ?? 0;
          return (
            <div key={c.id} className="flex justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="flex items-center gap-2">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: colorFor(data, c.id) }} />
                {c.name}
              </span>
              <span className="tabular">
                <b className={`font-display ${s > r.budgets[c.id] ? "text-over" : ""}`}>{eur(s)}</b>
                <span className="text-sm text-ink-2"> / {eur(r.budgets[c.id])}</span>
              </span>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-2">
      <span className="min-w-0">
        {label} {note && <span className="text-sm text-ink-2">({note})</span>}
      </span>
      <b className="font-display font-semibold whitespace-nowrap tabular">{value}</b>
    </div>
  );
}

function History({ data, month }: { data: AppData; month: string }) {
  const fixed = sumBy(fixedCats(data), (c) => c.budget);
  const keys = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
  const rows = keys.map((k) => {
    const m = data.months[k];
    return { k, has: k >= data.startMonth && k <= monthKey(), spent: fixed + sumBy(m?.expenses ?? [], (e) => e.amount), saved: m ? savedInMonth(m) : 0 };
  });
  const max = Math.max(1, ...rows.filter((r) => r.has).map((r) => Math.max(r.spent, r.saved)));
  const W = 600;
  const H = 240;
  const pad = 36;
  const gw = (W - pad) / 6;
  const bw = Math.min(28, gw / 3);
  const y = (v: number) => H - pad - (v / max) * (H - pad - 16);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Dépenses et épargne des six derniers mois">
        <line x1={pad} x2={W} y1={H - pad} y2={H - pad} stroke="var(--line)" />
        {rows.map((r, i) => {
          const x = pad + i * gw + gw / 2;
          return (
            <g key={r.k}>
              {r.has ? (
                <>
                  <rect x={x - bw - 2} y={y(r.spent)} width={bw} height={H - pad - y(r.spent)} rx={4} fill="var(--accent)" stroke="var(--ink)" strokeWidth={2}>
                    <title>{`${monthShort(r.k)} : ${eur(r.spent)} dépensés`}</title>
                  </rect>
                  <rect x={x + 2} y={y(r.saved)} width={bw} height={H - pad - y(r.saved)} rx={4} fill="var(--pop)" stroke="var(--ink)" strokeWidth={2}>
                    <title>{`${monthShort(r.k)} : ${eur(r.saved)} épargnés`}</title>
                  </rect>
                </>
              ) : (
                <line x1={x - bw} x2={x + bw} y1={H - pad} y2={H - pad} stroke="var(--line)" strokeWidth={3} strokeLinecap="round" />
              )}
              <text x={x} y={H - 10} textAnchor="middle" fill="var(--ink-2)" fontSize="19" fontWeight={r.k === month ? 700 : 400}>
                {monthShort(r.k)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.82rem] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent" />
          Dépenses (charges + enveloppes)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-pop" />
          Épargne versée
        </span>
      </div>
    </>
  );
}
