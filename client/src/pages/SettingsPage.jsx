import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { cn } from '@/lib/utils';

const MODES = [
  { id: 'light', label: 'Clair', icon: Sun },
  { id: 'dark', label: 'Sombre', icon: Moon },
  { id: 'system', label: 'Auto (système)', icon: Monitor },
];

const THEMES = [
  { id: 'saffron',  name: 'Saffron',  subtitle: 'Ocre artisanal',         swatchLight: 'oklch(0.66 0.13 70)',  swatchDark: 'oklch(0.74 0.14 70)' },
  { id: 'midnight', name: 'Midnight', subtitle: 'Lime électrique, moderne', swatchLight: 'oklch(0.78 0.20 130)', swatchDark: 'oklch(0.85 0.22 130)' },
  { id: 'verveine', name: 'Verveine', subtitle: 'Sage apaisé',            swatchLight: 'oklch(0.52 0.08 165)', swatchDark: 'oklch(0.66 0.09 165)' },
  { id: 'lagon',    name: 'Lagon',    subtitle: 'Turquoise frais',         swatchLight: 'oklch(0.65 0.13 195)', swatchDark: 'oklch(0.75 0.14 195)' },
  { id: 'indigo',   name: 'Indigo',   subtitle: 'Originel',                swatchLight: 'oklch(0.511 0.262 277)', swatchDark: 'oklch(0.58 0.24 277)' },
];

export default function SettingsPage() {
  const { theme, themeMode, setThemeMode, palette, setPalette } = useTheme();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-xl font-extrabold text-foreground">Réglages</h1>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div>
          <h2 className="text-base font-semibold">Mode d'affichage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choisis clair, sombre ou laisse le système décider selon les préférences de ton OS.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = themeMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setThemeMode(id)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  active ? 'border-foreground/40 bg-muted/40 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/30',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div>
          <h2 className="text-base font-semibold">Apparence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Couleur d'accent de l'interface.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {THEMES.map((t) => {
            const active = palette === t.id;
            const swatch = theme === 'dark' ? t.swatchDark : t.swatchLight;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPalette(t.id)}
                aria-pressed={active}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  active ? 'border-foreground/40 bg-muted/40' : 'border-border hover:bg-muted/30',
                )}
              >
                <span className="h-10 w-10 rounded-full ring-1 ring-border" style={{ backgroundColor: swatch }} aria-hidden />
                <div className="w-full text-center">
                  <div className="text-xs font-semibold">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{t.subtitle}</div>
                </div>
                {active && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
