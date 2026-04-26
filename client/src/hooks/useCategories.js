import { useEffect, useState } from 'react';
import * as categoriesApi from '@/api/categories';

export function useCategories() {
  const [categories, setCategories] = useState([]);

  const load = () => categoriesApi.list().then(setCategories);

  useEffect(() => { load(); }, []);

  return { categories, reload: load };
}
