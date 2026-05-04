import client from './client';

// Event window pour permettre aux écrans qui consomment les récurrentes
// (notamment le budget des catégories) de se rafraîchir automatiquement
// quand on en crée/édite/supprime depuis n'importe où.
export const RECURRING_CHANGED = 'recurring-changed';
const emitChanged = () => window.dispatchEvent(new CustomEvent(RECURRING_CHANGED));

export const list = () => client.get('/recurring-operations');

export const create = async (data) => {
  const res = await client.post('/recurring-operations', data);
  emitChanged();
  return res;
};

export const update = async (id, data) => {
  const res = await client.put(`/recurring-operations/${id}`, data);
  emitChanged();
  return res;
};

export const remove = async (id) => {
  const res = await client.delete(`/recurring-operations/${id}`);
  emitChanged();
  return res;
};

export const getSuggestions = () => client.get('/recurring-operations/suggestions');

export const dismissSuggestion = (key) =>
  client.post('/recurring-operations/suggestions/dismiss', { key });

export const undismissSuggestion = (key) =>
  client.delete(`/recurring-operations/suggestions/dismiss/${encodeURIComponent(key)}`);
