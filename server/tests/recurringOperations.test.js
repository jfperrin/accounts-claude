const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

let alice, bob, bankId;
beforeEach(async () => {
  await clearDB();
  await createVerifiedUser(app, 'alice@test.com', 'pass1234');
  await createVerifiedUser(app, 'bob@test.com', 'pass1234');
  alice = request.agent(app);
  bob = request.agent(app);
  await alice.post('/api/auth/login').send({ email: 'alice@test.com', password: 'pass1234' });
  await bob.post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass1234' });
  bankId = (await alice.post('/api/banks').send({ label: 'BNP' })).body._id;
});

const makeRec = (overrides = {}) => ({
  label: 'Loyer',
  amount: -800,
  dayOfMonth: 5,
  bankId,
  ...overrides,
});

describe('GET /api/recurring-operations', () => {
  it('retourne 401 sans auth', async () => {
    expect((await request(app).get('/api/recurring-operations')).status).toBe(401);
  });

  it('retourne la liste des récurrentes de l\'utilisateur', async () => {
    await alice.post('/api/recurring-operations').send(makeRec());
    const res = await alice.get('/api/recurring-operations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('Loyer');
    expect(res.body[0].amount).toBe(-800);
    expect(res.body[0].dayOfMonth).toBe(5);
  });

  it("n'expose pas les récurrentes des autres utilisateurs", async () => {
    await alice.post('/api/recurring-operations').send(makeRec());
    const res = await bob.get('/api/recurring-operations');
    expect(res.body).toHaveLength(0);
  });

  it('retourne un tableau vide si aucune récurrente', async () => {
    const res = await alice.get('/api/recurring-operations');
    expect(res.body).toHaveLength(0);
  });
});

describe('POST /api/recurring-operations', () => {
  it('retourne 401 sans auth', async () => {
    expect((await request(app).post('/api/recurring-operations').send(makeRec())).status).toBe(401);
  });

  it('crée une récurrente', async () => {
    const res = await alice.post('/api/recurring-operations').send(makeRec());
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Loyer');
    expect(res.body.amount).toBe(-800);
    expect(res.body.dayOfMonth).toBe(5);
  });

  it('propage la catégorie', async () => {
    const res = await alice.post('/api/recurring-operations').send(makeRec({ category: 'Logement' }));
    expect(res.body.category).toBe('Logement');
  });

  it('accepte un montant positif (crédit)', async () => {
    const res = await alice.post('/api/recurring-operations').send(makeRec({ label: 'Salaire', amount: 2500, dayOfMonth: 28 }));
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(2500);
  });
});

describe('PUT /api/recurring-operations/:id', () => {
  it('met à jour sa propre récurrente', async () => {
    const { body: rec } = await alice.post('/api/recurring-operations').send(makeRec());
    const res = await alice.put(`/api/recurring-operations/${rec._id}`).send({
      label: 'Loyer modifié', amount: -850, dayOfMonth: 1, bankId,
    });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Loyer modifié');
    expect(res.body.amount).toBe(-850);
    expect(res.body.dayOfMonth).toBe(1);
  });

  it('met à jour la catégorie', async () => {
    const { body: rec } = await alice.post('/api/recurring-operations').send(makeRec());
    const res = await alice.put(`/api/recurring-operations/${rec._id}`).send({
      label: rec.label, amount: rec.amount, dayOfMonth: rec.dayOfMonth, bankId, category: 'Transport',
    });
    expect(res.body.category).toBe('Transport');
  });

  it("retourne 404 si la récurrente appartient à un autre utilisateur", async () => {
    const { body: rec } = await alice.post('/api/recurring-operations').send(makeRec());
    const res = await bob.put(`/api/recurring-operations/${rec._id}`).send({
      label: 'Piraté', amount: 0, dayOfMonth: 1, bankId,
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/recurring-operations/:id', () => {
  it('retourne 401 sans auth', async () => {
    const { body: rec } = await alice.post('/api/recurring-operations').send(makeRec());
    expect((await request(app).delete(`/api/recurring-operations/${rec._id}`)).status).toBe(401);
  });

  it('supprime sa propre récurrente', async () => {
    const { body: rec } = await alice.post('/api/recurring-operations').send(makeRec());
    expect((await alice.delete(`/api/recurring-operations/${rec._id}`)).status).toBe(204);
    expect((await alice.get('/api/recurring-operations')).body).toHaveLength(0);
  });

  it("ne supprime pas la récurrente d'un autre utilisateur", async () => {
    const { body: rec } = await alice.post('/api/recurring-operations').send(makeRec());
    await bob.delete(`/api/recurring-operations/${rec._id}`);
    expect((await alice.get('/api/recurring-operations')).body).toHaveLength(1);
  });

  it('les opérations déjà générées ne sont pas affectées', async () => {
    await alice.post('/api/recurring-operations').send(makeRec());
    await alice.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    const { body: rec } = (await alice.get('/api/recurring-operations'));
    await alice.delete(`/api/recurring-operations/${rec[0]._id}`);

    const ops = (await alice.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' })).body;
    expect(ops).toHaveLength(1);
  });
});
