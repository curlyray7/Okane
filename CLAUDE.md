# Okane : appli web de budget par enveloppes

## Produit
- Appli publique, gratuite, pour n'importe qui. Français uniquement, euros.
- Principe : chaque euro reçoit une mission (charges fixes, enveloppes de dépenses, épargne). « Reste à répartir » doit tomber à 0 €.
- Sans compte, sans backend : données dans le navigateur (localStorage, clé `yallah:v1`, gardée telle quelle depuis l’ancien nom Yallah pour ne pas perdre les données). Rien n'est pré-rempli.
- PWA installable + hors ligne (service worker `public/sw.js`).
- Prod : https://yallah-chi.vercel.app. Repo : github.com/curlyray7/Yallah (privé). Chaque push sur `main` redéploie sur Vercel.

## Stack
Next.js 16.4 (App Router), React 19.3, TypeScript strict, Tailwind CSS 4.3 (@tailwindcss/postcss).
Aucune autre dépendance runtime : ne pas en ajouter sans raison forte.
Commandes : `npm run dev`, `npm run build`, `npm run typecheck`.

## Structure
- `app/` : layout (polices Bangers + Rubik via Google Fonts), page, `manifest.ts`, `globals.css` (tokens de couleur + thème clair/sombre), icônes.
- `components/` :
  - `App` : chargement → `Onboarding` si aucune donnée, sinon `Shell`.
  - `Onboarding` : questionnaire en 6 étapes (revenus, charges fixes, enveloppes, épargne, objectifs, récap).
  - `Shell` : navigation par mois + 4 onglets (`#accueil`, `#depenses`, `#bilan`, `#reglages`), bouton + cyan.
  - `Home`, `Expenses`, `Review` (bilan + historique 6 mois), `Settings` (brouillon + bouton Enregistrer).
  - `ExpenseSheet` : saisie montant + enveloppe + libellé ; la date est automatique.
  - `editors.tsx` + `draft.ts` : édition des listes et validation, partagés par Onboarding et Settings.
  - `ui.tsx` : Button, Panel, Bar, Alert, MoneyInput, Toast.
  - `Mascot.tsx` : mascotte (`neutre` | `contente` | `inquiete` | `victoire` | `fierte`) lue dans `public/mascotte/<mood>.png` (480 px, originaux pleine taille dans `design/mascotte/`), visage SVG de secours si l’image manque. `MascotSays` = mascotte en médaillon rond + bulle. Sur l’accueil, l’humeur suit le budget (dépassement → inquiète, objectif atteint → victoire, épargne cochée → contente). `fierte` (drapeau israélien, kippa) apparaît au récap de l’onboarding quand chaque euro a sa mission, au bilan d’un mois terminé sans dépassement, et dans l’encart « Fait par… » des Réglages.
- `lib/` :
  - `types.ts` : `AppData` { incomes, categories (kind `fixed` | `envelope`), goals, savingsMonthly, margin, initialSavings, months[YYYY-MM] }.
  - `store.ts` : `useData` / `setData` / `updateData` via `useSyncExternalStore`.
  - `calc.ts` : tous les calculs (reste à répartir, dépensé par enveloppe, épargne totale, objectifs remplis par ordre de priorité, bilan).
  - `format.ts` : `eur`, `parseAmount` (accepte la virgule), helpers de mois.

## Règles métier
- Les charges fixes comptent comme dépensées automatiquement : on ne saisit que les dépenses d'enveloppes.
- L'épargne du mois est confirmée par une case à cocher (`savingsDone` stocke le montant).
- À partir du 25, le bilan propose de verser le non-dépensé des enveloppes en « épargne bonus » (`bonus`).
- Supprimer une catégorie garde ses dépenses (affichées « Catégorie supprimée »).

## Design (anime shōnen, effets dosés)
- Violet électrique `--accent`, cyan `--pop` (bouton +, highlights), bloc héros `--hero` (violet nuit) avec `--on-hero`, noir `--ink`. Rouge `--over` réservé aux dépassements.
- Style encré : contours `border-2 border-ink`, ombres décalées `shadow-ink` / `shadow-ink-sm` (couleur `--shade`, violet en sombre), boutons qui s’enfoncent au clic.
- Effets : `.speed-lines` (traits de vitesse), `.power-up` (saut + aura à un cap franchi), `.float` (mascotte). Respectent `prefers-reduced-motion`.
- Typo : Bangers (`font-manga`) pour titres et gros montants, Rubik pour le reste et les montants en liste.
- Toujours passer par les tokens CSS (`bg-surface`, `text-ink-2`, etc.), jamais de couleur en dur. Tester le clair et le sombre.
- Ton : tutoiement, références anime et quelques mots japonais ponctuels (« Yosh ! », « Ganbatte ! », « Sugoi ! ») sans gêner la lecture. Apostrophes typographiques ’ dans les textes affichés.
- Mobile d'abord, safe areas iOS gérées (`env(safe-area-inset-*)`).

## Hors périmètre V1 / pistes V2
Export/import d'une sauvegarde JSON, comptes + synchro (Supabase), reste à vivre hebdo, virements récurrents à cocher, multi-devises.
