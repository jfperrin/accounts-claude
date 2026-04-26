import { Link } from 'react-router-dom';

const YEAR = new Date().getFullYear();

export default function Footer({ className = '' }) {
  return (
    <footer className={`border-t border-border bg-card text-xs text-muted-foreground ${className}`}>
      <div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <span>© {YEAR} Gestion de Comptes — Tous droits réservés</span>
        <nav className="flex flex-wrap items-center gap-4">
          <Link to="/cgu" target="_blank" className="hover:text-foreground transition-colors">
            Conditions Générales d'Utilisation
          </Link>
          <span className="text-border">·</span>
          <span>Les données affichées sont fournies à titre indicatif et n'engagent pas la responsabilité de l'éditeur.</span>
        </nav>
      </div>
    </footer>
  );
}
