import { useCallback, useEffect, useRef, useState } from 'react';
import { list } from '@/api/operations';

// Garde contre les race conditions : si les filtres changent avant qu'une
// requête en vol ne soit résolue, on ignore la réponse obsolète. Sinon une
// réponse tardive vient écraser des données plus récentes (flash visuel).
export function useOperations({ startDate, endDate, q, categoryId, pointed }) {
  const [operations, setOperations] = useState([]);
  const seqRef = useRef(0);

  const reload = useCallback(() => {
    if (!startDate || !endDate) return Promise.resolve();
    const mySeq = ++seqRef.current;
    return list({ startDate, endDate, q, categoryId, pointed })
      .then((data) => {
        if (mySeq === seqRef.current) setOperations(data);
      })
      .catch(() => { /* silencieux : l'UI affiche un état vide */ });
  }, [startDate, endDate, q, categoryId, pointed]);

  useEffect(() => { reload(); }, [reload]);

  return { operations, setOperations, reload };
}
