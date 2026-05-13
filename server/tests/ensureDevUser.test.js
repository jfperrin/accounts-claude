const ensureDevUser = require('../utils/ensureDevUser');
const { setup, teardown, clearDB, getApp } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);
beforeEach(clearDB);

// Le helper passe NODE_ENV=test (cf. process.env.NODE_ENV par défaut sous vitest).
// `ensureDevUser` ne s'exécute qu'en non-production, donc actif ici.
afterEach(() => {
  delete process.env.DEV_USER_EMAIL;
  delete process.env.DEV_USER_PASSWORD;
  delete process.env.DEV_USER_DISABLED;
  delete process.env.NODE_ENV_OVERRIDE;
});

describe('ensureDevUser', () => {
  it('crée le compte de test avec les défauts', async () => {
    const db = getApp().locals.db;
    await ensureDevUser(db);
    const u = await db.users.findByEmail('claude-dev@test.local');
    expect(u).toBeTruthy();
    expect(u.emailVerified).toBe(true);
    expect(u.role).toBe('user');
  });

  it('est idempotent (deux appels = un seul user)', async () => {
    const db = getApp().locals.db;
    await ensureDevUser(db);
    await ensureDevUser(db);
    const all = await db.users.findAll();
    const matches = all.filter((u) => u.email === 'claude-dev@test.local');
    expect(matches).toHaveLength(1);
  });

  it("respecte DEV_USER_EMAIL et DEV_USER_PASSWORD", async () => {
    const db = getApp().locals.db;
    process.env.DEV_USER_EMAIL = 'custom-dev@test.local';
    process.env.DEV_USER_PASSWORD = 'customPass!9';
    await ensureDevUser(db);
    const u = await db.users.findByEmail('custom-dev@test.local');
    expect(u).toBeTruthy();
    expect(await db.users.findByEmail('claude-dev@test.local')).toBeFalsy();
  });

  it("ne fait rien si DEV_USER_DISABLED=1", async () => {
    const db = getApp().locals.db;
    process.env.DEV_USER_DISABLED = '1';
    await ensureDevUser(db);
    expect(await db.users.findByEmail('claude-dev@test.local')).toBeFalsy();
  });

  it('ne fait rien en NODE_ENV=production', async () => {
    const db = getApp().locals.db;
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await ensureDevUser(db);
      expect(await db.users.findByEmail('claude-dev@test.local')).toBeFalsy();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("repromote emailVerified=false en true sur un compte existant", async () => {
    const db = getApp().locals.db;
    // Crée le user en non vérifié, puis ensureDevUser doit le repromouvoir.
    const bcrypt = require('bcryptjs');
    await db.users.create({
      email: 'claude-dev@test.local',
      passwordHash: await bcrypt.hash('whatever', 4),
      role: 'user',
      emailVerified: false,
    });
    await ensureDevUser(db);
    const u = await db.users.findByEmail('claude-dev@test.local');
    expect(u.emailVerified).toBe(true);
  });
});
