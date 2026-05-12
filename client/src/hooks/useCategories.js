import { useCallback, useEffect, useState } from 'react';
import { list } from '@/api/categories';

export function useCategories() {
  const [categories, setCategories] = useState([]);

  const reload = useCallback(
    () => list().then(setCategories).catch(() => {}),
    [],
  );

  useEffect(() => { reload(); }, [reload]);

  return { categories, reload };
}
