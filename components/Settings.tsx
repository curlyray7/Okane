"use client";

import { useMemo, useState } from "react";
import type { AppData } from "@/lib/types";
import { setData, updateData } from "@/lib/store";
import { categoryName } from "@/lib/calc";
import { IGNORE } from "@/lib/bankImport";
import { SAVINGS } from "@/lib/types";
import { eur } from "@/lib/format";
import { AllocateAlert } from "./Onboarding";
import { GoalsEditor, RowsEditor } from "./editors";
import { Draft, dataToDraft, draftToData, draftTotals, validateDraft } from "./draft";
import { Alert, Button, MoneyInput, Panel, useToast } from "./ui";
import { Mascot } from "./Mascot";

export function Settings({ data }: { data: AppData }) {
  const toast = useToast();
  const initial = useMemo(() => dataToDraft(data), [data]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const totals = draftTotals(draft);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    const errs = validateDraft(draft);
    setErrors(errs);
    if (errs.length) return;
    const next = { ...data, ...draftToData(draft) };
    const ok = setData(next);
    setDraft(dataToDraft(next));
    toast(ok ? "Budget enregistré" : "Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
  };

  const wipe = () => {
    if (window.confirm("Effacer définitivement ton budget et toutes tes dépenses sur cet appareil ?")) setData(null);
  };

  return (
    <div className="mx-auto grid max-w-[760px] gap-4">
      <h1 className="font-manga text-[2rem] leading-none">Réglages</h1>
      <p className="-mt-2 text-sm text-ink-2">Modifie ce que tu veux, puis enregistre en bas de l’écran.</p>
      <AllocateAlert value={totals.toAllocate} />

      <Panel title="Revenus mensuels" action={<Sum v={totals.income} />}>
        <RowsEditor rows={draft.incomes} onChange={(incomes) => patch({ incomes })} namePlaceholder="ex. Salaire" addLabel="Ajouter un revenu" />
      </Panel>
      <Panel title="Charges fixes" action={<Sum v={totals.fixed} />}>
        <RowsEditor rows={draft.fixed} onChange={(fixed) => patch({ fixed })} namePlaceholder="ex. Loyer" addLabel="Ajouter une charge" />
      </Panel>
      <Panel title="Enveloppes" action={<Sum v={totals.envelopes} />}>
        <RowsEditor rows={draft.envelopes} onChange={(envelopes) => patch({ envelopes })} namePlaceholder="ex. Courses" addLabel="Ajouter une enveloppe" />
        <p className="mt-3 text-sm text-ink-2">Supprimer une enveloppe garde les dépenses déjà notées dans l’historique.</p>
      </Panel>
      <Panel title="Épargne">
        {(
          [
            ["savingsMonthly", "Épargne mensuelle", "Mise de côté chaque mois"],
            ["margin", "Marge de sécurité", "Reste sur le compte courant"],
            ["initialSavings", "Épargne de départ", "Ce que tu avais au début"],
          ] as const
        ).map(([k, label, hint]) => (
          <label key={k} className="grid grid-cols-[1fr_140px] items-center gap-3 border-b border-line py-2.5 last:border-b-0">
            <span>
              {label}
              <small className="block text-[0.8rem] text-ink-2">{hint}</small>
            </span>
            <MoneyInput value={draft[k]} placeholder="0" onChange={(v) => patch({ [k]: v } as Partial<Draft>)} />
          </label>
        ))}
      </Panel>
      <Panel title="Objectifs">
        <GoalsEditor rows={draft.goals} onChange={(goals) => patch({ goals })} />
      </Panel>

      {errors.length > 0 && (
        <Alert tone="bad">
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}

      {dirty && (
      <div className="sticky z-10 flex gap-2.5 rounded-2xl border-2 border-ink bg-surface p-3 shadow-ink" style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
        <Button variant="ghost" className="flex-1" onClick={() => { setDraft(initial); setErrors([]); }}>
          Annuler
        </Button>
        <Button variant="accent" className="flex-1" onClick={save}>
          Enregistrer
        </Button>
      </div>
      )}

      {(data.rules?.length ?? 0) > 0 && (
        <Panel title="Règles d’import">
          <p className="mb-2 text-sm text-ink-2">Apprises à chaque relevé importé : un mot du libellé range l’opération au bon endroit.</p>
          {data.rules!.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
              <span className="min-w-0 flex-1 truncate font-semibold">{r.pattern}</span>
              <span className="text-sm text-ink-2">→ {ruleTarget(data, r.target, r.on === "credit")}</span>
              <button
                type="button"
                aria-label={`Supprimer la règle ${r.pattern}`}
                className="h-8 w-8 flex-none rounded-full hover:bg-surface-2"
                onClick={() => updateData((d) => void (d.rules = (d.rules ?? []).filter((x) => x.id !== r.id)))}
              >
                ✕
              </button>
            </div>
          ))}
        </Panel>
      )}

      <Panel title="Données">
        <p className="text-[0.95rem] text-ink-2">
          Ton budget est enregistré uniquement dans ce navigateur. Vider les données du site ou changer d’appareil le fait disparaître.
        </p>
        <Button variant="danger" className="mt-4" onClick={wipe}>
          Effacer toutes mes données
        </Button>
      </Panel>
      <Panel title="Fait par…">
        <div className="flex items-center gap-4">
          <Mascot mood="fierte" size={112} framed />
          <p className="text-[0.95rem]">
            Okane est faite à la main, avec fierté, par son créateur. Gratuite, sans pub, et tes données restent chez toi.
          </p>
        </div>
      </Panel>
      <p className="text-center text-xs text-ink-2">Outil de suivi personnel, pas un conseil financier. Pour un placement ou un crédit, consulte un professionnel.</p>
    </div>
  );
}

function Sum({ v }: { v: number }) {
  return <span className="font-display font-semibold tabular text-ink-2">{eur(v)}</span>;
}

/** Libellé d’une règle d’import : « Courses », « Ignorer », « Remboursement · Sorties », « En plus · Épargne ». */
function ruleTarget(data: AppData, target: string, credit: boolean) {
  if (target === IGNORE) return credit ? "Rentrée ignorée" : "Ignorer";
  if (!credit) return categoryName(data, target);
  const [kind, id] = target.split(":");
  return `${kind === "refund" ? "Remboursement" : "En plus"} · ${id === SAVINGS ? "Épargne" : categoryName(data, id)}`;
}
