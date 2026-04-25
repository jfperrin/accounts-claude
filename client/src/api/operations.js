import client from './client';

// Sans paramètre, le serveur renvoie le mois courant.
export const list = ({ month, year } = {}) =>
  client.get('/operations', { params: { month, year } });
export const create = (data) => client.post('/operations', data);
export const update = (id, data) => client.put(`/operations/${id}`, data);
export const remove = (id) => client.delete(`/operations/${id}`);
export const point = (id) => client.patch(`/operations/${id}/point`);
export const generateRecurring = ({ month, year }) =>
  client.post('/operations/generate-recurring', { month, year });
// Upload d'un fichier QIF / OFX / ZIP pour la banque cible.
// Le serveur réconcilie automatiquement avec les ops existantes (par montant)
// et peut renvoyer `pendingMatches` à résoudre via resolveImport().
export const importFile = (file, { bankId }) => {
  const form = new FormData();
  form.append('file', file);
  form.append('bankId', bankId);
  return client.post('/operations/import', form);
};

// Finalise les résolutions de conflits remontés par importFile (pendingMatches).
// resolutions: [{ importedRow: { label, amount, date, bankId }, selectedOpIds: string[] }]
// selectedOpIds vide = créer la ligne du fichier telle quelle.
export const resolveImport = (resolutions) =>
  client.post('/operations/import/resolve', { resolutions });
