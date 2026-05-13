import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

export const PALETTES = ['saffron', 'midnight', 'verveine', 'lagon', 'indigo'];
const DEFAULT_PALETTE = 'saffron';

// Trois modes possibles :
//  - 'light'  : forcé clair
//  - 'dark'   : forcé sombre
//  - 'system' : suit la préférence OS (prefers-color-scheme), recalcule
//               dynamiquement quand l'utilisateur change son thème système
const VALID_MODES = ['light', 'dark', 'system'];

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode) {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

// Migration : ancienne valeur 'light' | 'dark' stockée sous la clé 'theme'.
// Nouvelle valeur sous la même clé, étendue à 'system'. Une valeur inconnue
// retombe sur 'light' (l'historique de l'app).
function readInitialMode() {
  const stored = typeof window !== 'undefined' && localStorage.getItem('theme');
  return VALID_MODES.includes(stored) ? stored : 'light';
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(readInitialMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [palette, setPaletteState] = useState(() => {
    const stored = localStorage.getItem('palette');
    return PALETTES.includes(stored) ? stored : DEFAULT_PALETTE;
  });

  // Écoute le changement de prefers-color-scheme — n'a d'effet visuel que si
  // themeMode === 'system'. On garde l'abonnement tout le temps : ça évite de
  // perdre/recréer le listener en cas de bascule manuelle.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Thème effectivement appliqué (jamais 'system' ici, toujours 'light'|'dark').
  const theme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', themeMode);
  }, [theme, themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    PALETTES.forEach((p) => root.classList.toggle(`theme-${p}`, p === palette));
    localStorage.setItem('palette', palette);
  }, [palette]);

  const setThemeMode = useCallback((m) => {
    if (VALID_MODES.includes(m)) setThemeModeState(m);
  }, []);

  // Toggle binaire (clair ↔ sombre) : utilisé par le bouton du header.
  // Sortir explicitement de 'system' clarifie l'intention de l'utilisateur.
  const toggleTheme = useCallback(() => {
    setThemeModeState((current) => {
      const effective = resolveTheme(current);
      return effective === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const setPalette = useCallback((p) => {
    if (PALETTES.includes(p)) setPaletteState(p);
  }, []);

  // Mémoïser la value du context évite que tous les consumers re-rendent à chaque
  // render du provider (le `{...}` inline serait neuf à chaque fois sinon).
  const value = useMemo(
    () => ({ theme, themeMode, toggleTheme, setThemeMode, palette, setPalette }),
    [theme, themeMode, toggleTheme, setThemeMode, palette, setPalette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
