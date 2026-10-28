import type { AppData } from "./types";
import { isoDate } from "./format";

/** Fichier de sauvegarde : tout le budget, lisible et réimportable. */
interface BackupFile {
  app: "okane";
  exportedAt: string;
  data: AppData;
}

/** Télécharge le budget en JSON. Renvoie la date de la sauvegarde. */
export function downloadBackup(data: AppData) {
  const now = new Date().toISOString();
  const file: BackupFile = { app: "okane", exportedAt: now, data: { ...data, lastBackupAt: now } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `okane-sauvegarde-${isoDate()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return now;
}

/** Lit un fichier de sauvegarde ; lève une erreur lisible s’il ne ressemble pas à un budget Okane. */
export async function readBackup(file: File): Promise<AppData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("Ce fichier n’est pas une sauvegarde Okane (JSON illisible).");
  }
  const data = (parsed as Partial<BackupFile>)?.data ?? parsed;
  const d = data as Partial<AppData>;
  const ok =
    d &&
    d.version === 1 &&
    Array.isArray(d.incomes) &&
    Array.isArray(d.categories) &&
    Array.isArray(d.goals) &&
    typeof d.months === "object" &&
    d.months !== null &&
    typeof d.startMonth === "string";
  if (!ok) throw new Error("Ce fichier n’est pas une sauvegarde Okane valide.");
  return d as AppData;
}

/**
 * Demande au navigateur de ne pas effacer les données du site quand il manque de place
 * (Safari les efface sinon après 7 jours sans visite, hors app ajoutée à l’écran d’accueil).
 */
export async function persistStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** iPhone / iPad dans Safari, sans l’app installée sur l’écran d’accueil. */
export function isIosBrowser() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

/** Jours écoulés depuis une date ISO. */
export const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : Infinity);
