const request = require('supertest');
const { setup, teardown, clearDB } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);
beforeEach(clearDB);

const ALICE = { username: 'alice', password: 'pass1234' };

describe('POST /api/auth/register', () => {
  it('crée un compte et retourne une session', async () => {
    const res = await request(app).post('/api/auth/register').send(ALICE);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'alice' });
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejette un username dupliqué', async () => {
    await request(app).post('/api/auth/register').send(ALICE);
    const res = await request(app).post('/api/auth/register').send(ALICE);
    expect(res.status).toBe(409);
  });

  it('rejette si champs manquants', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'alice' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => request(app).post('/api/auth/register').send(ALICE));

  it('connecte avec des credentials valides', async () => {
    const res = await request(app).post('/api/auth/login').send(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });

  it('rejette un mauvais mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({ ...ALICE, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejette un utilisateur inconnu', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('retourne 401 sans session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it("retourne l'utilisateur de la session active", async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(ALICE);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(res.body.passwordHash).toBeUndefined();
  });
});

describe('POST /api/auth/logout', () => {
  it('détruit la session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(ALICE);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
