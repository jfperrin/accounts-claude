const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

let agent;
let bankId;

beforeEach(async () => {
  await clearDB();
  await createVerifiedUser(app, 'alice@test.com', 'pass1234');
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'alice@test.com', password: 'pass1234' });
  bankId = (await agent.post('/api/banks').send({ label: 'BNP', currentBalance: 1000 })).body._id;
});

const makeOp = (overrides = {}) => ({
  label: 'Loyer',
  amount: -800,
  date: '2025-04-05T00:00:00.000Z',
  bankId,
  ...overrides,
});

describe('GET /api/operations', () => {
  it('retourne 401 sans auth', async () => {
    expect((await request(app).get('/api/operations')).status).toBe(401);
  });

  it('renvoie un tableau vide par défaut (30 derniers jours, sans opérations)', async () => {
    const res = await agent.get('/api/operations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filtre par startDate/endDate', async () => {
    await agent.post('/api/operations').send(makeOp());
    const res = await agent.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' });
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('Loyer');

    const other = await agent.get('/api/operations').query({ startDate: '2025-05-01', endDate: '2025-05-31' });
    expect(other.body).toHaveLength(0);
  });

  it('retourne 400 si seulement startDate est fourni', async () => {
    const res = await agent.get('/api/operations').query({ startDate: '2025-04-01' });
    expect(res.status).toBe(400);
  });

  it("n'expose pas les opérations des autres utilisateurs", async () => {
    const bob = request.agent(app);
    await createVerifiedUser(app, 'bob@test.com', 'pass1234');
    await bob.post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass1234' });
    await bob.post('/api/operations').send(makeOp());

    const res = await agent.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' });
    expect(res.body).toHaveLength(0);
  });
});

describe('PATCH /api/operations/:id/point', () => {
  it('bascule le statut pointé', async () => {
    const { body: op } = await agent.post('/api/operations').send(makeOp());
    expect(op.pointed).toBe(false);

    const res = await agent.patch(`/api/operations/${op._id}/point`);
    expect(res.body.pointed).toBe(true);

    const res2 = await agent.patch(`/api/operations/${op._id}/point`);
    expect(res2.body.pointed).toBe(false);
  });
});

describe('POST /api/operations/generate-recurring', () => {
  beforeEach(async () => {
    await agent.post('/api/recurring-operations').send({
      label: 'Loyer', amount: -800, dayOfMonth: 5, bankId,
    });
    await agent.post('/api/recurring-operations').send({
      label: 'Salaire', amount: 2500, dayOfMonth: 28, bankId,
    });
  });

  it('génère les opérations récurrentes du mois cible', async () => {
    const res = await agent.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    expect(res.body.imported).toBe(2);

    const ops = await agent.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' });
    expect(ops.body).toHaveLength(2);
  });

  it('est idempotent — ne duplique pas', async () => {
    await agent.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    const res = await agent.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    expect(res.body.imported).toBe(0);

    const ops = await agent.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' });
    expect(ops.body).toHaveLength(2);
  });

  it('calcule le bon jour du mois', async () => {
    await agent.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    const ops = (await agent.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' })).body;
    const loyer = ops.find((o) => o.label === 'Loyer');
    expect(new Date(loyer.date).getUTCDate()).toBe(5);
  });

  it('rejette month/year invalides', async () => {
    expect((await agent.post('/api/operations/generate-recurring').send({ month: 13, year: 2025 })).status).toBe(400);
    expect((await agent.post('/api/operations/generate-recurring').send({})).status).toBe(400);
  });
});

describe('POST /api/operations', () => {
  it('crée une opération', async () => {
    const res = await agent.post('/api/operations').send(makeOp());
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Loyer');
    expect(res.body.amount).toBe(-800);
    expect(res.body.pointed).toBe(false);
  });

  it('retourne 401 sans auth', async () => {
    expect((await request(app).post('/api/operations').send(makeOp())).status).toBe(401);
  });

  it('propage la catégorie', async () => {
    const res = await agent.post('/api/operations').send(makeOp({ category: 'Logement' }));
    expect(res.body.category).toBe('Logement');
  });
});

describe('PUT /api/operations/:id', () => {
  it('met à jour le libellé et le montant', async () => {
    const { body: op } = await agent.post('/api/operations').send(makeOp());
    const res = await agent.put(`/api/operations/${op._id}`).send({ label: 'Loyer modifié', amount: -900 });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Loyer modifié');
    expect(res.body.amount).toBe(-900);
  });

  it('met à jour la catégorie', async () => {
    const { body: op } = await agent.post('/api/operations').send(makeOp());
    const res = await agent.put(`/api/operations/${op._id}`).send({ category: 'Loisirs' });
    expect(res.body.category).toBe('Loisirs');
  });

  it("retourne 404 si l'opération appartient à un autre utilisateur", async () => {
    const bob = request.agent(app);
    await createVerifiedUser(app, 'bob@test.com', 'pass1234');
    await bob.post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass1234' });
    const { body: op } = await agent.post('/api/operations').send(makeOp());
    const res = await bob.put(`/api/operations/${op._id}`).send({ label: 'Piraté' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/operations/:id', () => {
  it('supprime sa propre opération', async () => {
    const { body: op } = await agent.post('/api/operations').send(makeOp());
    expect((await agent.delete(`/api/operations/${op._id}`)).status).toBe(204);
    const ops = (await agent.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' })).body;
    expect(ops).toHaveLength(0);
  });

  it("ne supprime pas l'opération d'un autre utilisateur", async () => {
    const bob = request.agent(app);
    await createVerifiedUser(app, 'bob@test.com', 'pass1234');
    await bob.post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass1234' });
    const { body: op } = await agent.post('/api/operations').send(makeOp());
    await bob.delete(`/api/operations/${op._id}`);
    const ops = (await agent.get('/api/operations').query({ startDate: '2025-04-01', endDate: '2025-04-30' })).body;
    expect(ops).toHaveLength(1);
  });
});
