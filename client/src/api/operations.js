import client from './client';

// Sans paramètre, le serveur renvoie les 30 derniers jours.
export const list = ({ startDate, endDate } = {}) =>
  client.get('/operations', { params: { startDate, endDate } });
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

// Liste les opérations sans catégorie de la même banque dont le libellé est
// similaire à celui d'une op source. Utilisé pour proposer une catégorisation en lot.
export const getSimilarUncategorized = (id) =>
  client.get(`/operations/${id}/similar-uncategorized`);

// Variante pour le cas "changement de catégorie d'une op déjà catégorisée" :
// retourne les ops similaires (uncat + autres catégories) qui ne sont PAS dans
// la catégorie cible. Chaque résultat contient son `categoryId` actuel pour
// affichage dans le dialog de bulk.
export const getSimilarExcludingCategory = (id, excludeCategoryId) =>
  client.get(`/operations/${id}/similar`, { params: { excludeCategoryId } });

// Variante "sans op source en base" : recherche par (label, bankId).
// Utilisée après création d'une récurrente pour proposer la catégorisation
// des opérations existantes correspondant au pattern.
export const findSimilarUncategorized = ({ label, bankId, excludeId }) =>
  client.get('/operations/similar-uncategorized', { params: { label, bankId, excludeId } });

// Affecte une catégorie à plusieurs opérations en une requête.
export const bulkCategorize = (ids, categoryId) =>
  client.post('/operations/bulk-categorize', { ids, categoryId });
