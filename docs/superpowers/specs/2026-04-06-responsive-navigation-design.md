# Responsive Navigation — Design Spec

**Goal:** Rendre la navigation du client web propre et efficace sur mobile, en ajoutant une barre de navigation fixe en bas sur petit écran, sans toucher au comportement desktop existant.

---

## Breakpoints

| Écran | Comportement |
|---|---|
| `< md` (< 768px) | Mobile : sidebar masquée, bottom nav visible |
| `≥ md` (≥ 768px) | Desktop : sidebar collapsible, header complet, pas de bottom nav |

---

## Header

**Desktop (inchangé) :** avatar cliquable + surnom + bouton Déconnexion, alignés à droite.

**Mobile :** le header affiche le logo Wallet + nom "Comptes" à gauche, et l'avatar seul (cliquable → `/profile`) à droite. Le bouton Déconnexion est masqué (`hidden md:flex`).

---

## Bottom Navigation Bar (mobile uniquement)

- Position : `fixed bottom-0 left-0 right-0`, `z-50`
- Hauteur : 64px
- Fond : blanc, bordure `border-t border-border`, shadow légère
- 4 onglets : **Tableau de bord**, **Banques**, **Récurrents**, **Profil**
- Chaque onglet : icône centrée + label en dessous (11px, semi-bold)
- Onglet actif : couleur indigo (`text-indigo-600`), icône filled
- Onglet inactif : `text-slate-400`
- Icônes identiques au React Native : `view-dashboard` / `bank` / `repeat` / `account` (lucide-react équivalents : `LayoutDashboard` / `Building2` / `RefreshCw` / `UserCircle`)

---

## Contenu principal

- Mobile : `pb-20` sur `<main>` pour éviter que le contenu soit caché sous la bottom nav (64px de barre + 16px de marge)
- Desktop : padding inchangé (`p-6`)

---

## Sidebar (desktop uniquement)

Comportement collapsible inchangé. Masquée sur mobile via `hidden md:flex`.

---

## Page Profil — ajout déconnexion

Un bouton "Déconnexion" (variant `outline`, pleine largeur, couleur rose/destructive) est ajouté en bas du formulaire de `ProfilePage.jsx`. Visible sur tous les écrans mais particulièrement utile sur mobile où le header n'affiche plus ce bouton.

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `client/src/components/layout/AppShell.jsx` | Responsive header, `hidden md:flex` sur sidebar, bottom nav mobile, `pb-20 md:pb-0` sur main |
| `client/src/pages/ProfilePage.jsx` | Ajout bouton Déconnexion en bas de page |
