import { SAVINGS, type AppData, type ImportRule } from "./types";
import { round2 } from "./format";

/** Une dépense lue dans un relevé (montant positif). */
export interface BankLine {
  date: string;
  amount: number;
  label: string;
  ref: string;
}

export interface ParseResult {
  lines: BankLine[];
  /** Rentrées d'argent (revenus, virements reçus, remboursements), montant positif */
  credits: BankLine[];
  error?: string;
}

export const IGNORE = "ignore";

/** Lit un relevé PDF, ou un export texte en UTF-8 / Windows-1252 (la plupart des banques françaises). */
export async function readStatement(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  if (new TextDecoder().decode(buf.slice(0, 5)) === "%PDF-") {
    const { extractPdfItems, parsePdfStatement } = await import("./pdfStatement");
    try {
      return parsePdfStatement(await extractPdfItems(buf));
    } catch {
      return { lines: [], credits: [], error: "Impossible de lire ce PDF. S’il est protégé par un mot de passe, exporte-le à nouveau sans protection." };
    }
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }
  return parseStatement(text);
}

export function parseStatement(text: string): ParseResult {
  const t = text.replace(/^﻿/, "");
  const res = /<OFX>|<STMTTRN>/i.test(t) ? parseOfx(t) : parseCsv(t);
  if (!res.error && res.lines.length === 0 && res.credits.length === 0) res.error = "Aucune opération trouvée dans ce fichier.";
  return res;
}

/* ---------- OFX ---------- */

function ofxTag(block: string, tag: string) {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : "";
}

function parseOfx(text: string): ParseResult {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const lines: BankLine[] = [];
  const credits: BankLine[] = [];
  for (const b of blocks) {
    const amount = parseBankAmount(ofxTag(b, "TRNAMT"));
    const d = ofxTag(b, "DTPOSTED");
    if (!amount || !/^\d{8}/.test(d)) continue;
    const label = [ofxTag(b, "NAME"), ofxTag(b, "MEMO")].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    (amount > 0 ? credits : lines).push({ date, amount: round2(Math.abs(amount)), label: decodeEntities(label), ref: ofxTag(b, "FITID") || "" });
  }
  return { lines: withRefs(lines), credits: withRefs(credits, true) };
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "’").replace(/&quot;/g, "\"");
}

/* ---------- CSV ---------- */

function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === "\"" && line[i + 1] === "\"") {
        cur += "\"";
        i++;
      } else if (c === "\"") quoted = false;
      else cur += c;
    } else if (c === "\"") quoted = true;
    else if (c === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function findColumn(headers: string[], wanted: string[], avoid: string[] = []) {
  for (const w of wanted) {
    const i = headers.findIndex((h) => h.includes(w) && !avoid.some((a) => h.includes(a)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseCsv(text: string): ParseResult {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (rawLines.length === 0) return { lines: [], credits: [], error: "Le fichier est vide." };
  const sample = rawLines.slice(0, 20).join("\n");
  const sep = [";", "\t", ","].reduce((best, s) => (sample.split(s).length > sample.split(best).length ? s : best), ";");
  const rows = rawLines.map((l) => splitCsvLine(l, sep));

  // En-tête : première ligne (parmi les 15 premières) qui parle de date et de montant/débit.
  let headerIdx = -1;
  let col = { date: -1, label: -1, amount: -1, debit: -1, credit: -1 };
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const h = rows[i].map(plain);
    const date = findColumn(h, ["date operation", "date op", "dateop", "date"], ["valeur", "val"]);
    const amount = findColumn(h, ["montant", "amount", "somme"]);
    const debit = findColumn(h, ["debit"]);
    const credit = findColumn(h, ["credit"]);
    if (date >= 0 && (amount >= 0 || debit >= 0)) {
      const label = findColumn(h, ["libelle operation", "libelle", "label", "intitule", "description", "detail", "nature", "operation"], ["date", "categorie", "category"]);
      headerIdx = i;
      col = { date: date >= 0 ? date : findColumn(h, ["date"]), label, amount, debit, credit };
      break;
    }
  }
  if (headerIdx < 0) {
    const guessed = guessColumns(rows);
    if (!guessed) return { lines: [], credits: [], error: "Je n’ai pas reconnu les colonnes de ce relevé (date, libellé, montant)." };
    col = { ...guessed, debit: -1, credit: -1 };
  }

  const lines: BankLine[] = [];
  const credits: BankLine[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const date = parseBankDate(r[col.date] ?? "");
    if (!date) continue;
    let amount: number | null = null;
    if (col.amount >= 0) amount = parseBankAmount(r[col.amount] ?? "");
    if (amount === null && (col.debit >= 0 || col.credit >= 0)) {
      const d = col.debit >= 0 ? parseBankAmount(r[col.debit] ?? "") : null;
      const c = col.credit >= 0 ? parseBankAmount(r[col.credit] ?? "") : null;
      if (d) amount = -Math.abs(d);
      else if (c) amount = Math.abs(c);
    }
    if (amount === null || amount === 0) continue;
    const label = (col.label >= 0 ? r[col.label] : r.filter((_, i) => i !== col.date && i !== col.amount).sort((a, b) => b.length - a.length)[0]) ?? "";
    (amount > 0 ? credits : lines).push({ date, amount: round2(Math.abs(amount)), label: label.replace(/\s+/g, " ").trim(), ref: "" });
  }
  return { lines: withRefs(lines), credits: withRefs(credits, true) };
}

/** Sans en-tête reconnu : la colonne la plus souvent datée, la plus souvent chiffrée, et le texte le plus long. */
function guessColumns(rows: string[][]) {
  const data = rows.filter((r) => r.length >= 3).slice(0, 50);
  if (data.length === 0) return null;
  const width = Math.max(...data.map((r) => r.length));
  const score = (test: (v: string) => boolean) =>
    Array.from({ length: width }, (_, i) => data.filter((r) => test(r[i] ?? "")).length);
  const dates = score((v) => parseBankDate(v) !== null);
  const date = dates.indexOf(Math.max(...dates));
  const nums = score((v) => /\d/.test(v) && parseBankAmount(v) !== null && parseBankDate(v) === null).map((n, i) => (i === date ? -1 : n));
  const amount = nums.indexOf(Math.max(...nums));
  const lens = Array.from({ length: width }, (_, i) => (i === date || i === amount ? -1 : data.reduce((s, r) => s + (r[i] ?? "").length, 0)));
  const label = lens.indexOf(Math.max(...lens));
  if (dates[date] < data.length / 2 || nums[amount] < data.length / 2) return null;
  return { date, amount, label };
}

export function parseBankDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const month = Number(m[2]);
  const day = Number(m[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** « -1 234,56 », « 1.234,56 », « −12.5 € », « +3,00 »… */
export function parseBankAmount(v: string): number | null {
  let s = v.replace(/[\s  €]|EUR/gi, "").replace(/[−–]/g, "-");
  if (!/^[+-]?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    s = s.replace(dec === "," ? /\./g : /,/g, "").replace(",", ".");
  } else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Référence stable pour chaque ligne (FITID en OFX, sinon date + montant + libellé + rang ; « + » pour une rentrée). */
export function withRefs(lines: BankLine[], credit = false) {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    if (l.ref) return { ...l, ref: `ofx:${l.ref}` };
    const base = `${l.date}|${credit ? "+" : ""}${l.amount}|${normalizeLabel(l.label)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...l, ref: `csv:${hash(`${base}#${n}`)}` };
  });
}

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ---------- Classement ---------- */

const NOISE = /\b(CB|CARTE|PAIEMENT|ACHAT|PAR|FACTURE|PRLV|PRELEVEMENT|SEPA|VIR|VIREMENT|INST|RETRAIT|DAB|DU|LE|EUR|FR|X\d+)\b/g;

/** Libellé réduit à ses mots utiles : « CB CARREFOUR CITY 12/10 PARIS » → « CARREFOUR CITY PARIS ». */
export function normalizeLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b\w*\d\w*\b/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Premiers mots trop vagues seuls : formes juridiques, commerces génériques, intermédiaires de paiement. */
const GENERIC = new Set(
  "SARL SAS SASU EURL SNC STE CAFE BAR RESTAURANT RESTO BOULANGERIE PHARMACIE MAGASIN SUPER MARCHE STATION ESPACE SHOP BOUTIQUE GARAGE TABAC PRESSE SUMUP ZETTLE PAYPAL STRIPE SQUARE LYDIA PAYFIP WERO VERS DE LA LES DES AU AUX".split(" "),
);

/** Prépositions en tête de libellé (virements entre personnes). */
const LEADING = new Set("DE DES LA LES AU AUX VERS POUR".split(" "));

/**
 * Mot-clé retenu pour une nouvelle règle : le premier mot s’il est distinctif (« AUCHAN », « IKEA »),
 * sinon les deux premiers (« UBER EATS », « CAFE GOURMAND »).
 * `places` : derniers mots des libellés du relevé, souvent la ville, à ne pas retenir seuls.
 * Renvoie "" quand rien de fiable ne ressort (« P.E.S 33 BORDEAUX »).
 */
export function keywordFor(label: string, places: Set<string> = new Set(), specific = false) {
  let words = normalizeLabel(label).split(" ").filter((w) => w.length >= 2);
  // « VIR de EL YOUNSI », « vers JEAN EUDES » : on saute la préposition et on garde deux mots (un prénom seul est trop vague).
  const lead = words.findIndex((w) => !LEADING.has(w));
  if (lead > 0) {
    words = words.slice(lead);
    specific = true;
  }
  if (words.length === 0 || lead < 0) return "";
  const [a, b] = words;
  const vague = GENERIC.has(a) || places.has(a);
  if (!b) return vague ? "" : a;
  if (!specific && a.length >= 4 && !vague) return a;
  return a === b ? (vague ? "" : a) : `${a} ${b}`;
}

/** Le motif est-il présent comme suite de mots entiers (« LIDL » ne trouve pas « SOLIDLY ») ? */
const hasWords = (label: string, pattern: string) => ` ${label} `.includes(` ${pattern} `);

/** Derniers mots des libellés d’un relevé (souvent la ville). */
export function placesIn(labels: string[]) {
  const set = new Set<string>();
  for (const l of labels) {
    const w = normalizeLabel(l).split(" ");
    if (w.length > 1) set.add(w[w.length - 1]);
  }
  return set;
}

/** Libellé lisible pour la liste des dépenses. */
export function prettyLabel(label: string) {
  const words = normalizeLabel(label).split(" ");
  const lead = words.findIndex((w) => !LEADING.has(w));
  const n = (lead > 0 ? words.slice(lead) : words).join(" ");
  const s = (n || label).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return s.slice(0, 60);
}

export type Reason = "rule" | "fixed" | "duplicate" | "none";
export interface Suggestion {
  target: string;
  reason: Reason;
}

/** Proposition de classement : règle apprise, charge fixe, doublon d’une saisie manuelle, ou à classer. */
export function suggest(d: AppData, line: BankLine, manualTaken: Set<string>): Suggestion {
  const label = normalizeLabel(line.label);
  const valid = (t: string) => t === IGNORE || d.categories.some((c) => c.id === t && c.kind === "envelope");
  const rule = findRule(d, label, false, valid);

  const dup = findManualDuplicate(d, line, manualTaken);
  if (dup) {
    manualTaken.add(dup);
    return { target: IGNORE, reason: "duplicate" };
  }
  if (rule) return { target: rule.target, reason: "rule" };
  const fixed = d.categories.find((c) => {
    const n = normalizeLabel(c.name);
    return c.kind === "fixed" && n.length >= 3 && hasWords(label, n);
  });
  if (fixed) return { target: IGNORE, reason: "fixed" };
  return { target: "", reason: "none" };
}

function findRule(d: AppData, label: string, credit: boolean, valid: (t: string) => boolean) {
  return [...(d.rules ?? [])]
    .filter((r) => (r.on === "credit") === credit)
    .sort((a, b) => b.pattern.length - a.pattern.length)
    .find((r) => r.pattern && hasWords(label, r.pattern) && valid(r.target));
}

export type CreditReason = "rule" | "merchant" | "transfer" | "income" | "none";

const OWN_TRANSFER = /\b(LIVRET|LDDS?|LEP|PEL|CEL|EPARGNE|ASSURANCE VIE)\b/;
const INCOME = /\b(SALAIRE|PAIE|CAF|POLE EMPLOI|FRANCE TRAVAIL|PENSION|RETRAITE|ALLOCATION|BOURSE)\b/;

/**
 * Proposition pour une rentrée d’argent : règle apprise ; virement depuis un compte d’épargne ou revenu déjà prévu → ignorer ;
 * commerçant dont les dépenses vont dans une enveloppe (remboursement Uber Eats) → remboursement dans cette enveloppe ; sinon à classer.
 */
export function suggestCredit(d: AppData, line: BankLine): { target: string; reason: CreditReason } {
  const label = normalizeLabel(line.label);
  const env = (id: string) => d.categories.some((c) => c.id === id && c.kind === "envelope");
  const validCredit = (t: string) => {
    if (t === IGNORE || t === `extra:${SAVINGS}`) return true;
    const [kind, id] = t.split(":");
    return (kind === "refund" || kind === "extra") && env(id);
  };
  const rule = findRule(d, label, true, validCredit);
  if (rule) return { target: rule.target, reason: "rule" };
  if (OWN_TRANSFER.test(label)) return { target: IGNORE, reason: "transfer" };
  const incomeNames = d.incomes.map((i) => normalizeLabel(i.name)).filter((n) => n.length >= 3);
  if (INCOME.test(label) || incomeNames.some((n) => hasWords(label, n))) return { target: IGNORE, reason: "income" };
  const merchant = findRule(d, label, false, env);
  if (merchant) return { target: `refund:${merchant.target}`, reason: "merchant" };
  return { target: "", reason: "none" };
}

/** Dépense saisie à la main avec le même montant à 3 jours près. */
function findManualDuplicate(d: AppData, line: BankLine, taken: Set<string>) {
  const t = Date.parse(line.date);
  for (const m of Object.values(d.months)) {
    for (const e of m.expenses) {
      if (e.importId || taken.has(e.id) || Math.abs(e.amount - line.amount) > 0.004) continue;
      if (Math.abs(Date.parse(e.date) - t) <= 3 * 86400000) return e.id;
    }
  }
  return null;
}

export function alreadyImported(d: AppData) {
  const refs = new Set(d.ignoredImports ?? []);
  for (const m of Object.values(d.months)) {
    for (const e of m.expenses) if (e.importId) refs.add(e.importId);
    for (const x of m.extras ?? []) if (x.importId) refs.add(x.importId);
  }
  return refs;
}

/** Ajoute ou met à jour une règle pour ce mot-clé (règles des dépenses et des rentrées séparées). */
export function learnRule(rules: ImportRule[], pattern: string, target: string, id: () => string, credit = false) {
  if (!pattern) return;
  const existing = rules.find((r) => r.pattern === pattern && (r.on === "credit") === credit);
  if (existing) existing.target = target;
  else rules.push(credit ? { id: id(), pattern, target, on: "credit" } : { id: id(), pattern, target });
}
