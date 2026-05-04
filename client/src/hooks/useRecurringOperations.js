import { useEffect, useState, useCallback } from 'react';
import { list, RECURRING_CHANGED } from '@/api/recurringOperations';

// Charge la liste des récurrentes et se rafraîchit automatiquement quand
// l'évènement `recurring-changed` est émis (création/modif/suppression
// effectuées depuis une autre page comme le dashboard ou la page récurrentes).
export function useRecurringOperations() {
  const [recurring, setRecurring] = useState([]);
  const reload = useCallback(() => list().then(setRecurring).catch(() => {}), []);

  useEffect(() => {
    reload();
    window.addEventListener(RECURRING_CHANGED, reload);
    return () => window.removeEventListener(RECURRING_CHANGED, reload);
  }, [reload]);

  return { recurring, reload };
}
