import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const PALETTES = ['saffron', 'midnight', 'verveine', 'lagon', 'indigo'];
const DEFAULT_PALETTE = 'saffron';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [palette, setPaletteState] = useState(() => {
    const stored = localStorage.getItem('palette');
    return PALETTES.includes(stored) ? stored : DEFAULT_PALETTE;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    PALETTES.forEach((p) => root.classList.toggle(`theme-${p}`, p === palette));
    localStorage.setItem('palette', palette);
  }, [palette]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const setPalette = (p) => { if (PALETTES.includes(p)) setPaletteState(p); };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
