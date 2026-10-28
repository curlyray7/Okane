"use client";

import { useSyncExternalStore } from "react";
import type { AppData } from "./types";

const KEY = "yallah:v1";
let cache: AppData | null | undefined;
const listeners = new Set<() => void>();

function read(): AppData | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AppData;
    return data && data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

function getSnapshot() {
  if (cache === undefined) cache = read();
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Enregistre les données. Renvoie false si le navigateur refuse l'écriture. */
export function setData(next: AppData | null): boolean {
  let ok = true;
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    ok = false;
  }
  cache = next;
  listeners.forEach((l) => l());
  return ok;
}

export function updateData(fn: (draft: AppData) => void): boolean {
  const current = getSnapshot();
  if (!current) return false;
  const draft = structuredClone(current);
  fn(draft);
  return setData(draft);
}

/** undefined pendant le rendu serveur, null si aucun budget n'existe encore. */
export function useData() {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
