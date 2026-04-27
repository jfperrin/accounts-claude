import { useEffect, useState } from 'react';
import * as operationsApi from '@/api/operations';

export function useOperations({ startDate, endDate }) {
  const [operations, setOperations] = useState([]);

  const load = () => operationsApi.list({ startDate, endDate }).then(setOperations);

  useEffect(() => {
    if (startDate && endDate) load();
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return { operations, setOperations, reload: load };
}
