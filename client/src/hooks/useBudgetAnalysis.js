import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAnalysis, runAnalysis, applySuggestion as apiApply } from '@/api/budgetAnalyses';

// The shared axios client (client.js) rejects with err.response?.data || err,
// so caught errors are either the server JSON body ({ message, ... }) or a raw Error.
function extractMessage(e, fallback) {
  return e?.message || fallback;
}

// Status machine: idle | loading | ready | stale | error
export function useBudgetAnalysis({ year, month }) {
  const [analysis, setAnalysis]  = useState(null);
  const [meta, setMeta]          = useState(null);
  const [status, setStatus]      = useState('idle');
  const [error, setError]        = useState(null);
  const [appliedIds, setApplied] = useState(() => new Set());

  // Load cached analysis on mount and on month change.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    setAnalysis(null);
    setMeta(null);
    setApplied(new Set());
    getAnalysis({ year, month })
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setStatus('idle');
        } else {
          setAnalysis(data.analysis);
          setMeta({
            cachedAt: data.cachedAt, opsDigest: data.opsDigest,
            stale: data.stale, model: data.model,
          });
          setStatus(data.stale ? 'stale' : 'ready');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(extractMessage(e, 'Erreur réseau'));
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [year, month]);

  const run = useCallback(async ({ force = false } = {}) => {
    setStatus('loading');
    setError(null);
    try {
      const data = await runAnalysis({ year, month, force });
      setAnalysis(data.analysis);
      setMeta({
        cachedAt: data.cachedAt, opsDigest: data.opsDigest,
        stale: false, model: data.model,
      });
      setApplied(new Set());
      setStatus('ready');
    } catch (e) {
      const msg = extractMessage(e, 'Erreur réseau');
      setError(msg);
      setStatus('error');
      toast.error(msg);
    }
  }, [year, month]);

  const regenerate = useCallback(() => run({ force: true }), [run]);

  const applySuggestion = useCallback(async ({ categoryId, suggestedBudget }) => {
    try {
      const data = await apiApply({ categoryId, suggestedBudget });
      setApplied((prev) => {
        const next = new Set(prev);
        next.add(categoryId);
        return next;
      });
      toast.success(`Budget mis à jour pour ${data.category.label}`);
      return data.category;
    } catch (e) {
      const msg = extractMessage(e, 'Erreur lors de la mise à jour');
      toast.error(msg);
      throw e;
    }
  }, []);

  return { analysis, meta, status, error, appliedIds, run, regenerate, applySuggestion };
}
