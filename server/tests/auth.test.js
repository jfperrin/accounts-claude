const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);
beforeEach(clearDB);

const ALICE = { email: 'alice@test.com', password: 'pass1234', acceptedToS: true };

describe('POST /api/auth/register', () => {
  it('crée un compte, envoie un email, retourne 201 sans session', async () => {
    const res = await request(app).post('/api/auth/register').send(ALICE);
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/vérifi/i);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejette un email dupliqué', async () => {
    await request(app).post('/api/auth/register').send(ALICE);
    const res = await request(app).post('/api/auth/register').send(ALICE);
    expect(res.status).toBe(409);
  });

  it('rejette si champs manquants', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'alice@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte un compte vérifié', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.com');
    expect(res.body.emailVerified).toBe(true);
  });

  it('bloque un compte non-vérifié (403)', async () => {
    await request(app).post('/api/auth/register').send(ALICE);
    const res = await request(app).post('/api/auth/login').send(ALICE);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/non vérifié/i);
  });

  it('rejette un mauvais mot de passe', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send({ ...ALICE, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejette un utilisateur inconnu', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  // express-session v1.19+ sérialise le cookie avec Expires= (date UTC), pas Max-Age=.
  // On calcule la durée restante en secondes depuis l'attribut Expires.
  function sessionMaxAge(res) {
    const cookies = res.headers['set-cookie'] ?? [];
    const c = cookies.find(s => s.startsWith('connect.sid='));
    if (!c) return null;
    const expiresMatch = c.match(/Expires=([^;]+)/i);
    if (expiresMatch) return Math.round((new Date(expiresMatch[1]).getTime() - Date.now()) / 1000);
    const maxAgeMatch = c.match(/Max-Age=(\d+)/i);
    return maxAgeMatch ? Number(maxAgeMatch[1]) : null;
  }

  function expectMaxAge(res, expectedSeconds) {
    const maxAge = sessionMaxAge(res);
    expect(maxAge).not.toBeNull();
    expect(maxAge).toBeGreaterThan(expectedSeconds - 5);
    expect(maxAge).toBeLessThanOrEqual(expectedSeconds);
  }

  it('pose un cookie de session avec une durée de 1 jour quand rememberDays=1', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 1 });
    expect(res.status).toBe(200);
    expectMaxAge(res, 24 * 60 * 60);
  });

  it('pose un cookie de session avec une durée de 30 jours quand rememberDays=30', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
    expect(res.status).toBe(200);
    expectMaxAge(res, 30 * 24 * 60 * 60);
  });

  it('pose un cookie de session avec une durée de 365 jours quand rememberDays=365', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 365 });
    expect(res.status).toBe(200);
    expectMaxAge(res, 365 * 24 * 60 * 60);
  });

  it('pose un cookie de session avec une durée de 30 jours par défaut si rememberDays absent', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send({ email: ALICE.email, password: ALICE.password });
    expect(res.status).toBe(200);
    expectMaxAge(res, 30 * 24 * 60 * 60);
  });

  it('pose un cookie de session avec une durée de 30 jours par défaut si rememberDays invalide', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 999 });
    expect(res.status).toBe(200);
    expectMaxAge(res, 30 * 24 * 60 * 60);
  });

});

describe('GET /api/auth/me', () => {
  it('retourne 401 sans session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it("retourne l'utilisateur de la session active", async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.com');
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.emailVerified).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('détruit la session', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

});

describe('GET /api/auth/verify-email/:token', () => {
  it('valide un token email_verify et permet la connexion ensuite', async () => {
    await request(app).post('/api/auth/register').send(ALICE);
    const PasswordResetToken = require('../models/PasswordResetToken');
    const user = await app.locals.db.users.findByEmail(ALICE.email);
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'email_verify' });
    expect(record).toBeTruthy();

    const res = await request(app).get(`/api/auth/verify-email/${record.token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/verified=1/);

    const loginRes = await request(app).post('/api/auth/login').send(ALICE);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.emailVerified).toBe(true);
  });

  it('redirige avec error sur token invalide', async () => {
    const res = await request(app).get('/api/auth/verify-email/token-bidon');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=token_expired/);
  });
});

describe('PUT /api/auth/email', () => {
  let agent;
  beforeEach(async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
  });

  it("envoie un lien de vérification sans changer l'email immédiatement", async () => {
    const res = await agent.put('/api/auth/email').send({ email: 'new@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/lien/i);
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.body.email).toBe(ALICE.email);
  });

  it('rejette un email déjà utilisé', async () => {
    await createVerifiedUser(app, 'bob@test.com', 'pass1234');
    const res = await agent.put('/api/auth/email').send({ email: 'bob@test.com' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('retourne 200 même si email déjà vérifié (pas d\'énumération)', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    const res = await agent.post('/api/auth/resend-verification');
    expect(res.status).toBe(200);
  });

  it('envoie un email et retourne 200 si email non vérifié', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    const User = require('../models/User');
    await User.updateOne({ email: ALICE.email }, { emailVerified: false });
    const res = await agent.post('/api/auth/resend-verification');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/envoyé/i);
  });

  it('retourne 200 sans session (route publique, pas d\'énumération)', async () => {
    const res = await request(app).post('/api/auth/resend-verification');
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/auth/password', () => {
  let agent;
  beforeEach(async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
  });

  it('retourne 401 sans session', async () => {
    const res = await request(app).put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });
    expect(res.status).toBe(401);
  });

  it('retourne 400 si nouveau mot de passe trop court', async () => {
    const res = await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'abc',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 caractères/);
  });

  it('retourne 401 si mot de passe actuel incorrect', async () => {
    const res = await agent.put('/api/auth/password').send({
      currentPassword: 'wrongpassword',
      newPassword: 'newpass1234',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/incorrect/i);
  });

  it('retourne 400 pour un compte sans mot de passe local', async () => {
    // Retirer le mot de passe de Alice pour simuler un compte Google
    const User = require('../models/User');
    await User.findOneAndUpdate({ email: ALICE.email }, { $unset: { passwordHash: 1 } });

    const res = await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Google/i);
  });

  it('change le mot de passe et crée un token d\'annulation', async () => {
    const res = await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/mis à jour/i);

    // Le nouveau mot de passe fonctionne
    const loginNew = await request(app).post('/api/auth/login').send({
      email: ALICE.email,
      password: 'newpass1234',
    });
    expect(loginNew.status).toBe(200);

    // L'ancien mot de passe ne fonctionne plus
    const loginOld = await request(app).post('/api/auth/login').send(ALICE);
    expect(loginOld.status).toBe(401);

    // Un token password_change_cancel a été créé
    const PasswordResetToken = require('../models/PasswordResetToken');
    const user = await app.locals.db.users.findByEmail(ALICE.email);
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'password_change_cancel' });
    expect(record).toBeTruthy();
    expect(record.oldPasswordHash).toBeTruthy();
  });
});


describe('GET /api/auth/cancel-password-change/:token', () => {
  it('redirige avec token_expired si token invalide', async () => {
    const res = await request(app).get('/api/auth/cancel-password-change/bidon');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=token_expired/);
  });

  it('restaure l\'ancien mot de passe et redirige avec password_cancelled=1', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);

    // Changer le mot de passe pour créer le token d'annulation
    await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });

    // Récupérer le token depuis la DB
    const PasswordResetToken = require('../models/PasswordResetToken');
    const user = await app.locals.db.users.findByEmail(ALICE.email);
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'password_change_cancel' });

    // Annuler le changement
    const res = await request(app).get(`/api/auth/cancel-password-change/${record.token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/password_cancelled=1/);

    // L'ancien mot de passe fonctionne à nouveau
    const loginOld = await request(app).post('/api/auth/login').send(ALICE);
    expect(loginOld.status).toBe(200);

    // Le nouveau mot de passe ne fonctionne plus
    const loginNew = await request(app).post('/api/auth/login').send({
      email: ALICE.email,
      password: 'newpass1234',
    });
    expect(loginNew.status).toBe(401);
  });

  it('rejette un token déjà utilisé', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });
    const PasswordResetToken = require('../models/PasswordResetToken');
    const user = await app.locals.db.users.findByEmail(ALICE.email);
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'password_change_cancel' });

    // Premier clic : OK
    await request(app).get(`/api/auth/cancel-password-change/${record.token}`);
    // Deuxième clic : token marqué used → token_expired
    const res2 = await request(app).get(`/api/auth/cancel-password-change/${record.token}`);
    expect(res2.status).toBe(302);
    expect(res2.headers.location).toMatch(/error=token_expired/);
  });
});
