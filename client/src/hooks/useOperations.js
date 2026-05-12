import { useEffect, useState } from 'react';
import { list } from '@/api/operations';

export function useOperations({ startDate, endDate, q, categoryId, pointed }) {
  const [operations, setOperations] = useState([]);

  const load = () => list({ startDate, endDate, q, categoryId, pointed }).then(setOperations);

  useEffect(() => {
    if (startDate && endDate) load();
  }, [startDate, endDate, q, categoryId, pointed]); // eslint-disable-line react-hooks/exhaustive-deps

  return { operations, setOperations, reload: load };
}
