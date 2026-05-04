import axios from 'axios';

const client = axios.create({ baseURL: '/api', withCredentials: true });

const PUBLIC_PATHS = ['/login', '/cgu', '/reset-password'];

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      const isAuthCheck =
        url.includes('/auth/me') ||
        url.includes('/auth/login') ||
        url.includes('/auth/register');
      const onPublicPath = PUBLIC_PATHS.some((p) =>
        window.location.pathname.startsWith(p)
      );
      if (!isAuthCheck && !onPublicPath) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err.response?.data || err);
  }
);

export default client;
