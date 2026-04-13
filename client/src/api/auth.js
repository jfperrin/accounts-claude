import client from './client';

export const me = () => client.get('/auth/me');
export const config = () => client.get('/auth/config');
export const login = (data) => client.post('/auth/login', data);
export const register = (data) => client.post('/auth/register', data);
export const logout = () => client.post('/auth/logout');
export const resendVerification = (email) => client.post('/auth/resend-verification', email ? { email } : undefined);
