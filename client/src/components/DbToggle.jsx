import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import client from '@/api/client';

const COOKIE_NAME = 'db_backend';

function setBackendCookie(value) {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function DbToggle() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    client.get('/dev/db')
      .then((data) => { if (alive) setInfo(data); })
      // 404 quand dualMode est désactivé côté serveur — silencieux, le toggle ne s'affiche pas.
      .catch(() => { if (alive) setInfo({ dualMode: false }); });
    return () => { alive = false; };
  }, []);

  if (!info?.dualMode) return null;

  const switchTo = (backend) => {
    if (backend === info.current) return;
    setBackendCookie(backend);
    window.location.reload();
  };

  return (
    <div
      className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-0.5"
      title="Backend de développement"
    >
      <Database className="ml-1 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      {['sqlite', 'mongo'].map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => switchTo(b)}
          className={cn(
            'rounded px-2 py-0.5 text-[11px] font-semibold uppercase tabular-nums transition-colors',
            info.current === b
              ? 'bg-amber-500 text-white'
              : 'text-amber-700 hover:bg-amber-500/20 dark:text-amber-300',
          )}
        >
          {b}
        </button>
      ))}
    </div>
  );
}
