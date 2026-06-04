import axios from 'axios';
import client from './client';

export async function getAnalysis({ year, month }) {
  // Use raw axios (not the configured client) to preserve the response status:
  // the shared client's interceptor unwraps res.data and strips res.status,
  // making it impossible to distinguish a 404 (no cached analysis) from a
  // real error in the catch block.
  try {
    const res = await axios.get('/api/budget-analyses', {
      params: { year, month },
      withCredentials: true,
    });
    return res.data;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

export async function runAnalysis({ year, month, force = false }) {
  return client.post('/budget-analyses', { year, month, force });
}

export async function applySuggestion({ categoryId, suggestedBudget }) {
  return client.post('/budget-analyses/apply-suggestion', {
    categoryId, suggestedBudget,
  });
}
