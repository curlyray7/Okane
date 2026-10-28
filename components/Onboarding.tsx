"use client";

import { useState } from "react";
import { setData } from "@/lib/store";
import { eur, eur0, monthKey, round2 } from "@/lib/format";
import { Alert, Button, MoneyInput } from "./ui";
import { GoalsEditor, RowsEditor, newGoalRow } from "./editors";
import { Draft, draftToData, draftTotals, emptyDraft, validateDraft } from "./draft";

const STEPS = ["welcome", "incomes", "fixed", "envelopes", "savings", "goals", "recap"] as const;
type Step = (typeof STEPS)[number];

export function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const idx = STEPS.indexOf(step);
  const totals = draftTotals(draft);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const next = () => {
    const scope = step === "welcome" || step === "recap" ? undefined : step;
    const errs = scope ? validateDraft(draft, scope) : [];
    setErrors(errs);
    if (errs.length) return;
    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setErrors([]);
    setStep(STEPS[Math.max(idx - 1, 0)]);
  };
  const finish = () => {
    const errs = validateDraft(draft);
    setErrors(errs);
    if (errs.length) return;
    setData({
      version: 1,
      createdAt: new Date().toISOString(),
      startMonth: monthKey(),
      months: {},
      ...draftToData(draft),
    });
  };

  const precaution = round2(3 * (totals.fixed + totals.envelopes));

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-16">
      {step !== "welcome" && (
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-ink-2">
            <button type="button" onClick={back} className="font-semibold">‹ Retour</button>
            <span>Étape {idx} sur {STEPS.length - 1}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-track">
            <div className="h-full bg-accent transition-all" style={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }} />
          </div>
        </div>
      )}

      {step === "welcome" && (
        <div className="pt-10">
          <Logo />
          <Facade />
          <h1 className="mt-8 font-display text-[2.8rem] leading-[1.02] font-black tracking-tight">
            Yallah, on range ton budget.
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink-2">
            Fini le balagan. Tu donnes une mission à chaque euro (charges, enveloppes, épargne), puis tu vois en un coup
            d’œil ce qu’il te reste.
          </p>
          <ul className="mt-6 space-y-2 text-[0.95rem]">
            <li>Cinq minutes pour créer ton budget.</li>
            <li>Aucun compte, aucune connexion bancaire.</li>
            <li>Tes données restent sur cet appareil.</li>
          </ul>
          <Button variant="accent" className="mt-8 w-full py-3.5 text-lg" onClick={next}>
            Yallah, on commence
          </Button>
        </div>
      )}

      {step === "incomes" && (
        <StepFrame title="Ce que tu gagnes chaque mois" hint="Salaire net, aides, pension… Uniquement ce qui revient tous les mois.">
          <RowsEditor rows={draft.incomes} onChange={(incomes) => patch({ incomes })} namePlaceholder="ex. Salaire" addLabel="Ajouter un revenu" />
          <Total label="Total des revenus" value={totals.income} />
        </StepFrame>
      )}

      {step === "fixed" && (
        <StepFrame title="Tes charges fixes" hint="Ce qui est prélevé tous les mois sans que tu y penses : loyer, téléphone, assurance, abonnements…">
          <RowsEditor rows={draft.fixed} onChange={(fixed) => patch({ fixed })} namePlaceholder="ex. Loyer" addLabel="Ajouter une charge" />
          <Remaining value={round2(totals.income - totals.fixed)} />
        </StepFrame>
      )}

      {step === "envelopes" && (
        <StepFrame title="Tes enveloppes de dépenses" hint="Les dépenses qui varient : courses, sorties, vêtements… Fixe un montant par mois pour chacune.">
          <RowsEditor rows={draft.envelopes} onChange={(envelopes) => patch({ envelopes })} namePlaceholder="ex. Courses" addLabel="Ajouter une enveloppe" />
          <Remaining value={round2(totals.income - totals.fixed - totals.envelopes)} />
        </StepFrame>
      )}

      {step === "savings" && (
        <StepFrame title="Ton épargne" hint="Ce qui reste après les charges et les enveloppes peut devenir de l’épargne.">
          <Field label="Épargne mensuelle" hint="Le montant que tu mets de côté chaque mois.">
            <MoneyInput value={draft.savingsMonthly} placeholder="0" onChange={(savingsMonthly) => patch({ savingsMonthly })} />
          </Field>
          <Field label="Marge de sécurité" hint="Laissée sur ton compte courant pour éviter le découvert. Facultatif.">
            <MoneyInput value={draft.margin} placeholder="0" onChange={(margin) => patch({ margin })} />
          </Field>
          <Field label="Épargne actuelle" hint="Ce que tu as déjà de côté aujourd’hui. Facultatif.">
            <MoneyInput value={draft.initialSavings} placeholder="0" onChange={(initialSavings) => patch({ initialSavings })} />
          </Field>
          <Remaining value={totals.toAllocate} final />
        </StepFrame>
      )}

      {step === "goals" && (
        <StepFrame title="Tes objectifs d’épargne" hint="Facultatif. Ton épargne remplit tes objectifs dans l’ordre de priorité.">
          {draft.goals.length === 0 && precaution > 0 && (
            <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-[0.95rem]">
              <p>
                Un conseil : commence par une <b>épargne de précaution</b> de 3 mois de dépenses, soit {eur0(precaution)} avec ton
                budget.
              </p>
              <Button
                variant="ghost"
                className="mt-3"
                onClick={() => patch({ goals: [{ ...newGoalRow(), name: "Épargne de précaution", target: String(precaution).replace(".", ",") }] })}
              >
                Ajouter cet objectif
              </Button>
            </div>
          )}
          <GoalsEditor rows={draft.goals} onChange={(goals) => patch({ goals })} />
        </StepFrame>
      )}

      {step === "recap" && (
        <StepFrame title="Ton budget mensuel" hint="Vérifie, puis lance-toi. Tout reste modifiable dans les réglages.">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <Line label="Revenus" value={totals.income} />
            <Line label="Charges fixes" value={-totals.fixed} />
            <Line label="Enveloppes" value={-totals.envelopes} />
            <Line label="Épargne" value={-totals.savings} />
            {totals.margin > 0 && <Line label="Marge de sécurité" value={-totals.margin} />}
            <div className="mt-2 flex justify-between border-t border-line pt-3 font-semibold">
              <span>Reste à répartir</span>
              <span className="font-display tabular">{eur(totals.toAllocate)}</span>
            </div>
          </div>
          <div className="mt-4">
            <AllocateAlert value={totals.toAllocate} />
          </div>
          {totals.income > 0 && totals.savings / totals.income < 0.05 && (
            <div className="mt-3">
              <Alert tone="warn">Ton épargne représente moins de 5 % de tes revenus. Même 20 € par mois créent une habitude.</Alert>
            </div>
          )}
        </StepFrame>
      )}

      {errors.length > 0 && (
        <div className="mt-4">
          <Alert tone="bad">
            <ul className="list-disc pl-4">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      {step !== "welcome" && (
        <div className="mt-8">
          {step === "recap" ? (
            <Button variant="accent" className="w-full py-3.5 text-lg" onClick={finish}>
              Commencer
            </Button>
          ) : (
            <Button variant="accent" className="w-full py-3.5 text-lg" onClick={next}>
              {step === "goals" && draft.goals.length === 0 ? "Passer cette étape" : "Continuer"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        <rect width="42" height="42" rx="12" fill="var(--accent)" />
        <circle cx="15" cy="16" r="7" fill="var(--sun)" />
        <path d="M24 23a10 10 0 0 1 10-10v10z" fill="#fff" />
        <rect x="8" y="28" width="26" height="6" rx="3" fill="#fff" />
      </svg>
      <span className="font-display text-2xl font-black tracking-tight">Yallah</span>
    </div>
  );
}

/** Façade de la Ville Blanche : balcons arrondis et fenêtres en bandeau. */
function Facade() {
  return (
    <svg viewBox="0 0 340 150" className="mt-8 block h-auto w-full max-w-[420px]" aria-hidden="true">
      <rect x="0" y="0" width="340" height="150" rx="24" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />
      <rect x="22" y="24" width="200" height="22" rx="11" fill="var(--accent)" />
      <rect x="22" y="62" width="150" height="22" rx="11" fill="var(--ink)" />
      <rect x="182" y="62" width="40" height="22" rx="11" fill="var(--sun)" />
      <rect x="22" y="100" width="110" height="22" rx="11" fill="var(--track)" />
      <rect x="22" y="100" width="64" height="22" rx="11" fill="var(--accent)" />
      <circle cx="282" cy="54" r="30" fill="var(--sun)" />
      <path d="M252 122a30 30 0 0 1 60 0z" fill="var(--ink)" />
    </svg>
  );
}

function StepFrame({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[1.9rem] leading-tight font-black tracking-tight">{title}</h1>
      <p className="mt-2 mb-6 text-ink-2">{hint}</p>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 grid grid-cols-[1fr_140px] items-center gap-3 border-b border-line pb-4">
      <span>
        {label}
        <small className="block text-[0.8rem] text-ink-2">{hint}</small>
      </span>
      {children}
    </label>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-6 flex justify-between rounded-2xl bg-surface p-4">
      <span>{label}</span>
      <b className="font-display tabular">{eur(value)}</b>
    </div>
  );
}

function Remaining({ value, final }: { value: number; final?: boolean }) {
  return (
    <div className={`mt-6 flex justify-between rounded-2xl p-4 ${value < 0 ? "bg-over-soft text-over" : "bg-surface"}`}>
      <span>{final ? "Reste à répartir" : "Il reste"}</span>
      <b className="font-display tabular">{eur(value)}</b>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-ink-2">{label}</span>
      <span className="tabular">{eur(value)}</span>
    </div>
  );
}

export function AllocateAlert({ value }: { value: number }) {
  if (Math.abs(value) < 0.01) return <Alert tone="ok">Chaque euro a une mission. Parfait.</Alert>;
  if (value > 0)
    return (
      <Alert tone="warn">
        {eur(value)} n’ont pas encore de mission. Ajoute-les à ton épargne ou à une enveloppe, sinon c’est le balagan assuré.
      </Alert>
    );
  return <Alert tone="bad">Tu prévois {eur(-value)} de plus que ce que tu gagnes. Réduis une enveloppe ou ton épargne.</Alert>;
}
