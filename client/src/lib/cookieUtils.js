// Helpers de persistance UI dans un cookie JSON.
// Une seule entrée par nom, encodée en JSON. TTL d'un an, suffisant pour
// la préférence d'un dashboard que l'utilisateur ne réinitialise jamais.

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export function getCookiePref(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  if (!match) return null;
  try { return JSON.parse(decodeURIComponent(match[1])); } catch { return null; }
}

export function setCookiePref(name, val) {
  const encoded = encodeURIComponent(JSON.stringify(val));
  document.cookie = `${name}=${encoded}; path=/; max-age=${ONE_YEAR_SEC}`;
}
