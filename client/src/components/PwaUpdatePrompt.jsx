import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Période de polling : on demande au navigateur de revérifier la présence
// d'une nouvelle version toutes les 30 minutes pendant que l'app est ouverte.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Vérification périodique tant que la page est active. registration.update()
      // est idempotent ; il ne provoque un reload que si un nouveau SW est trouvé.
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-popover px-4 py-3 shadow-lg"
    >
      <RefreshCw className="h-4 w-4 text-indigo-600 shrink-0" />
      <span className="text-sm">Une nouvelle version est disponible.</span>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Mettre à jour
      </Button>
      <button
        type="button"
        aria-label="Plus tard"
        onClick={() => setNeedRefresh(false)}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
