import { useCallback, useEffect, useState } from 'react';
import { list } from '@/api/banks';

export function useBanks() {
  const [banks, setBanks] = useState([]);

  const reload = useCallback(
    () => list().then(setBanks).catch(() => { /* silencieux : pages affichent un état vide */ }),
    [],
  );

  useEffect(() => { reload(); }, [reload]);

  return { banks, setBanks, reload };
}
