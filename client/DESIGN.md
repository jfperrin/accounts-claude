---
name: Comptes
description: Gestion personnelle de comptes bancaires multi-banques avec solde projeté.
colors:
  background-light: "oklch(0.984 0.003 247.858)"
  background-dark: "oklch(0.141 0.005 285.823)"
  foreground-light: "oklch(0.141 0.005 285.823)"
  foreground-dark: "oklch(0.984 0.003 247.858)"
  card-light: "oklch(1 0 0)"
  card-dark: "oklch(0.18 0.006 285.823)"
  muted-light: "oklch(0.968 0.007 264.542)"
  muted-dark: "oklch(0.22 0.006 285.823)"
  muted-foreground-light: "oklch(0.495 0.046 257.417)"
  muted-foreground-dark: "oklch(0.65 0.005 285.823)"
  border-light: "oklch(0.922 0.006 264.532)"
  border-dark: "oklch(0.28 0.006 285.823)"
  primary-saffron-light: "oklch(0.66 0.13 70)"
  primary-saffron-dark: "oklch(0.74 0.14 70)"
  primary-midnight-light: "oklch(0.78 0.20 130)"
  primary-midnight-dark: "oklch(0.85 0.22 130)"
  primary-verveine-light: "oklch(0.52 0.08 165)"
  primary-verveine-dark: "oklch(0.66 0.09 165)"
  primary-lagon-light: "oklch(0.65 0.13 195)"
  primary-lagon-dark: "oklch(0.75 0.14 195)"
  primary-indigo-light: "oklch(0.511 0.262 277)"
  primary-indigo-dark: "oklch(0.58 0.24 277)"
  credit-light: "oklch(0.596 0.145 163)"
  credit-dark: "oklch(0.764 0.177 163)"
  debit-light: "oklch(0.586 0.227 16)"
  debit-dark: "oklch(0.708 0.187 22)"
  destructive-light: "oklch(0.577 0.245 27.325)"
  destructive-dark: "oklch(0.65 0.245 27.325)"
typography:
  display:
    fontFamily: "Newsreader, 'Source Serif 4', Georgia, serif"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
  numeric:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontFeature: "'tnum' 1"
    fontWeight: 600
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-saffron-light}"
    textColor: "oklch(0.18 0.02 70)"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input-text:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card-section:
    backgroundColor: "{colors.card-light}"
    rounded: "12px"
    padding: "16px"
  badge-default:
    backgroundColor: "{colors.primary-saffron-light}"
    textColor: "oklch(0.18 0.02 70)"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-secondary:
    backgroundColor: "{colors.muted-light}"
    textColor: "{colors.muted-foreground-light}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  fab-primary:
    backgroundColor: "{colors.primary-saffron-light}"
    textColor: "oklch(0.18 0.02 70)"
    rounded: "{rounded.full}"
    size: "56px"
---

# Design System: Comptes

## 1. Overview

**Creative North Star : « Le Carnet de Banque Discret »**

L'application est un carnet — pas un dashboard. La densité d'information est assumée parce que c'est ce qu'on demande à un comptable, mais la peau est calme : neutres tintés vers le bleu, accent thématisable mais utilisé sur ≤10 % de la surface, ombres quasi inexistantes. Le travail visible est celui des chiffres et des labels, pas celui de la décoration.

Cinq thèmes brand interchangeables (saffron par défaut, midnight, verveine, lagon, indigo) permettent à l'utilisateur de personnaliser sa marque sans casser le système. Aucun thème ne touche aux neutres, aux radii, à la typographie : tout est isolé sur `--primary` et `--ring`. C'est l'inverse d'un thème "midnight blue" qui repeint tout : ici on swap une seule variable.

Le système rejette explicitement (cf. PRODUCT.md Anti-references) : les hero metrics SaaS, le glassmorphism, les gradients de marque, les illustrations 3D pastel des fintechs grand public. Tout signe qui dirait « cette app cherche à vous séduire » est interdit.

**Key Characteristics:**
- Neutres tintés (`chroma 0.003-0.007` autour de hue 247-285), jamais purs.
- OKLCH partout. Aucun `#000`, aucun `#fff` (sauf forçage print et `card-light` qui est `oklch(1 0 0)` = blanc pur intentionnel pour la lumière de carte).
- Accent ≤10 % de surface, thématisable.
- Flat by default. `shadow-xs` est l'ombre par défaut des cartes ; `shadow-lg` est réservé au FAB.
- Typographie : Inter partout, Newsreader réservé aux titres rares.
- `tabular-nums` (font-feature `tnum`) obligatoire sur tout chiffre aligné en colonne (montants, soldes, compteurs).

## 2. Colors

Stratégie : **Restrained**. Neutres tintés + un accent ≤10 % thématisable. Deux couleurs sémantiques (credit, debit) qui ne sont pas le brand et qui restent stables d'un thème à l'autre.

### Primary

L'accent est thématisable. Saffron est le défaut.

- **Saffron** (`oklch(0.66 0.13 70)` light / `oklch(0.74 0.14 70)` dark) : ocre safran, hue 70 (jaune-orangé chaud). Boutons primaires, FAB, ring de focus, badges actifs, indicateurs « ce jour ».
- **Midnight** (`oklch(0.78 0.20 130)` / `oklch(0.85 0.22 130)`) : lime électrique, hue 130. Alternative high-energy.
- **Verveine** (`oklch(0.52 0.08 165)` / `oklch(0.66 0.09 165)`) : sage désaturé, hue 165. Alternative apaisée.
- **Lagon** (`oklch(0.65 0.13 195)` / `oklch(0.75 0.14 195)`) : turquoise frais, hue 195.
- **Indigo** (`oklch(0.511 0.262 277)` / `oklch(0.58 0.24 277)`) : brand historique d'avant la migration multi-thèmes, hue 277.

### Tertiary (sémantique financière, hors thème)

- **Credit** (`oklch(0.596 0.145 163)` light / `oklch(0.764 0.177 163)` dark) : vert pour les montants positifs (crédits, revenus, soldes positifs). Hue 163 — vert sapin, pas vert pomme.
- **Debit** (`oklch(0.586 0.227 16)` / `oklch(0.708 0.187 22)`) : rouge-orangé pour les montants négatifs (dépenses, soldes négatifs). Hue 16-22 — pas le rouge sang de `destructive`.
- **Destructive** (`oklch(0.577 0.245 27.325)` / `oklch(0.65 0.245 27.325)`) : rouge des actions destructrices (suppression). Réservé aux boutons « Supprimer » et confirmations dangereuses. Ne se confond pas avec debit grâce à la saturation plus haute et la hue plus proche du sang.

### Neutral

- **Background** (`oklch(0.984 0.003 247.858)` light / `oklch(0.141 0.005 285.823)` dark) : fond de page. Light = quasi-blanc tinté bleu froid très léger. Dark = anthracite profond, jamais noir.
- **Card** (`oklch(1 0 0)` light / `oklch(0.18 0.006 285.823)` dark) : blanc pur en light (la carte est la surface de travail, on veut la lumière maximale dessus) ; en dark, anthracite légèrement plus clair que le background pour le contraste de couches.
- **Border** (`oklch(0.922 0.006 264.532)` / `oklch(0.28 0.006 285.823)`) : très fin, séparateur structurel.
- **Muted** (`oklch(0.968 0.007 264.542)` / `oklch(0.22 0.006 285.823)`) : fond des badges secondaires, des zones désactivées, des hovers.
- **Muted-foreground** (`oklch(0.495 0.046 257.417)` / `oklch(0.65 0.005 285.823)`) : texte secondaire (dates, libellés courts, metadata).

### Named Rules

**La Règle des ≤10 %.** Le primary (saffron ou autre) couvre au maximum 10 % de l'écran à un instant T. C'est l'accent du bouton principal de la page (max 1 ou 2), le ring de focus, et rien d'autre. Pas de barre supérieure colorée. Pas de badge primary sur chaque ligne. Sa rareté est ce qui le rend lisible.

**La Règle des Deux Verts.** Le vert sapin (`credit`, hue 163) signifie « argent qui rentre ». Le vert lime (`primary-midnight`, hue 130) signifie « marque ». Ils ne se croisent pas dans la même vue. Sur le thème Midnight, on s'éloigne intentionnellement de hue 163 pour ne pas créer de confusion.

**Aucun gradient.** Pas de `background: linear-gradient(...)`. Pas de `background-clip: text`. Si une zone semble plate, on rajoute du contenu, pas du gradient.

## 3. Typography

**Display Font:** Newsreader (avec Source Serif 4, Georgia, serif en fallback) — chargée depuis Google Fonts en weights 500/600/700.

**Body Font:** Inter (avec ui-sans-serif, system-ui, sans-serif en fallback) — chargée en weights 400/500/600/700/800.

**Character :** Inter porte tout — formulaires, tableaux, navigation, body. Newsreader est rare : titres de pages éditoriaux uniquement (Help, ToS, CGU). Le contraste fort entre les deux familles signale immédiatement qu'on est sorti de l'outil et entré dans le contenu de lecture.

### Hierarchy

- **Display** (Newsreader, 600, clamp 1.875rem–2.5rem, line-height 1.1) : titres de pages de lecture (Help, ToS). Aucun usage dans l'app de gestion elle-même.
- **Title** (Inter, 600, 1.125rem / 18px, line-height 1.4) : titre de section de page (« Comptes », « Récurrentes »).
- **Body** (Inter, 400, 0.875rem / 14px, line-height 1.5) : texte standard, descriptions, lignes de tableau. **Cap line-length à 65–75ch** sur les blocs de prose (paragraphes d'aide).
- **Label** (Inter, 600, 0.75rem / 12px, line-height 1, parfois `uppercase tracking-wide`) : labels de formulaire, en-têtes de tableau.
- **Numeric** (Inter, 600, taille variable, `font-variant-numeric: tabular-nums`) : tous les montants, soldes, compteurs alignés en colonne.

### Named Rules

**La Règle des Tabular Nums.** Toute valeur numérique alignée en colonne dans un tableau, un solde, un récapitulatif, doit avoir `tabular-nums` (Tailwind `tabular-nums`). Sans ça, les chiffres "1" et "0" prennent une largeur différente et les colonnes dansent. Non négociable.

**La Règle du Serif Rare.** Newsreader n'apparaît que sur les pages où l'utilisateur s'arrête pour lire (Help, ToS, page d'aide). Jamais dans un tableau, une carte de solde, un formulaire. Le serif signale « lecture longue » ; quand il apparaît hors contexte, il fait amateur.

**La Règle du Poids 600.** Le bold est `600`, jamais `700`+ sur du body (sauf cas explicites). `font-bold` Tailwind = 700 est réservé aux montants critiques et aux titres. Le `600` est la voix d'autorité par défaut.

## 4. Elevation

Système **flat-by-default**. Les ombres sont presque absentes ; la profondeur vient de la tinte (card plus clair que background en light, plus sombre que muted en dark) et des bordures fines (1px border).

### Shadow Vocabulary

- **shadow-xs** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`) : ombre par défaut des cartes (`OperationsTable` wrapper desktop, formulaires, inputs).
- **shadow-sm** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1)`) : boutons primary (variant default). Ombre fonctionnelle pour signaler la cliquabilité — pas décorative.
- **shadow-md** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)`) : thumb du Switch Radix (le rond qui glisse). Donne le tactile.
- **shadow-lg shadow-primary/40** (`box-shadow: 0 10px 15px -3px var(--primary) / 0.4`) : **réservé au FAB** mobile + desktop scroll-off. C'est la seule ombre teintée du système — elle dit « action principale flottante ».

### Named Rules

**La Règle Flat-Par-Défaut.** Toute surface est plate au repos. `shadow-xs` est le maximum pour une carte. Si on a envie de "donner du volume", on ajoute une bordure ou on tinte le fond, pas une ombre.

**La Règle de l'Ombre Teintée Unique.** Une seule ombre du système est teintée avec la couleur primary : celle du FAB. Aucun autre élément n'utilise `shadow-{color}/X`. Si tu vois `shadow-emerald-500/30` quelque part dans le code, c'est un bug — ouvre une issue.

## 5. Components

### Buttons

- **Shape :** `rounded-md` (6px), height `h-9` (36px), padding `px-4 py-2` (16px / 8px).
- **Primary** (`variant: default`) : `bg-primary text-primary-foreground shadow-sm`, hover `bg-primary/90`. Action principale d'une page (max 1-2 par vue).
- **Outline** (`variant: outline`) : `border border-input bg-card text-foreground`, hover `bg-muted`. Actions secondaires, toolbars, filtres.
- **Ghost** (`variant: ghost`) : pas de fond, pas de bordure, hover `bg-muted`. Actions tertiaires inline dans les tableaux (icon buttons éditer/supprimer).
- **Destructive** (`variant: destructive`) : `bg-destructive text-destructive-foreground`. **Réservé aux suppressions confirmées dans un AlertDialog.** Jamais sur un primary path.
- **Link** (`variant: link`) : texte primary souligné au hover. Pour les "cancel" textuels et liens inline.
- **Icon size** (`size: icon`) : `h-8 w-8` (32px). À utiliser uniquement dans les toolbars denses (cellule de tableau, bottom-nav, header) où chaque pixel compte. **Jamais pour une action primaire**.
- **Focus :** ring-2 ring-ring (la même couleur que primary). Non négociable.
- **Transition :** `transition-colors` uniquement. Pas de scale au hover, pas de translate. Le bouton n'a pas besoin de "rebondir".

### Inputs / Fields

- **Style :** `h-9 rounded-md border border-input bg-card px-3 shadow-xs`. Couleur de texte `text-base md:text-sm` (taille mobile-first 16px pour éviter le zoom iOS, puis 14px à partir de md).
- **Focus :** `ring-2 ring-ring` + `outline-none`. La bordure ne change pas — c'est le ring qui fait le travail.
- **Disabled :** `opacity-50 cursor-not-allowed`.
- **Search (input type=search)** : pattern standard avec `<Search>` icon en absolute left + bouton clear `<X>` en absolute right quand `value !== ''`. Padding adapté `pl-9 pr-9` (ou `pl-8 pr-8` pour version compacte).

### Cards / Containers

- **Corner Style :** `rounded-xl` (12px) pour les conteneurs de section, `rounded-md` (6px) pour les sous-éléments.
- **Background :** `bg-card`.
- **Border :** `border border-border` (1px tinted neutral).
- **Shadow :** `shadow-xs`.
- **Internal Padding :** `p-4` (16px) sur desktop. Sur mobile, **pas de padding et pas de bordure** — la carte se confond avec le background pour gagner la largeur (cf. pattern `sm:rounded-xl sm:border sm:p-4` qui n'active la décoration qu'à partir de `sm:`).

### Tables

- **Wrapper :** `overflow-auto rounded-md border border-border` avec `maxHeight` borné pour activer la virtualisation `@tanstack/react-virtual`.
- **Header :** `sticky top-0 z-10 bg-card`. Le tri se fait via boutons inline dans le `<TableHead>` (flèches `ArrowUp` / `ArrowDown` / `ArrowUpDown`).
- **Row :** opacity `opacity-50` quand l'opération est pointée (signal visuel calme du « c'est fait »).
- **Cell numérique :** `text-right font-semibold tabular-nums` + classe sémantique `text-credit` ou `text-debit` selon le signe.
- **Desktop only :** la table est rendue dans `hidden md:block`. Mobile utilise des cartes swipeable (`SwipeableCard`).

### Switch (signature)

- **Style :** Radix `SwitchPrimitive` wrappé. `h-5 w-9` (20×36px), `rounded-full`, transition de couleur sur `data-state`.
- **States :** `data-[state=checked]:bg-primary` (la couleur du thème), `data-[state=unchecked]:bg-muted`.
- **Thumb :** `h-4 w-4 rounded-full bg-background shadow-md`, translate `data-[state=checked]:translate-x-4`.
- **Rôle dans le produit :** signe le pointage d'une opération. C'est le composant le plus cliqué de l'app après le bouton "Nouvelle opération". Sa taille et sa réactivité au tap sont **load-bearing**.

### FAB (Floating Action Button) — composant signature

- **Présence :** toujours en mobile (`bottom-28 right-6` pour passer au-dessus de la bottom-nav `bottom-0 h-16`). Sur desktop, **apparition conditionnelle** via `IntersectionObserver` sur le bouton "Nouvelle opération" inline : quand celui-ci sort du viewport en scrollant, le FAB apparaît en bas à droite (`bottom-8 right-8`).
- **Style :** `h-14 w-14 rounded-full bg-primary shadow-lg shadow-primary/40`. Icon `Plus` `h-6 w-6`.
- **Animation d'entrée :** `animate-fly-to-corner` (custom keyframes `fly-to-corner` dans `index.css`, durée 0.45s, easing `cubic-bezier(0.22, 1, 0.36, 1)` — ease-out-quart). Le FAB arrive du bas avec scale 0.8 → 1.
- **Hover :** `hover:bg-primary/90 hover:scale-105`, `active:scale-95`. Le scale ici est intentionnel — c'est l'élément flottant, il **doit** réagir physiquement au tap.

### Navigation

- **Desktop sidebar** (`hidden md:flex`) : verticale gauche, items texte + icône, état actif `bg-sidebar text-sidebar-foreground`.
- **Mobile bottom-nav** (`fixed bottom-0 flex md:hidden h-16`) : 5-6 onglets, icône au-dessus du label, item actif coloré en `text-primary`.
- **Header desktop :** logo + spacer + ThemeToggle + avatar + déconnexion.
- **Print :** toute la navigation est masquée (`display: none !important`).

## 6. Do's and Don'ts

### Do:

- **Do** utiliser OKLCH pour toute nouvelle couleur. Chroma ≤ 0.01 pour les neutres, jamais > 0.25 sauf credit/debit/destructive.
- **Do** vérifier qu'une nouvelle couleur a son équivalent dans `:root` (light) et `.dark`. Les deux thèmes sont normatifs.
- **Do** mettre `tabular-nums` sur tout chiffre aligné en colonne. Sans exception.
- **Do** réserver `shadow-lg shadow-primary/40` au FAB. Tout autre usage doit être justifié et discuté.
- **Do** utiliser `text-credit` / `text-debit` pour la sémantique d'un montant (positif / négatif), jamais une couleur Tailwind brute.
- **Do** valider que ton composant respecte WCAG AA sur les deux thèmes (light + dark). Tester aussi sur le thème non-saffron par défaut.
- **Do** mobile-first : composer d'abord sans préfixes, puis ajouter `sm:` / `md:` pour gagner de l'espace, jamais l'inverse.
- **Do** utiliser le vocabulaire bancaire FR exact dans les labels (« Pointer », « Récurrente », « Virement entre banques », « Solde projeté »).
- **Do** caler `focus-visible:ring-2 focus-visible:ring-ring` sur tout interactif.

### Don't:

- **Don't** utiliser `#000` ou `#fff` purs (sauf print et `card-light` qui est l'exception explicite).
- **Don't** appliquer un gradient nulle part. Pas `bg-gradient-to-r`, pas `background-clip: text`. Cf. anti-references PRODUCT.md sur les fintechs.
- **Don't** mettre du glassmorphism (`backdrop-blur` + `bg-white/10`). Réservé aux overlays Radix natifs qui en utilisent un peu — c'est tout.
- **Don't** créer une nouvelle ombre teintée (`shadow-color/X`). Une seule existe : celle du FAB.
- **Don't** utiliser une `border-left` ou `border-right` > 1px comme accent coloré sur une carte ou une ligne (interdiction absolue Impeccable). Si tu veux signaler un état, utilise le fond, un badge, ou un icône inline.
- **Don't** dupliquer le pattern "hero metric" (gros chiffre + label + delta + sparkline). Cliché SaaS interdit. Les soldes affichés dans `BankBalances` ne sont **pas** ce pattern — ils sont une liste dense, pas une vitrine.
- **Don't** ajouter d'émoji dans l'UI, les labels, les toasts, les messages d'erreur. Aucun.
- **Don't** ajouter de gamification (badges « bravo », streaks, scores). Cf. PRODUCT.md Anti-references / Mint.
- **Don't** créer un nouveau thème de marque sans repasser par la palette OKLCH des `:root` / `.dark` du même fichier. Le système suit le pattern `.theme-{nom}` / `.dark.theme-{nom}` strictement.
- **Don't** utiliser `font-bold` (700) sur du body courant. Le poids d'autorité est 600 (`font-semibold`).
- **Don't** animer des propriétés de layout (`width`, `height`, `margin`, `padding`). Seulement `transform` et `opacity`.
- **Don't** mettre une modale en première intention. Sur ce projet, le formulaire d'opération est en modale parce que c'est court et critique — mais une catégorisation rapide se fait inline dans la cellule. Réflexe inverse à appliquer à toute nouvelle saisie.
