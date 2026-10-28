import type { BankLine, ParseResult } from "./bankImport";
import { parseBankAmount, withRefs } from "./bankImport";
import { round2 } from "./format";

/** Un morceau de texte du PDF avec sa position (origine en bas à gauche, en points). */
export interface PdfItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

/** Lit le texte positionné de chaque page. pdf.js n’est chargé qu’à ce moment-là. */
export async function extractPdfItems(data: ArrayBuffer): Promise<PdfItem[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const pages: PdfItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items) {
      // Texte vide ou pivoté (mentions dans la marge) : hors du tableau des opérations.
      if (!("str" in it) || !it.str.trim() || Math.abs(it.transform[1]) > 0.01) continue;
      items.push({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], w: it.width });
    }
    pages.push(items);
  }
  await task.destroy();
  return pages;
}

const DATE = /^(\d{2})[/.](\d{2})(?:[/.](\d{2}|\d{4}))?$/;
const AMOUNT = /^[+\-−]?\s?\d{1,3}(?:[   .]\d{3})*[,.]\d{2}(?:\s?€)?$/;
const END = /^\s*(total des operations|nouveau solde|solde (crediteur|debiteur|final|au \d))/;
const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

interface Column {
  kind: "debit" | "credit" | "amount";
  center: number;
}

/** Lignes de texte : morceaux à la même hauteur (à 2 points près), de gauche à droite. */
function rowsOf(items: PdfItem[]) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PdfItem[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= 2) row.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

/** En-têtes « Débit », « Crédit » ou « Montant » de la page, s’il y en a. */
function columnsOf(rows: PdfItem[][]): Column[] | null {
  for (const row of rows) {
    const cols: Column[] = [];
    for (const it of row) {
      const t = plain(it.str);
      const kind = /^debit/.test(t) ? "debit" : /^credit/.test(t) ? "credit" : /^montant/.test(t) ? "amount" : null;
      if (kind) cols.push({ kind, center: it.x + it.w / 2 });
    }
    if (cols.some((c) => c.kind !== "amount") || cols.length === 1) return cols.sort((a, b) => a.center - b.center);
  }
  return null;
}

/**
 * Relevé PDF : chaque ligne qui commence par une date et porte un montant devient une opération.
 * Les montants sont alignés à droite sous leur en-tête : un montant appartient à la dernière colonne
 * dont le centre est à gauche de son bord droit. Les lignes de détail sans date sont ignorées.
 */
export function parsePdfStatement(pages: PdfItem[][]): ParseResult {
  const all = pages.flat().map((i) => i.str).join(" ");
  const fullDates = [...all.matchAll(/\b\d{2}\/(\d{2})\/(\d{4})\b/g)].map((m) => `${m[2]}-${m[1]}`).sort();
  const lastMonth = fullDates[fullDates.length - 1] ?? `${new Date().getFullYear()}-12`;

  const lines: Omit<BankLine, "ref">[] = [];
  let credits = 0;
  let cols: Column[] | null = null;
  let done = false;
  for (const items of pages) {
    if (done) break;
    const rows = rowsOf(items);
    cols = columnsOf(rows) ?? cols;
    for (const row of rows) {
      // Après le total ou le nouveau solde viennent des récapitulatifs (frais, opérations passées) à ne pas importer.
      if (END.test(plain(row.map((it) => it.str).join(" ")))) {
        done = true;
        break;
      }
      const m = row[0].str.match(DATE);
      if (!m) continue;
      const amounts = row.filter((it) => AMOUNT.test(it.str));
      if (amounts.length === 0) continue;
      const amt = amounts[amounts.length - 1];
      const value = parseBankAmount(amt.str);
      if (!value) continue;

      let debit: boolean;
      if (value < 0) debit = true;
      else if (cols && cols.some((c) => c.kind !== "amount")) {
        const right = amt.x + amt.w;
        const col = [...cols].reverse().find((c) => c.center < right) ?? cols[0];
        debit = col.kind !== "credit";
      } else debit = !/^\+/.test(amt.str);

      const date = fullDate(m, row, lastMonth);
      if (!date) continue;
      const label = row
        .filter((it) => it !== row[0] && !DATE.test(it.str) && !AMOUNT.test(it.str))
        .map((it) => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!debit) {
        credits++;
        continue;
      }
      lines.push({ date, amount: round2(Math.abs(value)), label });
    }
  }
  if (lines.length === 0 && credits === 0)
    return { lines: [], credits: 0, error: "Je n’ai trouvé aucune opération dans ce PDF. S’il s’agit d’un scan (image), il ne contient pas de texte lisible." };
  return { lines: withRefs(lines.map((l) => ({ ...l, ref: "" }))), credits };
}

/** « 08/09 » prend l’année d’une date complète de la même ligne (date de valeur), sinon celle du relevé. */
function fullDate(m: RegExpMatchArray, row: PdfItem[], lastMonth: string) {
  const [, d, mo, y] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  let year = y ? (y.length === 2 ? `20${y}` : y) : "";
  if (!year) {
    const other = row.map((it) => it.str.match(/^\d{2}[/.](\d{2})[/.](\d{4})$/)).find(Boolean);
    if (other) year = Number(mo) > Number(other[1]) + 6 ? String(Number(other[2]) - 1) : other[2];
    else {
      const [ly, lm] = lastMonth.split("-");
      year = Number(mo) > Number(lm) ? String(Number(ly) - 1) : ly;
    }
  }
  return `${year}-${mo}-${d}`;
}
