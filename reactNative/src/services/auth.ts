import { IS_LOCAL } from './index';
import * as localAuth from '../db/repositories/auth';
import * as remoteAuth from '../api/auth';
import type { AuthCredentials, User } from '../types';

export async function me(): Promise<User | null> {
  if (IS_LOCAL) return localAuth.me();
  try { return await remoteAuth.me(); }
  catch { return null; }
}

export async function login(credentials: AuthCredentials): Promise<User> {
  if (IS_LOCAL) return localAuth.login(credentials);
  return remoteAuth.login(credentials);
}

export async function register(credentials: AuthCredentials): Promise<User> {
  if (IS_LOCAL) return localAuth.register(credentials);
  return remoteAuth.register(credentials);
}

export async function logout(): Promise<void> {
  if (IS_LOCAL) return localAuth.logout();
  return remoteAuth.logout();
}
