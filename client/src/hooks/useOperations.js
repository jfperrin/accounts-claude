import { useEffect, useState } from 'react';
import { list } from '@/api/operations';

export function useOperations({ startDate, endDate }) {
  const [operations, setOperations] = useState([]);

  const load = () => list({ startDate, endDate }).then(setOperations);

  useEffect(() => {
    if (startDate && endDate) load();
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return { operations, setOperations, reload: load };
}
