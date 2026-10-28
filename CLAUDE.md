# Okane : appli web de budget par enveloppes

## Produit
- Appli publique, gratuite, pour n'importe qui. Français uniquement, euros.
- Principe : chaque euro reçoit une mission (charges fixes, enveloppes de dépenses, épargne). « Reste à répartir » doit tomber à 0 €.
- Sans compte, sans backend : données dans le navigateur (localStorage, clé `yallah:v1`, gardée telle quelle depuis l’ancien nom Yallah pour ne pas perdre les données). Rien n'est pré-rempli.
- PWA installable + hors ligne (service worker `public/sw.js`).
- Prod : https://yallah-chi.vercel.app. Repo : github.com/curlyray7/Yallah (privé). Chaque push sur `main` redéploie sur Vercel.

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
  - `SafetyTip` (accueil) : sur iPhone dans Safari, conseil d’ajouter l’app à l’écran d’accueil (masquable) ; sinon rappel de sauvegarde après 30 jours.
  - `Mascot.tsx` : mascotte (`neutre` | `contente` | `inquiete` | `victoire` | `fierte`) lue dans `public/mascotte/<mood>.png` (480 px, originaux pleine taille dans `design/mascotte/`), visage SVG de secours si l’image manque. `MascotSays` = mascotte en médaillon rond + bulle. Sur l’accueil, l’humeur suit le budget (dépassement → inquiète, objectif atteint → victoire, épargne cochée → contente). `fierte` (drapeau israélien, kippa) apparaît au récap de l’onboarding quand chaque euro a sa mission, au bilan d’un mois terminé sans dépassement, et dans l’encart « Fait par… » des Réglages.
- `lib/` :
  - `types.ts` : `AppData` { incomes, categories (kind `fixed` | `envelope`), goals, savingsMonthly, margin, initialSavings, months[YYYY-MM] { expenses, savingsDone, bonus, extras? }, rules?, ignoredImports? }.
  - `store.ts` : `useData` / `setData` / `updateData` via `useSyncExternalStore`.
  - `calc.ts` : tous les calculs (reste à répartir, dépensé par enveloppe, épargne totale, objectifs remplis par ordre de priorité, bilan).
  - `format.ts` : `eur`, `parseAmount` (accepte la virgule), helpers de mois (`ofMonth` pour l’élision : « d’octobre », « de mars »).
  - `backup.ts` : sauvegarde JSON (télécharger / restaurer, champ `lastBackupAt`), `navigator.storage.persist()` demandé dès qu’un budget existe.
  - `bankImport.ts` : lecture des relevés (CSV avec détection des colonnes, séparateur et encodage Windows-1252 ; OFX), libellés normalisés, règles de classement, détection des doublons.
  - `pdfStatement.ts` : relevés PDF. Lignes reconstruites à partir des positions du texte ; une opération = ligne qui commence par une date et porte un montant ; débit/crédit selon la colonne (en-têtes « Débit »/« Crédit ») ou le signe ; arrêt au « TOTAL DES OPÉRATIONS » / « NOUVEAU SOLDE » (les récapitulatifs qui suivent ne sont pas des opérations) ; texte pivoté de la marge ignoré. Vérifié sur un relevé Crédit Mutuel de Bretagne.

## Règles métier
- Les charges fixes comptent comme dépensées automatiquement : on ne saisit que les dépenses d'enveloppes.
- L'épargne du mois est confirmée par une case à cocher (`savingsDone` stocke le montant).
- À partir du 25, le bilan propose de verser le non-dépensé des enveloppes en « épargne bonus » (`bonus`).
- Supprimer une catégorie garde ses dépenses (affichées « Catégorie supprimée »).
- Date d’une opération : modifiable (Aujourd’hui / Hier / sélecteur) ; changer de mois déplace la ligne dans `months[nouveau mois]`.
- « Reste à répartir » ≠ 0 : l’alerte propose « Mettre X € en épargne » (augmente l’épargne mensuelle) et « Répartir dans mes enveloppes ».
- Bilan : versement du non-dépensé proposé dès le 25, mais le mois n’est dit « bouclé » qu’une fois terminé.
- Rentrées d’argent, deux sortes : **remboursement** = dépense de montant négatif dans l’enveloppe (le dépensé baisse) ; **rentrée en plus** = `months[k].extras` (cible : une enveloppe, dont le budget du mois augmente via `envelopeBudgets`, ou `SAVINGS`, compté dans `savedInMonth`). Toujours utiliser `envelopeBudgets(d, mois)` plutôt que `c.budget` pour le budget d’une enveloppe sur un mois. Le bilan ajoute une ligne « Rentrées en plus » au reste sur le compte courant.
- Import de relevé (PDF, CSV ou OFX) : tout se passe dans le navigateur, rien n’est envoyé. Proposition par ligne de dépense : doublon d’une saisie manuelle (même montant à 3 jours près) → ignorer ; règle apprise (`rules`, mot-clé du libellé → enveloppe ou `ignore`) ; libellé contenant le nom d’une charge fixe → ignorer ; sinon « À classer » (non importé). Chaque dépense importée garde `importId` ; les lignes ignorées vont dans `ignoredImports`, pour ne jamais reproposer une ligne déjà traitée. Les choix modifiés deviennent des règles, visibles et supprimables dans les Réglages. Les rentrées d’argent du relevé ont leur propre section et leurs propres règles (`on: "credit"`, cible `refund:<id>` / `extra:<id>` / `extra:savings` / `ignore`) : virement depuis l’épargne (LIVRET, LDDS…) ou revenu prévu (SALAIRE, CAF, nom d’un revenu) → ignorer ; commerçant connu par une règle de dépense → remboursement dans la même enveloppe ; sinon à classer.

## Design (anime shōnen, effets dosés)
- Violet électrique `--accent`, cyan `--pop` (bouton +, highlights), bloc héros `--hero` (violet nuit) avec `--on-hero`, noir `--ink`. Rouge `--over` réservé aux dépassements.
- Style encré : contours `border-2 border-ink`, ombres décalées `shadow-ink` / `shadow-ink-sm` (couleur `--shade`, violet en sombre), boutons qui s’enfoncent au clic.
- Effets : `.speed-lines` (traits de vitesse), `.power-up` (saut + aura à un cap franchi), `.float` (mascotte). Respectent `prefers-reduced-motion`.
- Typo : Bangers (`font-manga`) pour titres et gros montants, Rubik pour le reste et les montants en liste.
- Toujours passer par les tokens CSS (`bg-surface`, `text-ink-2`, etc.), jamais de couleur en dur. Tester le clair et le sombre.
- Ton : tutoiement, références anime et quelques mots japonais ponctuels (« Yosh ! », « Ganbatte ! », « Sugoi ! ») sans gêner la lecture. Apostrophes typographiques ’ dans les textes affichés.
- Mobile d'abord, safe areas iOS gérées (`env(safe-area-inset-*)`).

## Hors périmètre V1 / pistes V2
Comptes + synchro (Supabase), synchro bancaire via un agrégateur DSP2 (Powens, Bridge…) en réutilisant le moteur de `bankImport.ts`, reste à vivre hebdo, virements récurrents à cocher, multi-devises.
