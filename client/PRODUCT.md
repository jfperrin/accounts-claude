# Product

## Register

product

## Users

Individu qui veut piloter ses comptes bancaires personnels sans déléguer à un agrégateur cloud type Bridge/Tink. Multi-banques françaises (compte courant, livret, parts mixtes). Saisit manuellement le solde lu sur le site banque + importe les relevés QIF/OFX pour les opérations.

Contexte d'usage typique : 5 minutes par jour, debout devant l'écran ou en pyjama au lit sur téléphone, pour pointer ce qui est passé en banque ce matin. Une revue plus longue par mois pour boucler le rapprochement, catégoriser ce qui restait et regarder le budget.

Le job à faire : **répondre à "qu'est-ce qu'il me reste vraiment d'ici la fin du mois ?"**, pas "voici tes habitudes de dépense". L'outil est un assistant comptable, pas un coach de vie.

## Product Purpose

Suivi de comptes bancaires multi-banques avec solde projeté (somme du solde actuel saisi + opérations non pointées), import QIF/OFX, opérations récurrentes, virements entre banques, catégorisation auto par cache de hints, budgets par catégorie.

Succès = l'utilisateur fait confiance au solde projeté affiché et arrête d'aller vérifier sur le site banque. L'application est l'autorité opérationnelle ; les sites banque sont la source amont qu'on rapproche.

L'application est personnelle (un user par compte, pas de partage), auto-hébergeable, gratuite à utiliser. Pas de monétisation. Pas de marketplace. Pas de "premium tier".

## Brand Personality

**Sobre. Technique. Précis.** Trois mots.

Voix : phrases courtes, vocabulaire bancaire FR exact (pointer, rapprocher, récurrente, virement entre banques, solde projeté). Jamais de "transaction", "ledger", "wallet". Jamais d'encouragement ("Bravo, tu as économisé 50 € !"). Jamais d'émojis.

Émotion visée : la confiance silencieuse d'un journal de comptes bien tenu. L'utilisateur doit avoir l'impression de regarder l'écran d'un comptable professionnel, pas une app grand public.

## Anti-references

- **Fintech US à la Revolut / Wise / N26.** Gradients animés, illustrations 3D pastel, cartes de paiement en hero, copywriting "Your money, your way". Tout est l'opposé du ton voulu.
- **Mint / YNAB / Linxo.** Dashboards saturés de dataviz décorative, scores de santé financière, jauges colorées, conseils auto. L'application ne juge pas, n'incite pas, n'optimise pas.
- **Quicken / Sage / MoneyMoney.** Densité d'information à la Excel des années 2000, toolbars surchargées, modales empilées, vert-sur-noir comptable.
- **Néobanques mobile-only style Lydia / Revolut Junior.** Iconographie ronde et cute, glyphs en émojis, micro-animations partout. Pas une app pour enfants.
- **Glassmorphism, gradients de marque, "hero metrics" géants (chiffre + label + delta + sparkline).** Cliché SaaS 2022-2024.

## Design Principles

1. **Le solde projeté est la vérité opérationnelle.** Tout part du futur, pas du présent. Quand on doit choisir quoi mettre en avant — le solde actuel ou la projection — c'est la projection. Le solde actuel reste lisible mais en second plan.

2. **Reconnaître, ne pas demander.** Auto-catégorisation par hints, candidats de virement suggérés, similarités d'opérations dépistées à l'import. À chaque saisie possible, demander d'abord si on peut deviner. L'utilisateur valide plus qu'il ne saisit.

3. **Le tableau est l'écran principal, pas une carte décorative.** OperationsTable est l'outil de travail. Pointage 1-clic sur desktop (Switch), swipe sur mobile (SwipeableCard). Densité de l'information assumée. Pas de "feed cards" qui prennent toute la largeur pour 3 infos.

4. **Vocabulaire bancaire FR exact.** "Pointer une opération" (la marquer comme passée en banque), "rapprocher" (lier deux opérations), "récurrente" (op mensuelle automatisée), "virement entre banques" (transfert interne). Les labels d'UI utilisent ces termes, pas leurs traductions anglaises ou des néologismes.

5. **Mobile sérieux, pas mobile cute.** Bottom nav 5 onglets, FAB primary pour l'action principale par page, swipe pour le pointage. Pas d'ondulations, pas de glyphes ronds, pas d'illustrations vides.

## Accessibility & Inclusion

- **WCAG AA** visé sur les contrastes (OKLCH des neutres et des textes calculés pour respecter 4.5:1 sur card et background dans les deux thèmes).
- **Focus visible partout** : `ring-2 ring-ring` sur tous les éléments interactifs, jamais désactivé.
- **Rôles ARIA** sur composants composites (Switch, Select, Dialog, DropdownMenu — héritage Radix).
- **Touch targets** ≥ 36px (button default h-9 = 36px). Les `size="icon"` à 32×32 sont réservés aux contextes denses (toolbar de tableau, bottom-nav) ; jamais pour des actions primaires.
- **Print** : feuille de style `@media print` dédiée pour rapports propres (masque header/sidebar/FAB/dialogs, neutralise les fonds sombres, préserve les couleurs de montant).
- **Reduced motion** : la seule animation custom (`fly-to-corner` du FAB) reste sobre. Pas de scroll-jacking, pas de parallax. Les transitions Radix respectent `prefers-reduced-motion` par défaut.
- **Langue** : interface 100 % française. Pas de switch i18n prévu — l'utilisateur cible est francophone, le vocabulaire bancaire est intentionnellement français.
