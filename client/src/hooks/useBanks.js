import { useEffect, useState } from 'react';
import { list } from '@/api/banks';

export function useBanks() {
  const [banks, setBanks] = useState([]);

  const load = () => list().then(setBanks);

  useEffect(() => { load(); }, []);

  return { banks, setBanks, reload: load };
}
