import { eur } from "./format";

/** Humeurs de la mascotte sur l’accueil et au bilan (« fierte » reste réservée à ses moments à part). */
export type MoodName = "neutre" | "contente" | "pensif" | "explique" | "inquiete" | "choquee" | "victoire";

export interface MoodEnvelope {
  name: string;
  budget: number;
  /** Ce qu’il reste (négatif = dépassement) */
  left: number;
  /** Part du budget déjà dépensée */
  ratio: number;
}

export interface MoodInput {
  /** Période affichée par rapport à aujourd’hui */
  when: "past" | "current" | "future";
  envelopes: MoodEnvelope[];
  /** Total disponible dans les enveloppes (négatif = budget de la période dépassé) */
  available: number;
  /** Part de la période écoulée (0 à 1) */
  progress: number;
  /** Jour courant dans la période (1 = jour de paie) et nombre de jours */
  day?: number;
  total?: number;
  /** Jours restants, aujourd’hui compris (période en cours) */
  daysLeft: number;
  /** Dernier jour de la période en toutes lettres (« 25 novembre ») */
  endLabel?: string;
  /** La période commence le jour de paie (jour de paie > 1) */
  payday?: boolean;
  savingsDone: boolean;
  /** Nom d’un objectif d’épargne atteint, s’il y en a un */
  goalReached?: string;
  /** Nombre d’opérations notées sur la période */
  expenseCount?: number;
  /** Enveloppes repassées dans le vert grâce à un déplacement fait dans les dernières 24 h */
  rescued?: string[];
  /** Périodes précédentes d’affilée sans aucun dépassement */
  streak?: number;
  /** Graine des variantes de phrases : change chaque jour, stable dans la journée */
  seed?: string;
}

export interface MoodResult {
  mood: MoodName;
  line: string;
  /** Teinte d’alerte du fond : rouge pour un dépassement ou une enveloppe vide, ambre pour un rythme trop rapide */
  alert: "over" | "warn" | null;
}

const EPS = 0.004;

/** « « Courses » », « « Courses » et « Sorties » », « « A », « B » et « C » ». */
function names(list: { name: string }[]) {
  const q = list.map((e) => `« ${e.name} »`);
  return q.length <= 1 ? q.join("") : `${q.slice(0, -1).join(", ")} et ${q[q.length - 1]}`;
}

/** Une variante de phrase par situation, qui change d’un jour à l’autre mais reste la même dans la journée. */
function variant(seed: string | undefined, key: string, options: string[]) {
  const s = `${seed ?? ""}|${key}`;
  let h = 0;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  return options[Math.abs(h) % options.length];
}

/** L’enveloppe qui peut combler un trou de `need` € : celle qui a le plus de marge (hors celle en difficulté). */
function donorFor(envelopes: MoodEnvelope[], except: string, need: number) {
  return envelopes.filter((e) => e.name !== except && e.budget > 0 && e.left >= need - EPS).sort((a, b) => b.left - a.left)[0];
}

/**
 * Choisit l’humeur et la phrase de la mascotte, de la situation la plus grave à la plus calme.
 * Alertes : budget dépassé, 2 enveloppes ou plus dans le rouge, ou une dépassée d’au moins 30 % → choquée (Yabai !) ;
 * une dépassée, une vide, plusieurs qui partent vite → inquiète (Daijōbu) ; une qui part vite → pensif, avec un rythme chiffré.
 * Sans alerte : premier jour (paie reçue), enveloppe sauvée, série de périodes réussies, première dépense à noter, objectif atteint,
 * fin de période, mi-période, épargne versée, sinon neutre.
 */
export function mascotMood(i: MoodInput): MoodResult {
  const active = i.envelopes.filter((e) => e.budget > 0);
  const over = active.filter((e) => e.left < -EPS);
  const empty = active.filter((e) => Math.abs(e.left) <= EPS);
  const fast = i.when === "current" ? active.filter((e) => e.left > EPS && e.ratio - i.progress > 0.15) : [];
  const until = i.endLabel ? `jusqu’au ${i.endLabel}` : "jusqu’à la fin de la période";
  const v = (key: string, options: string[]) => variant(i.seed, key, options);

  if (i.envelopes.length === 0) return { mood: "explique", line: "Crée ta première enveloppe dans les réglages, et c’est parti !", alert: null };

  if (i.when === "future")
    return { mood: "explique", line: "Cette période n’a pas encore commencé. Tes enveloppes seront prêtes le jour J.", alert: null };

  if (i.when === "past") {
    if (i.available < -EPS)
      return {
        mood: "choquee",
        line: v("past-total", [
          `Yabai ! Cette période a fini ${eur(-i.available)} au-dessus du budget. On fera mieux la prochaine fois !`,
          `Période terminée ${eur(-i.available)} dans le rouge. La prochaine, on la gère, ganbatte !`,
        ]),
        alert: null,
      };
    if (over.length)
      return {
        mood: "inquiete",
        line: `Période terminée avec ${over.length > 1 ? `${over.length} enveloppes dépassées` : "une enveloppe dépassée"} : ${names(over)}.`,
        alert: null,
      };
    return {
      mood: "contente",
      line: v("past-ok", [
        `Période bouclée sans dépassement${i.available > EPS ? `, avec ${eur(i.available)} non dépensés` : ""}. Yosh !`,
        `Aucune enveloppe dans le rouge sur cette période${i.available > EPS ? `, et ${eur(i.available)} de côté` : ""}. Sugoi !`,
      ]),
      alert: null,
    };
  }

  // ——— Période en cours : alertes, de la plus grave à la plus légère ———
  if (i.available < -EPS)
    return {
      mood: "choquee",
      line: v("total", [
        `Yabai ! Tu as dépassé tout ton budget de ${eur(-i.available)}. On freine tout ${until} !`,
        `Hein ?! ${eur(-i.available)} au-dessus de ton budget. Plus de dépenses d’envie ${until}.`,
      ]),
      alert: "over",
    };
  if (over.length >= 2) {
    const hole = over.reduce((s, e) => s - e.left, 0);
    return {
      mood: "choquee",
      line: v("multi", [
        `Yabai ! ${names(over)} sont dans le rouge (${eur(hole)} au total). Comble avec une autre enveloppe, vite !`,
        `Quoi ?! ${names(over)} ont débordé : ${eur(hole)} à rattraper. Déplace de l’argent depuis une enveloppe qui en a.`,
      ]),
      alert: "over",
    };
  }
  if (over.length === 1) {
    const o = over[0];
    const hole = -o.left;
    const donor = donorFor(i.envelopes, o.name, hole);
    const fix = donor ? `Prends-les dans « ${donor.name} », il y reste ${eur(donor.left)}.` : "Freine sur les autres enveloppes pour compenser.";
    if (hole >= 0.3 * o.budget)
      return { mood: "choquee", line: `Yabai ! « ${o.name} » explose : ${eur(hole)} de trop. ${fix}`, alert: "over" };
    return {
      mood: "inquiete",
      line: v("one-over", [`Aïe, « ${o.name} » est dépassée de ${eur(hole)}. ${fix}`, `Daijōbu, « ${o.name} » ne déborde que de ${eur(hole)}. ${fix}`]),
      alert: "over",
    };
  }
  if (empty.length)
    return {
      mood: "inquiete",
      line: v("empty", [
        `${names(empty)} ${empty.length > 1 ? "sont vides" : "est vide"} : plus rien à dépenser dedans ${until}.`,
        `Daijōbu, mais ${names(empty)} ${empty.length > 1 ? "sont à sec" : "est à sec"}. On n’y touche plus ${until}.`,
      ]),
      alert: "over",
    };
  if (fast.length >= 2)
    return {
      mood: "inquiete",
      line: v("multi-fast", [`${names(fast)} partent vite. Lève le pied quelques jours !`, `Hmm, ${names(fast)} filent trop vite. On ralentit un peu ?`]),
      alert: "warn",
    };
  if (fast.length === 1) {
    const f = fast[0];
    const spent = f.budget - f.left;
    const perDay = i.daysLeft > 0 ? f.left / i.daysLeft : f.left;
    const days = i.day ? ` en ${i.day} jour${i.day > 1 ? "s" : ""}` : "";
    return {
      mood: "pensif",
      line: v("one-fast", [
        `Hmm… « ${f.name} » : ${eur(spent)} partis${days}. Il reste ${eur(f.left)}, soit ${eur(perDay)} par jour ${until}.`,
        `« ${f.name} » part vite. Garde ${eur(perDay)} par jour et ça tiendra ${until}.`,
      ]),
      alert: "warn",
    };
  }

  // ——— Sans alerte : les bons moments ———
  if (i.day === 1)
    return {
      mood: "victoire",
      line: i.payday
        ? v("payday", [
            `Paie reçue ! Nouvelle période : ${eur(i.available)} dans tes enveloppes ${until}. Yosh !`,
            `Jour de paie ! ${eur(i.available)} prêts à partir en mission. Ganbatte !`,
          ])
        : `Nouvelle période ! ${eur(i.available)} dans tes enveloppes ${until}. Yosh !`,
      alert: null,
    };
  if (i.rescued?.length)
    return {
      mood: "contente",
      line: `Ouf, ${names(i.rescued.map((name) => ({ name })))} ${i.rescued.length > 1 ? "sont repassées" : "est repassée"} dans le vert. Bien joué !`,
      alert: null,
    };
  if ((i.streak ?? 0) >= 2 && (i.day ?? 99) <= 5)
    return { mood: "victoire", line: `Sugoi ! ${i.streak} périodes d’affilée sans dépassement. On continue la série ?`, alert: null };
  if (i.expenseCount === 0 && (i.day ?? 1) > 1)
    return { mood: "explique", line: "Rien de noté pour l’instant. Ajoute tes dépenses avec le bouton +, ou importe ton relevé.", alert: null };
  if (i.daysLeft === 1)
    return {
      mood: "contente",
      line: `Dernier jour ! Il te reste ${eur(i.available)}, et ${i.payday ? "demain c’est la paie" : "demain une nouvelle période commence"}. Yosh !`,
      alert: null,
    };
  if (i.daysLeft > 1 && i.daysLeft <= 3)
    return { mood: "contente", line: `Plus que ${i.daysLeft} jours et tout est sous contrôle. Yosh !`, alert: null };
  // Un objectif reste atteint pour toujours : on le fête seulement quand rien d’autre n’est à dire.
  if (i.goalReached) return { mood: "victoire", line: `Sugoi ! Objectif « ${i.goalReached} » atteint.`, alert: null };
  if (i.day && i.total && Math.abs(i.day - Math.round(i.total / 2)) <= 1) {
    const used = active.reduce((s, e) => s + Math.max(0, e.budget - e.left), 0);
    const budget = active.reduce((s, e) => s + e.budget, 0);
    const pct = budget > 0 ? Math.round((used / budget) * 100) : 0;
    return {
      mood: "pensif",
      line: `Mi-période : tu as utilisé ${pct} % de tes enveloppes pour ${Math.round(i.progress * 100)} % du temps écoulé. ${pct <= Math.round(i.progress * 100) ? "Ça roule !" : "Un peu rapide, surveille ça."}`,
      alert: null,
    };
  }
  if (i.savingsDone) return { mood: "contente", line: v("saved", ["Épargne versée, yosh ! Continue comme ça.", "Épargne mise de côté. Ton toi du futur te dit merci !"]), alert: null };
  const perDay = i.daysLeft > 0 ? i.available / i.daysLeft : 0;
  return {
    mood: "neutre",
    line: v("calm", [
      "Tu tiens le rythme. Ganbatte !",
      perDay > 0 ? `Tout roule : ${eur(perDay)} par jour ${until}.` : "Tout roule. Ganbatte !",
      "Rien à signaler. Continue comme ça !",
    ]),
    alert: null,
  };
}
