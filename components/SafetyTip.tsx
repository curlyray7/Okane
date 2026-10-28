"use client";

import { useEffect, useState } from "react";
import type { AppData } from "@/lib/types";
import { daysSince, downloadBackup, isIosBrowser } from "@/lib/backup";
import { updateData } from "@/lib/store";
import { Button, Panel, useToast } from "./ui";

const HIDE_IOS = "okane:hide-ios-tip";

/**
 * Protège les données : sur iPhone dans Safari, conseille d’ajouter Okane à l’écran d’accueil
 * (sinon Safari peut tout effacer après 7 jours sans visite) ; sinon rappelle la sauvegarde au bout de 30 jours.
 */
export function SafetyTip({ data }: { data: AppData }) {
  const toast = useToast();
  const [tip, setTip] = useState<"ios" | "backup" | null>(null);

  useEffect(() => {
    let hidden = false;
    try {
      hidden = localStorage.getItem(HIDE_IOS) === "1";
    } catch {
      /* stockage indisponible : on affiche le conseil */
    }
    if (isIosBrowser() && !hidden) setTip("ios");
    else if (daysSince(data.lastBackupAt) > 30 && daysSince(data.createdAt) > 14) setTip("backup");
    else setTip(null);
  }, [data.lastBackupAt, data.createdAt]);

  if (tip === "ios")
    return (
      <Panel title="Garde tes données" soft>
        <p className="text-[0.93rem]">
          Sur iPhone, ajoute Okane à ton écran d’accueil : bouton <b>Partager</b>, puis <b>Sur l’écran d’accueil</b>. Sinon, Safari peut effacer
          ton budget après 7 jours sans l’ouvrir.
        </p>
        <Button
          variant="ghost"
          className="mt-3"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_IOS, "1");
            } catch {
              /* tant pis, il réapparaîtra */
            }
            setTip(null);
          }}
        >
          C’est fait
        </Button>
      </Panel>
    );

  if (tip === "backup")
    return (
      <Panel title="Petite sauvegarde ?" soft>
        <p className="text-[0.93rem]">
          {data.lastBackupAt ? `Ta dernière sauvegarde date de ${daysSince(data.lastBackupAt)} jours.` : "Tu n’as encore jamais sauvegardé ton budget."} Un
          fichier sur ton téléphone suffit pour tout retrouver en cas de pépin.
        </p>
        <Button
          variant="accent"
          className="mt-3"
          onClick={() => {
            const at = downloadBackup(data);
            updateData((d) => void (d.lastBackupAt = at));
            toast("Sauvegarde téléchargée. Yosh !");
          }}
        >
          Télécharger ma sauvegarde
        </Button>
      </Panel>
    );

  return null;
}
