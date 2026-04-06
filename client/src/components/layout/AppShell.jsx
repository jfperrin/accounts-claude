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
            {/* Surnom masqué sur mobile */}
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
