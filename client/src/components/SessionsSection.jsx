import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Monitor, LogOut } from 'lucide-react';
import dayjs from 'dayjs';
import { listSessions, revokeSession, revokeOtherSessions } from '@/api/auth';
import { Button } from '@/components/ui/button';

function summarizeUserAgent(ua) {
  if (!ua) return 'Appareil inconnu';
  const isMobile = /Mobi|Android|iPhone|iPad/.test(ua);
  let browser = 'Navigateur';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  let os = 'OS inconnu';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} · ${os}${isMobile ? ' (mobile)' : ''}`;
}

export default function SessionsSection() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return listSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleRevoke = async (id) => {
    try {
      await revokeSession(id);
      toast.success('Session révoquée');
      reload();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleRevokeOthers = async () => {
    try {
      await revokeOtherSessions();
      toast.success('Autres sessions déconnectées');
      reload();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sessions actives</h2>
          <p className="text-sm text-muted-foreground">
            Les appareils actuellement connectés à votre compte.
          </p>
        </div>
        {sessions.length > 1 && (
          <Button variant="outline" size="sm" onClick={handleRevokeOthers}>
            <LogOut className="h-4 w-4" />
            Déconnecter ailleurs
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune session active.</p>
      ) : (
        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <li key={s._id} className="flex items-center gap-3 py-3">
              <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {summarizeUserAgent(s.userAgent)}
                  {s.current && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Cet appareil
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.ip && <span>{s.ip} · </span>}
                  Dernière activité {dayjs(s.lastUsedAt).fromNow ? dayjs(s.lastUsedAt).fromNow() : dayjs(s.lastUsedAt).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
              {!s.current && (
                <Button variant="ghost" size="sm" onClick={() => handleRevoke(s._id)} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950">
                  Révoquer
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
