import { useEffect, useState, useCallback } from 'react';
import { list } from '@/api/operations';

// Toutes les opérations non pointées (toutes dates confondues).
// On charge sur une plage volontairement large et on filtre côté client :
// suffisant pour les volumes attendus, et pas besoin d'endpoint dédié.
const ALL_START = '1900-01-01';
const ALL_END = '2099-12-31';

export function useUnpointedOperations() {
  const [operations, setOperations] = useState([]);

  const reload = useCallback(
    () => list({ startDate: ALL_START, endDate: ALL_END })
      .then((all) => setOperations(all.filter((o) => !o.pointed))),
    [],
  );

  useEffect(() => { reload(); }, [reload]);

  return { operations, reload };
}
