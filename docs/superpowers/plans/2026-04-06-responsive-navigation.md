# Responsive Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la navigation du client web responsive en ajoutant une barre de navigation fixe en bas sur mobile et en adaptant le header, sans toucher au comportement desktop.

**Architecture:** AppShell devient responsive via des classes Tailwind `md:` — la sidebar et le bouton Déconnexion sont masqués sur mobile, une bottom nav fixe avec 4 onglets les remplace. La page Profil reçoit un bouton Déconnexion accessible sur mobile.

**Tech Stack:** React, Tailwind CSS v4, lucide-react, react-router-dom

---

## File Map

- Modify: `client/src/components/layout/AppShell.jsx` — responsive header + bottom nav mobile
- Modify: `client/src/pages/ProfilePage.jsx` — ajout bouton Déconnexion en bas

---

## Task 1: AppShell responsive

**Files:**
- Modify: `client/src/components/layout/AppShell.jsx`

- [ ] **Step 1: Remplacer le contenu de AppShell.jsx**

Remplacer intégralement `client/src/components/layout/AppShell.jsx` :

```javascript
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, RefreshCw, LogOut, ChevronLeft, ChevronRight, Wallet, UserCircle } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Sidebar desktop (3 items)
const NAV_ITEMS = [
  { key: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { key: '/banks', icon: Building2, label: 'Banques' },
  { key: '/recurring', icon: RefreshCw, label: 'Opérations récurrentes' },
];

// Bottom nav mobile (4 tabs — labels courts)
const BOTTOM_TABS = [
  { key: '/', icon: LayoutDashboard, label: 'Accueil' },
  { key: '/banks', icon: Building2, label: 'Banques' },
  { key: '/recurring', icon: RefreshCw, label: 'Récurrents' },
  { key: '/profile', icon: UserCircle, label: 'Profil' },
];

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const displayName = user?.nickname || user?.username;
  const initials = displayName?.slice(0, 2).toUpperCase() ?? '??';
  const avatarSrc = user?.avatarUrl ?? undefined;

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Sidebar desktop uniquement ── */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-sidebar text-white transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className={cn(
          'flex items-center gap-3 border-b border-white/10 py-4',
          collapsed ? 'justify-center px-0' : 'px-5'
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight">Comptes</span>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
            <button
              type="button"
              key={key}
              onClick={() => navigate(key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ── Zone principale ── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Header */}
        <header className="flex h-14 items-center border-b border-border bg-card px-4 shadow-xs">

          {/* Logo — mobile uniquement */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Wallet className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">Comptes</span>
          </div>

          <div className="flex-1" />

          {/* Avatar + surnom (cliquable → /profile) */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors"
            title="Mon profil"
          >
            <Avatar className="h-8 w-8">
              {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {/* Surnom masqué sur mobile (la bottom nav a déjà l'onglet Profil) */}
            <span className="hidden md:inline text-sm font-semibold text-foreground">{displayName}</span>
          </button>

          {/* Déconnexion — desktop uniquement */}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="hidden md:flex text-muted-foreground gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </header>

        {/* Contenu — padding bas extra sur mobile pour éviter la bottom nav */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom navigation mobile uniquement ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border bg-card">
        {BOTTOM_TABS.map(({ key, icon: Icon, label }) => {
          const active = pathname === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => navigate(key)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-colors',
                active ? 'text-indigo-600' : 'text-slate-400'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              {label}
            </button>
          );
        })}
      </nav>

    </div>
  );
}
```

- [ ] **Step 2: Vérifier visuellement**

- Passer en < 768px dans les DevTools → la sidebar doit disparaître, la bottom nav doit apparaître en bas, le logo s'affiche en haut à gauche, le bouton Déconnexion est masqué.
- Passer en ≥ 768px → comportement desktop inchangé (sidebar, déconnexion visible, pas de bottom nav).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/layout/AppShell.jsx
git commit -m "feat(client): responsive layout — bottom nav mobile, hide sidebar on small screens"
```

---

## Task 2: Bouton Déconnexion dans ProfilePage

**Files:**
- Modify: `client/src/pages/ProfilePage.jsx`

- [ ] **Step 1: Ajouter l'import useAuth et le bouton en bas du formulaire**

En haut de `client/src/pages/ProfilePage.jsx`, ajouter `logout` à l'import de `useAuth` :

```javascript
const { user, updateUser, logout } = useAuth();
```

Puis ajouter le bouton Déconnexion après la fermeture du `</form>` et avant le `</div>` final :

```jsx
      {/* Déconnexion — utile sur mobile où le header ne l'affiche plus */}
      <button
        type="button"
        onClick={logout}
        className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
      >
        Déconnexion
      </button>
```

- [ ] **Step 2: Vérifier**

Sur mobile (< 768px) : naviguer vers l'onglet Profil → le bouton Déconnexion doit apparaître en bas de page.
Sur desktop : le bouton est également visible mais le bouton dans le header reste aussi présent.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ProfilePage.jsx
git commit -m "feat(client): add logout button in ProfilePage for mobile"
```

---

## Self-Review

### Spec coverage

| Exigence spec | Tâche |
|---|---|
| Sidebar masquée sur mobile | ✅ Task 1 — `hidden md:flex` sur `<aside>` |
| Bottom nav 4 onglets sur mobile | ✅ Task 1 — `BOTTOM_TABS`, `fixed bottom-0`, `md:hidden` |
| Header mobile : logo gauche, avatar droite | ✅ Task 1 — logo `md:hidden`, avatar toujours visible |
| Déconnexion masquée dans header mobile | ✅ Task 1 — `hidden md:flex` sur le Button logout |
| Surnom masqué dans header mobile | ✅ Task 1 — `hidden md:inline` sur le span |
| `pb-20` sur main mobile | ✅ Task 1 — `pb-24 md:pb-6` |
| Bouton Déconnexion dans ProfilePage | ✅ Task 2 |
| Desktop inchangé | ✅ Task 1 — tous les éléments desktop préservés derrière `md:` |

### Placeholder scan

Aucun TBD, TODO ou instruction vague.

### Type consistency

Pas de nouveaux types. `logout` vient de `useAuth()` déjà disponible dans `AuthContext`.
