import { useEffect, useState } from 'react';
import * as banksApi from '@/api/banks';

export function useBanks() {
  const [banks, setBanks] = useState([]);

  const load = () => banksApi.list().then(setBanks);

  useEffect(() => { load(); }, []);

  return { banks, setBanks, reload: load };
}
