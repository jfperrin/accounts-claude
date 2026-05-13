import { useCallback, useEffect, useState } from 'react';
import { listUnpointed } from '@/api/operations';

// Endpoint dédié côté serveur : pas de filtrage client, pas de bornes de dates
// arbitraires (1900–2099) — le serveur renvoie directement les non pointées.
export function useUnpointedOperations() {
  const [operations, setOperations] = useState([]);

  const reload = useCallback(
    () => listUnpointed().then(setOperations).catch(() => {}),
    [],
  );

  useEffect(() => { reload(); }, [reload]);

  return { operations, reload };
}
