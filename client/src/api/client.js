import axios from 'axios';

const client = axios.create({ baseURL: '/api', withCredentials: true });

const PUBLIC_PATHS = ['/login', '/cgu', '/reset-password'];

// Routes pour lesquelles on NE tente PAS de refresh sur 401 :
// - /auth/me   : c'est le check de session au boot, 401 signifie déconnecté
// - /auth/login, /auth/register, /auth/forgot-password : pas authentifié par essence
// - /auth/refresh : éviter une boucle infinie
const NO_REFRESH_PATHS = [
  '/auth/me',
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

let refreshPromise = null;

function shouldSkipRefresh(url) {
  return NO_REFRESH_PATHS.some((p) => url.includes(p));
}

client.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    const url = original?.url || '';

    if (status === 401 && !shouldSkipRefresh(url) && !original.__retried) {
      // Coalesce les refresh concurrents : tous les 401 attendent la même requête.
      original.__retried = true;
      try {
        refreshPromise = refreshPromise || axios.post('/api/auth/refresh', null, { withCredentials: true });
        await refreshPromise;
        return client(original); // retry l'appel d'origine, l'intercepteur unwrap res.data
      } catch (refreshErr) {
        refreshPromise = null;
        const onPublicPath = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));
        if (!onPublicPath) window.location.href = '/login';
        return Promise.reject(refreshErr.response?.data || refreshErr);
      } finally {
        refreshPromise = null;
      }
    }

    if (status === 401) {
      const onPublicPath = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));
      if (!shouldSkipRefresh(url) && !onPublicPath) window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export default client;
