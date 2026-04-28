import { useEffect, useState } from 'react';
import { list } from '@/api/categories';

export function useCategories() {
  const [categories, setCategories] = useState([]);

  const load = () => list().then(setCategories);

  useEffect(() => { load(); }, []);

  return { categories, reload: load };
}
