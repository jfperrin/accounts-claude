/**
 * Stratégie de sélection de la source de données.
 *
 * | Condition                               | Source         | Usage typique          |
 * |-----------------------------------------|----------------|------------------------|
 * | __DEV__ && USE_LOCAL_DB !== "false"      | SQLite local   | Développement offline  |
 * | !__DEV__ ou USE_LOCAL_DB === "false"     | API HTTP       | Production / staging   |
 *
 * Toutes les fonctions des services (`src/services/banks.ts`, etc.) lisent IS_LOCAL
 * pour dispatcher vers le bon backend sans que les screens/hooks le sachent.
 *
 * Override via `.env` :
 *   EXPO_PUBLIC_USE_LOCAL_DB=false  → force l'API même en dev (utile pour tester le server)
 *   EXPO_PUBLIC_USE_LOCAL_DB=true   → force SQLite même en prod (à éviter)
 */

const envFlag = process.env.EXPO_PUBLIC_USE_LOCAL_DB;

export const IS_LOCAL =
  envFlag === 'true' ? true
  : envFlag === 'false' ? false
  : __DEV__;
