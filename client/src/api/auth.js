import client from './client';

export const me = () => client.get('/auth/me');
export const config = () => client.get('/auth/config');
export const login = (data) => client.post('/auth/login', data);
export const register = (data) => client.post('/auth/register', data);
export const logout = () => client.post('/auth/logout');
export const resendVerification = (email) => client.post('/auth/resend-verification', email ? { email } : undefined);
export const requestPasswordReset = (email) => client.post('/auth/forgot-password', { email });

// Sessions multi-device : liste des refresh tokens actifs + révocation.
export const listSessions = () => client.get('/auth/sessions');
export const revokeSession = (id) => client.delete(`/auth/sessions/${id}`);
export const revokeOtherSessions = () => client.post('/auth/sessions/revoke-others');
