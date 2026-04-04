import { apiClient } from './client';
import type { AuthCredentials, User } from '../types';

export const me       = (): Promise<User>  => apiClient.get('/auth/me');
export const login    = (c: AuthCredentials): Promise<User> => apiClient.post('/auth/login', c);
export const register = (c: AuthCredentials): Promise<User> => apiClient.post('/auth/register', c);
export const logout   = (): Promise<void>  => apiClient.post('/auth/logout');
