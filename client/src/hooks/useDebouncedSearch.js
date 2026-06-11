import { useCallback, useEffect, useState } from 'react';

// Couple `input` (saisie immédiate, pour le rendu du champ) + `q` (valeur
// debounced + trimmée, pour les dépendances de filtrage/fetch). Utilisé par
// FilterSearchInput pour éviter de re-render à chaque touche les consumers
// coûteux (useOperations envoie q au serveur, sortedItems re-calcule la liste).
export function useDebouncedSearch(initial = '', delayMs = 250) {
  const [input, setInput] = useState(initial);
  const [q, setQ] = useState(initial.trim());
  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), delayMs);
    return () => clearTimeout(id);
  }, [input, delayMs]);
  const clear = useCallback(() => { setInput(''); setQ(''); }, []);
  return { input, setInput, q, clear };
}
