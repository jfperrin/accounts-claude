/**
 * Data mode strategy:
 *   __DEV__ + EXPO_PUBLIC_USE_LOCAL_DB !== "false"  → SQLite (offline, no server needed)
 *   production or EXPO_PUBLIC_USE_LOCAL_DB === "false" → Remote API (MongoDB via server)
 *
 * Override via .env:
 *   EXPO_PUBLIC_USE_LOCAL_DB=false   → always use API even in dev
 *   EXPO_PUBLIC_USE_LOCAL_DB=true    → always use local SQLite
 */

const envFlag = process.env.EXPO_PUBLIC_USE_LOCAL_DB;

export const IS_LOCAL =
  envFlag === 'true' ? true
  : envFlag === 'false' ? false
  : __DEV__;
