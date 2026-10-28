"use client";

import { SAVINGS, type AppData } from "@/lib/types";
import { categoryName, colorFor, getMonth, sumBy } from "@/lib/calc";
import { dayLabel, eur } from "@/lib/format";
import { inPeriod, paydayOf } from "@/lib/period";
import { Button } from "./ui";

interface Line {
  id: string;
  date: string;
  createdAt: number;
  label: string;
  amount: number;
  cat: string;
  extra: boolean;
  imported: boolean;
}

const where = (data: AppData, cat: string) => (cat === SAVINGS ? "Épargne" : categoryName(data, cat));

export function Expenses({ data, month, onEdit, onAdd, onImport }: { data: AppData; month: string; onEdit: (id: string) => void; onAdd: () => void; onImport: () => void }) {
  const m = getMonth(data, month);
  // Dépenses, remboursements (montant négatif) et rentrées en plus, dans une seule liste.
  const list: Line[] = [
    ...m.expenses.map((e) => ({ id: e.id, date: e.date, createdAt: e.createdAt, label: e.label, amount: e.amount, cat: e.categoryId, extra: false, imported: !!e.importId })),
    ...(m.extras ?? []).map((x) => ({ id: x.id, date: x.date, createdAt: x.createdAt, label: x.label, amount: x.amount, cat: x.target, extra: true, imported: !!x.importId })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const spent = sumBy(m.expenses, (e) => Math.max(0, e.amount));
  const refunded = sumBy(m.expenses, (e) => Math.max(0, -e.amount));
  const extras = sumBy(m.extras ?? [], (x) => x.amount);

  if (list.length === 0)
    return (
      <div className="mx-auto max-w-[640px] py-10 text-center">
        <p className="text-[1.05rem] font-semibold">Aucune opération {inPeriod(month, paydayOf(data))}</p>
        <p className="mt-1 text-[0.9rem] text-ink-2">Note une dépense avec le bouton +, ou importe ton relevé de compte.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Button variant="accent" onClick={onAdd}>
            Ajouter une dépense
          </Button>
          <Button variant="ghost" onClick={onImport}>
            Importer un relevé
          </Button>
        </div>
      </div>
    );

  const byDay = new Map<string, Line[]>();
  for (const e of list) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[0.85rem] text-ink-2">Dépensé {paydayOf(data) > 1 ? "sur la période" : "ce mois"}</p>
          <p className="text-[1.75rem] leading-tight font-bold tabular">{eur(spent)}</p>
          {(refunded > 0 || extras > 0) && (
            <p className="text-[0.85rem] text-save">
              {[refunded > 0 && `+${eur(refunded)} remboursés`, extras > 0 && `+${eur(extras)} en plus`].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <Button variant="ghost" className="px-3 py-2 text-sm" onClick={onImport}>
          Importer un relevé
        </Button>
      </div>
      {[...byDay.entries()].map(([day, items]) => (
        <section key={day} className="mb-6">
          <h3 className="mb-1 text-[0.82rem] font-semibold text-ink-2 first-letter:uppercase">{dayLabel(day)}</h3>
          <ul>
            {items.map((e) => (
              <li key={e.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => onEdit(e.id)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-2">
                  <i className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ background: e.cat === SAVINGS ? "var(--save)" : colorFor(data, e.cat) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.label || where(data, e.cat)}</span>
                    {/* Sans libellé, le nom de l’enveloppe est déjà le titre : on ne le répète pas. */}
                    {(e.label || e.extra || e.amount < 0 || e.imported) && (
                      <small className="block text-[0.78rem] text-ink-2">
                        {[e.extra ? "En plus" : e.amount < 0 ? "Remboursement" : "", e.label ? where(data, e.cat) : "", e.imported ? "relevé" : ""].filter(Boolean).join(" · ")}
                      </small>
                    )}
                  </span>
                  <span className={`font-semibold whitespace-nowrap tabular ${e.extra || e.amount < 0 ? "text-save" : ""}`}>
                    {e.extra || e.amount < 0 ? `+${eur(Math.abs(e.amount))}` : eur(e.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
