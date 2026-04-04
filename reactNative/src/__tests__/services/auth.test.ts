/**
 * Tests du service auth.
 * Vérifie la bascule IS_LOCAL entre auth locale (SQLite) et auth distante (API).
 */
import type { User } from '@/types';

jest.mock('@/db/repositories/auth', () => ({
  me:       jest.fn(),
  login:    jest.fn(),
  register: jest.fn(),
  logout:   jest.fn(),
}));

jest.mock('@/api/auth', () => ({
  me:       jest.fn(),
  login:    jest.fn(),
  register: jest.fn(),
  logout:   jest.fn(),
}));

const MOCK_USER: User = { _id: 'u1', username: 'alice' };
const CREDS = { username: 'alice', password: 's3cr3t' };

describe('services/auth — mode local', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/services/index', () => ({ IS_LOCAL: true }));
  });

  it('me() retourne l\'utilisateur depuis SQLite', async () => {
    const local = require('@/db/repositories/auth');
    local.me.mockResolvedValue(MOCK_USER);
    const { me } = require('@/services/auth');

    const result = await me();

    expect(local.me).toHaveBeenCalled();
    expect(result).toEqual(MOCK_USER);
  });

  it('me() retourne null si aucune session locale', async () => {
    const local = require('@/db/repositories/auth');
    local.me.mockResolvedValue(null);
    const { me } = require('@/services/auth');

    expect(await me()).toBeNull();
  });

  it('login() authentifie via SQLite', async () => {
    const local = require('@/db/repositories/auth');
    local.login.mockResolvedValue(MOCK_USER);
    const { login } = require('@/services/auth');

    const result = await login(CREDS);

    expect(local.login).toHaveBeenCalledWith(CREDS);
    expect(result).toEqual(MOCK_USER);
  });

  it('register() crée un compte local', async () => {
    const local = require('@/db/repositories/auth');
    local.register.mockResolvedValue(MOCK_USER);
    const { register } = require('@/services/auth');

    const result = await register(CREDS);

    expect(local.register).toHaveBeenCalledWith(CREDS);
    expect(result).toEqual(MOCK_USER);
  });

  it('logout() efface la session locale', async () => {
    const local = require('@/db/repositories/auth');
    local.logout.mockResolvedValue(undefined);
    const { logout } = require('@/services/auth');

    await logout();

    expect(local.logout).toHaveBeenCalled();
  });
});

describe('services/auth — mode remote', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/services/index', () => ({ IS_LOCAL: false }));
  });

  it('me() retourne null en cas d\'erreur API (pas de session)', async () => {
    const remote = require('@/api/auth');
    remote.me.mockRejectedValue(new Error('401'));
    const { me } = require('@/services/auth');

    const result = await me();

    expect(result).toBeNull();
  });

  it('login() appelle l\'API HTTP', async () => {
    const remote = require('@/api/auth');
    remote.login.mockResolvedValue(MOCK_USER);
    const { login } = require('@/services/auth');

    await login(CREDS);

    expect(remote.login).toHaveBeenCalledWith(CREDS);
  });
});
