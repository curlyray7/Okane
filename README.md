# Yallah

Fini le balagan dans tes comptes. Appli web de budget par enveloppes : chaque euro reçoit une mission (charges fixes, enveloppes de dépenses, épargne), puis on suit ses dépenses et ses objectifs d’épargne mois par mois.

- Aucun compte, aucune connexion bancaire : les données restent dans le navigateur (localStorage).
- Questionnaire guidé au premier lancement, rien n’est pré-rempli.
- Installable sur l’écran d’accueil (PWA) et utilisable hors ligne.

## Fonctionnalités (V1)

- Enveloppes avec budget, dépensé, reste, et compteur « reste à répartir ».
- Saisie rapide d’une dépense : montant, enveloppe, libellé.
- Objectifs d’épargne avec échéance, remplis par ordre de priorité.
- Bilan mensuel : enveloppes dépassées, solde, historique sur 6 mois, et proposition de verser le non-dépensé en épargne bonus à partir du 25.

## Design

Inspiré du Bauhaus de la Ville Blanche de Tel Aviv : blanc, bleu, jaune et noir francs, formes géométriques (bandes arrondies comme les balcons, cercles), typo Rubik.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4. Aucune dépendance runtime en dehors de Next et React.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:3000.

## Déployer sur Vercel

1. Crée un dépôt GitHub et pousse ce dossier :
   ```bash
   git init && git add . && git commit -m "Yallah V1"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/yallah.git
   git push -u origin main
   ```
2. Sur https://vercel.com/new, importe le dépôt. Vercel détecte Next.js tout seul : aucun réglage ni variable d’environnement à ajouter.
3. Clique sur Deploy. Chaque `git push` sur `main` redéploie automatiquement.

Alternative sans GitHub : `npx vercel` depuis ce dossier, puis `npx vercel --prod`.

## Structure

```
app/            layout, page, manifest PWA, styles
components/     écrans (Onboarding, Home, Expenses, Review, Settings) et UI
lib/            types, calculs, formatage, stockage local
public/         service worker et icônes
```
# Yallah
