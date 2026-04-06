# Gestion de l'orientation — React Native

**Date :** 2026-04-06
**Scope :** `reactNative/`

---

## Objectif

Déverrouiller la rotation écran et adapter les layouts des 4 écrans (Dashboard, Banks, Recurring, Login) pour offrir une expérience optimale en portrait et en paysage.

---

## Architecture

### Hook central : `src/hooks/useOrientation.ts`

Expose `{ isLandscape, width, height }` en wrappant `useWindowDimensions` de React Native. Aucune dépendance supplémentaire. Mis à jour automatiquement à chaque rotation.

```ts
import { useWindowDimensions } from 'react-native';

export function useOrientation() {
  const { width, height } = useWindowDimensions();
  return { isLandscape: width > height, width, height };
}
```

### `app.json`

`"orientation"` passe de `"portrait"` à `"default"` pour autoriser les deux orientations.

---

## Layouts par écran

### DashboardScreen (paysage)

Disposition en `flexDirection: 'row'` :

- **Colonne gauche (40%)** : navigation mois (chevrons + label), bouton import récurrents, `BankBalances` avec son propre scroll
- **Colonne droite (60%)** : `OperationsList` avec son propre scroll indépendant

En portrait : comportement actuel (colonne unique, scroll global via `Screen`).

Le `FAB` et l'`Appbar` restent identiques dans les deux orientations.

### BanksScreen (paysage)

`FlatList` passe à `numColumns={2}`. Chaque item reçoit `flex: 1` et une marge horizontale pour former une grille uniforme. En portrait : liste simple à 1 colonne (comportement actuel).

### RecurringScreen (paysage)

Même pattern que BanksScreen : grille 2 colonnes via `numColumns={2}`.

### LoginScreen (paysage)

Formulaire centré horizontalement avec `maxWidth: 480` et `alignSelf: 'center'`. Évite que les champs ne s'étirent sur toute la largeur en paysage.

---

## Composants impactés

| Composant | Changement |
|-----------|------------|
| `DashboardScreen` | Layout conditionnel portrait/paysage |
| `BanksScreen` | `numColumns` conditionnel |
| `RecurringScreen` | `numColumns` conditionnel |
| `LoginScreen` | `maxWidth` + `alignSelf` en paysage |
| `OperationsList` | `scrollEnabled` conditionnel (activé en paysage pour scroll indépendant) |

---

## Ce qui ne change pas

- Toute la logique métier, hooks de données, services, API
- Les formulaires (modals/dialogs) — overlays qui s'adaptent naturellement
- `Screen`, `BankBalances`, `BankCard`, `OperationItem` — pas de modification nécessaire
- Tests existants — aucun impact

---

## Fichiers créés / modifiés

```
reactNative/app.json                              ← orientation: "default"
reactNative/src/hooks/useOrientation.ts           ← nouveau hook
reactNative/src/screens/DashboardScreen.tsx       ← layout conditionnel
reactNative/src/screens/BanksScreen.tsx           ← numColumns conditionnel
reactNative/src/screens/RecurringScreen.tsx       ← numColumns conditionnel
reactNative/src/screens/LoginScreen.tsx           ← maxWidth en paysage
reactNative/src/components/operations/OperationsList.tsx ← scrollEnabled conditionnel
```
