const request = require('supertest');
const bcrypt = require('bcryptjs');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);
beforeEach(clearDB);

const ADMIN = { email: 'admin@test.com', password: 'adminpass1' };
const BOB   = { email: 'bob@test.com',   password: 'bobpass12'  };

// Crée un utilisateur admin vérifié directement en DB
async function createAdminUser(app, email, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  return app.locals.db.users.create({ email, passwordHash, role: 'admin', emailVerified: true });
}

describe('GET /api/admin/users — emailVerified présent', () => {
  it('inclut emailVerified dans chaque utilisateur listé', async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    const adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);

    const passwordHash = await bcrypt.hash(BOB.password, 12);
    await app.locals.db.users.create({ email: BOB.email, passwordHash, emailVerified: false });

    const res = await adminAgent.get('/api/admin/users');
    expect(res.status).toBe(200);

    const bob = res.body.find(u => u.email === BOB.email);
    expect(bob).toBeTruthy();
    expect(bob.emailVerified).toBe(false);

    const admin = res.body.find(u => u.email === ADMIN.email);
    expect(admin.emailVerified).toBe(true);
  });
});

describe('POST /api/admin/users/:id/verify-email', () => {
  let adminAgent;
  beforeEach(async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);
  });

  it('retourne 401 sans session', async () => {
    const passwordHash = await bcrypt.hash(BOB.password, 12);
    const bob = await app.locals.db.users.create({ email: BOB.email, passwordHash, emailVerified: false });
    const res = await request(app).post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(401);
  });

  it('retourne 403 pour un utilisateur sans rôle admin', async () => {
    await createVerifiedUser(app, BOB.email, BOB.password);
    const bobAgent = request.agent(app);
    await bobAgent.post('/api/auth/login').send(BOB);

    const bob = await app.locals.db.users.findByEmail(BOB.email);
    const res = await bobAgent.post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(403);
  });

  it('retourne 404 pour un utilisateur inexistant', async () => {
    const res = await adminAgent.post('/api/admin/users/000000000000000000000000/verify-email');
    expect(res.status).toBe(404);
  });

  it('marque l\'email comme vérifié et retourne l\'utilisateur mis à jour', async () => {
    const passwordHash = await bcrypt.hash(BOB.password, 12);
    const bob = await app.locals.db.users.create({ email: BOB.email, passwordHash, emailVerified: false });

    const res = await adminAgent.post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
    expect(res.body.email).toBe(BOB.email);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('est idempotent — 200 même si déjà vérifié', async () => {
    const bob = await createVerifiedUser(app, BOB.email, BOB.password);
    const res = await adminAgent.post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
  });
});

describe('POST /api/admin/users — création avec emailVerified', () => {
  let adminAgent;
  beforeEach(async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);
  });

  it('crée un utilisateur déjà vérifié quand emailVerified=true', async () => {
    const res = await adminAgent.post('/api/admin/users').send({
      email: BOB.email,
      password: BOB.password,
      role: 'user',
      emailVerified: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.emailVerified).toBe(true);
  });

  it('crée un utilisateur non vérifié par défaut', async () => {
    const res = await adminAgent.post('/api/admin/users').send({
      email: BOB.email,
      password: BOB.password,
      role: 'user',
    });
    expect(res.status).toBe(201);
    expect(res.body.emailVerified).toBe(false);
  });
});

describe('PUT /api/admin/users/:id — mise à jour de emailVerified', () => {
  let adminAgent;
  let bobId;
  beforeEach(async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);
    const passwordHash = await bcrypt.hash(BOB.password, 12);
    const bob = await app.locals.db.users.create({
      email: BOB.email, passwordHash, emailVerified: false,
    });
    bobId = String(bob._id);
  });

  it('marque comme vérifié via emailVerified=true', async () => {
    const res = await adminAgent.put(`/api/admin/users/${bobId}`).send({
      email: BOB.email, role: 'user', emailVerified: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
  });

  it('marque comme non vérifié via emailVerified=false', async () => {
    // D'abord vérifier
    await adminAgent.post(`/api/admin/users/${bobId}/verify-email`);
    // Puis dévérifier via PUT
    const res = await adminAgent.put(`/api/admin/users/${bobId}`).send({
      email: BOB.email, role: 'user', emailVerified: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(false);
  });

  it("préserve l'état emailVerified si non fourni", async () => {
    // Vérifier d'abord
    await adminAgent.post(`/api/admin/users/${bobId}/verify-email`);
    // PUT sans emailVerified → ne doit pas dévérifier
    const res = await adminAgent.put(`/api/admin/users/${bobId}`).send({
      email: BOB.email, role: 'admin',
    });
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
    expect(res.body.role).toBe('admin');
  });
});

describe('DELETE /api/admin/users/:id/mfa/* — révocation 2FA', () => {
  let adminAgent;
  let bobId;
  beforeEach(async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);
    const bob = await createVerifiedUser(app, BOB.email, BOB.password);
    bobId = String(bob._id);
    // Active les deux facteurs avec quelques recovery codes.
    await app.locals.db.users.updateMfa(bobId, {
      totpSecret: 'enc:placeholder',
      totpEnabled: true,
      emailMfaEnabled: true,
      recoveryCodes: ['hash1', 'hash2'],
    });
  });

  it('refuse sans session admin', async () => {
    const res = await request(app).delete(`/api/admin/users/${bobId}/mfa/totp`);
    expect(res.status).toBe(401);
  });

  it('refuse pour un user non admin', async () => {
    const CHARLIE = { email: 'charlie@test.com', password: 'charliepass1' };
    await createVerifiedUser(app, CHARLIE.email, CHARLIE.password);
    const otherAgent = request.agent(app);
    await otherAgent.post('/api/auth/login').send(CHARLIE);
    const res = await otherAgent.delete(`/api/admin/users/${bobId}/mfa/totp`);
    expect(res.status).toBe(403);
  });

  it('révoque TOTP et préserve les recovery codes si email MFA toujours actif', async () => {
    const res = await adminAgent.delete(`/api/admin/users/${bobId}/mfa/totp`);
    expect(res.status).toBe(200);
    expect(res.body.totpEnabled).toBe(false);
    expect(res.body.emailMfaEnabled).toBe(true);
    const full = await app.locals.db.users.findByIdWithHash(bobId);
    expect(full.totpSecret).toBeFalsy();
    expect((full.recoveryCodes || []).length).toBe(2);
  });

  it('révoque email MFA et préserve les recovery codes si TOTP toujours actif', async () => {
    const res = await adminAgent.delete(`/api/admin/users/${bobId}/mfa/email`);
    expect(res.status).toBe(200);
    expect(res.body.emailMfaEnabled).toBe(false);
    expect(res.body.totpEnabled).toBe(true);
    const full = await app.locals.db.users.findByIdWithHash(bobId);
    expect((full.recoveryCodes || []).length).toBe(2);
  });

  it('purge les recovery codes quand on désactive le dernier facteur', async () => {
    await adminAgent.delete(`/api/admin/users/${bobId}/mfa/email`);
    await adminAgent.delete(`/api/admin/users/${bobId}/mfa/totp`);
    const full = await app.locals.db.users.findByIdWithHash(bobId);
    expect(full.totpEnabled).toBe(false);
    expect(full.emailMfaEnabled).toBe(false);
    expect((full.recoveryCodes || []).length).toBe(0);
  });

  it('retourne 404 pour un user inexistant', async () => {
    const res = await adminAgent.delete('/api/admin/users/000000000000000000000000/mfa/totp');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/users/:id — suppression en cascade', () => {
  let adminAgent;
  beforeEach(async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);
  });

  // Peuple toutes les collections rattachées à un user via les repos.
  async function seedUserData(db, userId) {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const bank = await db.banks.create({ label: 'Banque', userId });
    const category = await db.categories.create({ label: 'Courses', kind: 'debit', userId });
    await db.operations.create({
      label: 'Op', amount: -10, date: new Date(), pointed: false,
      bankId: bank._id, categoryId: category._id, userId,
    });
    await db.recurringOps.create({
      label: 'Loyer', amount: -500, dayOfMonth: 5, bankId: bank._id, userId,
    });
    await db.categoryHints.upsert(userId, 'Op', category._id);
    await db.dismissedRecurringSuggestions.add(userId, 'loyer|bank');
    await db.resetTokens.create(userId, `tok-${userId}`, future);
    await db.refreshTokens.create({
      userId, tokenHash: `rt-${userId}`, userAgent: 'vitest', ip: '::1', expiresAt: future,
    });
    await db.mfaCodes.create({ userId, codeHash: `mfa-${userId}`, purpose: 'login', expiresAt: future });
    await db.budgetAnalyses.upsert({
      userId, year: 2026, month: 5, opsDigest: 'digest', response: { resume: 'ok' }, model: 'test-model',
    });
  }

  it('supprime le user et toutes ses données, sans toucher aux autres comptes', async () => {
    const db = app.locals.db;
    const bob = await createVerifiedUser(app, BOB.email, BOB.password);
    const bobId = String(bob._id);
    await seedUserData(db, bobId);

    const CHARLIE = { email: 'charlie@test.com', password: 'charliepass1' };
    const charlie = await createVerifiedUser(app, CHARLIE.email, CHARLIE.password);
    const charlieId = String(charlie._id);
    await seedUserData(db, charlieId);

    const res = await adminAgent.delete(`/api/admin/users/${bobId}`);
    expect(res.status).toBe(200);

    // Plus aucune trace de bob
    expect(await db.users.findById(bobId)).toBeNull();
    expect(await db.banks.findByUser(bobId)).toHaveLength(0);
    expect(await db.operations.findAllMinimal(bobId)).toHaveLength(0);
    expect(await db.recurringOps.findByUser(bobId)).toHaveLength(0);
    expect(await db.categories.findByUser(bobId)).toHaveLength(0);
    expect(await db.categoryHints.findByUser(bobId)).toHaveLength(0);
    expect(await db.dismissedRecurringSuggestions.findKeysByUser(bobId)).toHaveLength(0);
    expect(await db.resetTokens.findValid(`tok-${bobId}`)).toBeNull();
    expect(await db.refreshTokens.findActive(bobId)).toHaveLength(0);
    expect(await db.mfaCodes.findLatestValid({ userId: bobId, purpose: 'login' })).toBeNull();
    expect(await db.budgetAnalyses.findOne({ userId: bobId, year: 2026, month: 5 })).toBeNull();

    // Les données de charlie sont intactes
    expect(await db.users.findById(charlieId)).not.toBeNull();
    expect(await db.banks.findByUser(charlieId)).toHaveLength(1);
    expect(await db.operations.findAllMinimal(charlieId)).toHaveLength(1);
    expect(await db.recurringOps.findByUser(charlieId)).toHaveLength(1);
    expect(await db.categories.findByUser(charlieId)).toHaveLength(1);
    expect(await db.categoryHints.findByUser(charlieId)).toHaveLength(1);
    expect(await db.dismissedRecurringSuggestions.findKeysByUser(charlieId)).toHaveLength(1);
    expect(await db.refreshTokens.findActive(charlieId)).toHaveLength(1);
    expect(await db.budgetAnalyses.findOne({ userId: charlieId, year: 2026, month: 5 })).not.toBeNull();
  });

  it('refuse la suppression de son propre compte', async () => {
    const admin = await app.locals.db.users.findByEmail(ADMIN.email);
    const res = await adminAgent.delete(`/api/admin/users/${admin._id}`);
    expect(res.status).toBe(400);
    expect(await app.locals.db.users.findById(String(admin._id))).not.toBeNull();
  });

  it('retourne 404 pour un user inexistant', async () => {
    const res = await adminAgent.delete('/api/admin/users/000000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('refuse sans session admin', async () => {
    const bob = await createVerifiedUser(app, BOB.email, BOB.password);
    const bobAgent = request.agent(app);
    await bobAgent.post('/api/auth/login').send(BOB);
    const res = await bobAgent.delete(`/api/admin/users/${bob._id}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/users — états 2FA présents', () => {
  it('inclut totpEnabled et emailMfaEnabled pour chaque utilisateur', async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    const adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);
    const bob = await createVerifiedUser(app, BOB.email, BOB.password);
    await app.locals.db.users.updateMfa(String(bob._id), { totpEnabled: true });

    const res = await adminAgent.get('/api/admin/users');
    const bobRow = res.body.find((u) => u.email === BOB.email);
    expect(bobRow.totpEnabled).toBe(true);
    expect(bobRow.emailMfaEnabled).toBe(false);
  });
});
