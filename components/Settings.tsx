"use client";

import { useMemo, useState } from "react";
import type { AppData } from "@/lib/types";
import { setData } from "@/lib/store";
import { eur } from "@/lib/format";
import { AllocateAlert } from "./Onboarding";
import { GoalsEditor, RowsEditor } from "./editors";
import { Draft, dataToDraft, draftToData, draftTotals, validateDraft } from "./draft";
import { Alert, Button, MoneyInput, Panel, useToast } from "./ui";

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
      <h1 className="font-display text-2xl font-semibold">Réglages</h1>
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
      <div className="sticky z-10 flex gap-2.5 rounded-2xl border border-line bg-surface p-3" style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
        <Button variant="ghost" className="flex-1" onClick={() => { setDraft(initial); setErrors([]); }}>
          Annuler
        </Button>
        <Button variant="accent" className="flex-1" onClick={save}>
          Enregistrer
        </Button>
      </div>
      )}

      <Panel title="Données">
        <p className="text-[0.95rem] text-ink-2">
          Ton budget est enregistré uniquement dans ce navigateur. Vider les données du site ou changer d’appareil le fait disparaître.
        </p>
        <Button variant="danger" className="mt-4" onClick={wipe}>
          Effacer toutes mes données
        </Button>
      </Panel>
      <p className="text-center text-xs text-ink-2">Outil de suivi personnel, pas un conseil financier. Pour un placement ou un crédit, consulte un professionnel.</p>
    </div>
  );
}

function Sum({ v }: { v: number }) {
  return <span className="font-display font-semibold tabular text-ink-2">{eur(v)}</span>;
}
