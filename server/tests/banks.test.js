const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

let alice, bob;
beforeEach(async () => {
  await clearDB();
  await createVerifiedUser(app, 'alice@test.com', 'pass1234');
  await createVerifiedUser(app, 'bob@test.com', 'pass1234');
  alice = request.agent(app);
  bob = request.agent(app);
  await alice.post('/api/auth/login').send({ email: 'alice@test.com', password: 'pass1234' });
  await bob.post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass1234' });
});

describe('GET /api/banks', () => {
  it('retourne 401 sans auth', async () => {
    expect((await request(app).get('/api/banks')).status).toBe(401);
  });

  it('retourne uniquement les banques de l\'utilisateur connecté', async () => {
    await alice.post('/api/banks').send({ label: 'BNP' });
    await bob.post('/api/banks').send({ label: 'Société Générale' });

    const res = await alice.get('/api/banks');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('BNP');
  });
});

describe('POST /api/banks', () => {
  it('crée une banque pour l\'utilisateur connecté', async () => {
    const res = await alice.post('/api/banks').send({ label: 'Crédit Agricole' });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Crédit Agricole');
    expect(res.body.userId).toBeDefined();
  });
});

describe('PUT /api/banks/:id', () => {
  it('modifie sa propre banque', async () => {
    const { body: bank } = await alice.post('/api/banks').send({ label: 'BNP' });
    const res = await alice.put(`/api/banks/${bank._id}`).send({ label: 'BNP Paribas' });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('BNP Paribas');
  });

  it("ne peut pas modifier la banque d'un autre utilisateur", async () => {
    const { body: bank } = await alice.post('/api/banks').send({ label: 'BNP' });
    const res = await bob.put(`/api/banks/${bank._id}`).send({ label: 'Piraté' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/banks/:id', () => {
  it('supprime sa propre banque', async () => {
    const { body: bank } = await alice.post('/api/banks').send({ label: 'BNP' });
    expect((await alice.delete(`/api/banks/${bank._id}`)).status).toBe(204);
    expect((await alice.get('/api/banks')).body).toHaveLength(0);
  });

  it("ne supprime pas la banque d'un autre utilisateur", async () => {
    const { body: bank } = await alice.post('/api/banks').send({ label: 'BNP' });
    await bob.delete(`/api/banks/${bank._id}`);
    expect((await alice.get('/api/banks')).body).toHaveLength(1);
  });
});
