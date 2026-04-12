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
