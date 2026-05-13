import { useCallback, useEffect, useState } from 'react';
import { list } from '@/api/categories';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(
    () => {
      setLoading(true);
      return list()
        .then(setCategories)
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => { reload(); }, [reload]);

  return { categories, reload, loading };
}
