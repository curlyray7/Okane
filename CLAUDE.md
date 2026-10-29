# Okane : appli web de budget par enveloppes

## Produit
- Appli publique, gratuite, pour n'importe qui. Français uniquement, euros.
- Principe : chaque euro reçoit une mission (charges fixes, enveloppes de dépenses, épargne). « Reste à répartir » doit tomber à 0 €.
- Sans compte, sans backend : données dans le navigateur (localStorage, clé `yallah:v1`, gardée telle quelle depuis l’ancien nom Yallah pour ne pas perdre les données). Rien n'est pré-rempli.
- PWA installable + hors ligne (service worker `public/sw.js`).
- Prod : https://yallah-chi.vercel.app. Repo : github.com/curlyray7/Okane (privé, ex-Yallah). Chaque push sur `main` redéploie sur Vercel.

## Stack
Next.js 16.4 (App Router), React 19.3, TypeScript strict, Tailwind CSS 4.3 (@tailwindcss/postcss).
Seule autre dépendance runtime : `pdfjs-dist` (build legacy, version exacte), pour lire les relevés PDF ; chargée à la demande, uniquement quand on importe un PDF. Son worker est copié dans `public/pdf.worker.min.mjs` par `npm run pdf-worker` (lancé avant `dev` et `build`, fichier ignoré par Git). Ne pas ajouter d’autre dépendance sans raison forte.
Commandes : `npm run dev`, `npm run build`, `npm run typecheck`.

## Structure
- `app/` : layout (polices Bangers + Rubik via Google Fonts), page, `manifest.ts`, `globals.css` (tokens de couleur + thème clair/sombre), icônes.
- `components/` :
  - `App` : chargement → `Onboarding` si aucune donnée, sinon `Shell`.
  - `Onboarding` : questionnaire en 6 étapes (revenus, charges fixes, enveloppes, épargne, objectifs, récap).
  - `Shell` : navigation par mois + 4 onglets (`#accueil`, `#depenses`, `#bilan`, `#reglages`), bouton + cyan.
  - `Home`, `Expenses`, `Review` (bilan + historique 6 mois), `Settings` (brouillon + bouton Enregistrer).
  - `ExpenseSheet` : saisie montant + enveloppe + libellé ; la date est automatique. Bascule « Dépense / Rentrée d’argent » : remboursement (revient dans une enveloppe) ou rentrée en plus (ajoutée à une enveloppe ou à l’épargne).
  - `ImportSheet` : import d’un relevé bancaire CSV/OFX (onglet Dépenses), revue ligne par ligne avant d’importer.
  - `editors.tsx` + `draft.ts` : édition des listes et validation, partagés par Onboarding et Settings.
  - `ui.tsx` : Button, Panel, Bar, Alert, MoneyInput, Toast.
  - `MoveSheet` : déplacer de l’argent d’une enveloppe à une autre pour le mois affiché (bouton « Déplacer » des enveloppes, ou « Combler » sur une enveloppe dépassée) ; liste des déplacements du mois, annulables.
  - `SafetyTip` (accueil) : sur iPhone dans Safari, conseil d’ajouter l’app à l’écran d’accueil (masquable) ; sinon rappel de sauvegarde après 30 jours.
  - `Mascot.tsx` : mascotte (`neutre` | `contente` | `inquiete` | `victoire` | `fierte`) lue dans `public/mascotte/<mood>.png` (480 px, originaux pleine taille dans `design/mascotte/`), visage SVG de secours si l’image manque. `MascotSays` = mascotte en médaillon rond + bulle. Sur l’accueil, l’humeur suit le budget (dépassement → inquiète, objectif atteint → victoire, épargne cochée → contente). `fierte` apparaît au récap de l’onboarding quand chaque euro a sa mission, au bilan d’un mois terminé sans dépassement, et dans l’encart « Fait par… » des Réglages.
- `lib/` :
  - `types.ts` : `AppData` { incomes, categories (kind `fixed` | `envelope`, `rollover?` pour une enveloppe cumulative), goals, savingsMonthly, margin, initialSavings, months[YYYY-MM] { expenses, savingsDone, bonus, extras?, moves? }, rules?, ignoredImports? }.
  - `store.ts` : `useData` / `setData` / `updateData` via `useSyncExternalStore`.
  - `calc.ts` : tous les calculs (reste à répartir, dépensé par enveloppe, épargne totale, objectifs remplis par ordre de priorité, bilan).
  - `period.ts` : périodes budgétaires selon le jour de paie (`payday`, 1 par défaut = mois calendaire). Une période va du jour de paie à la veille du suivant (26 oct → 25 nov) et est rangée sous le mois où elle se termine (`2026-11`). `periodKeyOf(date)` pour ranger une opération, `currentPeriod`, `periodRange`, `periodTitle` (« 26 oct → 25 nov » ou « octobre 2026 »), `ofPeriod` / `inPeriod` pour les phrases, `periodProgress` (jour X sur N, jours restants), `rebucket` quand le jour de paie change.
  - `format.ts` : `eur`, `parseAmount` (accepte la virgule), helpers de mois (`ofMonth` pour l’élision : « d’octobre », « de mars »).
  - `theme.ts` : thème Auto / Clair / Sombre (Réglages → Apparence), retenu par appareil dans localStorage `okane:theme`, appliqué avant l’affichage par un script `beforeInteractive` du layout (`data-theme` sur `<html>`).
  - `backup.ts` : sauvegarde JSON (télécharger / restaurer, champ `lastBackupAt`), `navigator.storage.persist()` demandé dès qu’un budget existe.
  - `bankImport.ts` : lecture des relevés (CSV avec détection des colonnes, séparateur et encodage Windows-1252 ; OFX), libellés normalisés, règles de classement, détection des doublons.
  - `pdfStatement.ts` : relevés PDF. Lignes reconstruites à partir des positions du texte ; une opération = ligne qui commence par une date et porte un montant ; débit/crédit selon la colonne (en-têtes « Débit »/« Crédit ») ou le signe ; arrêt au « TOTAL DES OPÉRATIONS » / « NOUVEAU SOLDE » (les récapitulatifs qui suivent ne sont pas des opérations) ; texte pivoté de la marge ignoré. Vérifié sur un relevé Crédit Mutuel de Bretagne.

## Règles métier
- Toujours raisonner en périodes, jamais en mois calendaires : `months[k]` est une période, la clé d’une opération se calcule avec `periodKeyOf(date, paydayOf(d))` (jamais `date.slice(0, 7)`), la période en cours avec `currentPeriod` (jamais `monthKey()`). Avec un jour de paie > 1, l’en-tête affiche les dates et « Jour X sur N · paie le 26 ».
- Les charges fixes comptent comme dépensées automatiquement : on ne saisit que les dépenses d'enveloppes.
- L'épargne du mois est confirmée par une case à cocher (`savingsDone` stocke le montant).
- La dernière semaine de la période, le bilan propose de verser le non-dépensé des enveloppes en « épargne bonus » (`bonus`) : restes moins dépassements des enveloppes non cumulatives.
- Supprimer une catégorie garde ses dépenses (affichées « Catégorie supprimée »).
- Accueil, enveloppes de la période en cours : repère « aujourd’hui » dans chaque barre de vie (`LifeBar marker` = part de la période écoulée) ; barre orange + « Ça part vite » si la part dépensée dépasse de plus de 15 points la part de période écoulée, et la mascotte le dit aussi.
- Accueil : « ≈ X € par jour jusqu’au 25 novembre » = disponible des enveloppes ÷ jours restants de la période (aujourd’hui compris), période en cours seulement.
- Fin de l’onboarding : on arrive toujours sur l’accueil (`#accueil`), même si l’adresse gardait un autre onglet.
- Date d’une opération : modifiable (Aujourd’hui / Hier / sélecteur) ; changer de mois déplace la ligne dans `months[nouveau mois]`.
- « Reste à répartir » ≠ 0 : l’alerte propose « Mettre X € en épargne » (augmente l’épargne mensuelle) et « Répartir dans mes enveloppes ».
- Bilan : versement du non-dépensé proposé la dernière semaine de la période, mais elle n’est dite « bouclée » qu’une fois terminée.
- Rentrées d’argent, deux sortes : **remboursement** = dépense de montant négatif dans l’enveloppe (le disponible augmente). À l’écran, ne jamais afficher de « dépense » négative : achats et remboursements sont montrés séparément (`refundsByCategory`, `purchases` / `refunds` de `monthReview`) ; **rentrée en plus** = `months[k].extras` (cible : une enveloppe, dont le budget du mois augmente via `envelopeBudgets`, ou `SAVINGS`, compté dans `savedInMonth`). Les déplacements (`months[k].moves`) retirent d’une enveloppe et ajoutent à l’autre pour ce mois seulement, sans toucher au budget prévu ni au total. Une enveloppe cumulative (`rollover`) reçoit en plus ce qui restait — ou manquait — à la fin du mois précédent, calculé depuis `startMonth` (`rolledOver` pour l’afficher) ; son reste n’est pas proposé en épargne bonus au bilan. Toujours utiliser `envelopeBudgets(d, mois)` plutôt que `c.budget` pour le budget d’une enveloppe sur un mois. Le bilan ajoute une ligne « Rentrées en plus » au reste sur le compte courant.
- Import de relevé (PDF, CSV ou OFX) : tout se passe dans le navigateur, rien n’est envoyé. Proposition par ligne de dépense : doublon d’une saisie manuelle (même montant à 3 jours près) → ignorer ; règle apprise (`rules`, mot-clé du libellé → enveloppe ou `ignore`) ; libellé contenant le nom d’une charge fixe → ignorer ; sinon « À classer » (non importé). Chaque dépense importée garde `importId` ; les lignes ignorées vont dans `ignoredImports`, pour ne jamais reproposer une ligne déjà traitée. Les choix modifiés deviennent des règles, visibles et supprimables dans les Réglages. Les rentrées d’argent du relevé ont leur propre section et leurs propres règles (`on: "credit"`, cible `refund:<id>` / `extra:<id>` / `extra:savings` / `ignore`) : côté dépenses, un virement vers l’épargne (LIVRET, LDDS, PEL…) est proposé comme « Épargne du mois » : il n’est pas importé comme dépense et coche l’épargne du mois (`savingsDone` = max(actuel, total de ces virements du mois)). Côté rentrées, virement depuis l’épargne ou revenu prévu (SALAIRE, CAF, nom d’un revenu) → ignorer ; commerçant connu par une règle de dépense → remboursement dans la même enveloppe ; sinon à classer.

## Design (anime shōnen affiné : « une case de manga, le reste sur papier »)
- **Une seule case de manga par écran** : sur l’accueil (et la page d’accueil de l’onboarding), bloc `bg-hero` à cadre encré épais, traits de vitesse, ombre décalée ; la mascotte en autocollant (`.sticker`) sort du cadre par le coin, sa phrase dans une bulle blanche (`bg-bubble`). Tout le reste est posé sur le fond, sans cadre ni ombre (`Panel` = titre + contenu ; `soft` = léger fond pour une note).
- **Fond animé** (`Backdrop`, monté dans `App`) : pendant l’onboarding, « aura de combat » (deux nappes de lumière qui dérivent + traits de vitesse qui tournent, `.aura` / `.rays`) ; partout, une nuée de pétales de sakura portée par le vent, dans le style d’une photo de cerisiers en fleur : 48 pétales générés avec une graine fixe, 5 formes (ovale, goutte, recourbé, fin, éventail), 4 roses (`--sakura-1` à `--sakura-4`), trois plans (gros et flous devant, petits et pâles au fond), trajectoire en diagonale (`--drift`), balancement et rotation 3D sur un axe propre à chacun. Pas de forme de cœur, pas de pétales tous identiques. En cas d’alerte sur l’accueil, ~1 pétale sur 5 mélange son rose à `--aura-tone` (ambre si une enveloppe part vite, rouge si vide) ; quand tout va bien, tout reste rose. Animations CSS sur transform/opacity (pas de librairie) ; masquées avec `prefers-reduced-motion`. Essayés et refusés : cadre et grain de papier, bulles, pétales identiques.
- **« Ce qu’il reste » est toujours le plus gros chiffre** : montant de la case, reste de chaque enveloppe, « Reste sur le compte courant » en tête du bilan.
- **Enveloppes en barres de vie** (`LifeBar`, classes `.life`) : parallélogramme encré, crans de 10 %, pleine en début de période et qui se vide par la gauche ; cyan (ok), orange `--gauge-warn` (ça part vite), rouge pâle (vide). Repère « aujourd’hui » = part de la période écoulée, lu comme une frise : si la partie vide le dépasse, on dépense trop vite.
- **L’encre signale ce qui se touche** : contours `border-ink` et ombres décalées réservés aux boutons, champs, puces sélectionnées, bouton +, navigation, en-tête des fenêtres. Jamais sur un bloc d’information.
- Couleurs : papier `--bg`, encre `--ink` (#1a1330), nuit `--hero` (#1e1442), violet `--accent` (actions), cyan `--pop` (énergie), rouge `--over` (dépassement uniquement). Toujours via les tokens, jamais de couleur en dur. Tester clair et sombre.
- Typo : Bangers (`font-manga`) uniquement pour le montant de la case, le titre de période de l’en-tête, le gros montant des fenêtres de saisie et les grands titres d’onboarding. Rubik partout ailleurs, en casse normale ; titres de section en Rubik 700 (~18 px), intertitres de jour en 13 px gris. Pas d’étiquettes en majuscules.
- Animation : le fond en continu (lent, derrière le contenu), `.power-up` quand un cap est franchi (épargne versée, victoire) et la mascotte qui flotte ; le reste bouge quand on agit. Respecte `prefers-reduced-motion`.
- Ton : tutoiement, références anime et quelques mots japonais ponctuels (« Yosh ! », « Ganbatte ! », « Sugoi ! ») sans gêner la lecture. Apostrophes typographiques ’ dans les textes affichés.
- Mobile d’abord (vérifier qu’aucun écran ne déborde à 375 px), safe areas iOS gérées (`env(safe-area-inset-*)`).

## Hors périmètre V1 / pistes V2
Comptes + synchro (Supabase), synchro bancaire via un agrégateur DSP2 (Powens, Bridge…) en réutilisant le moteur de `bankImport.ts`, reste à vivre hebdo par enveloppe, virements récurrents à cocher, multi-devises.
