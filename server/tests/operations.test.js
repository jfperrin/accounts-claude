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
  it('renvoie le mois courant par défaut (vide)', async () => {
    const res = await agent.get('/api/operations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filtre par month/year', async () => {
    await agent.post('/api/operations').send(makeOp());
    const res = await agent.get('/api/operations').query({ month: 4, year: 2025 });
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('Loyer');

    const other = await agent.get('/api/operations').query({ month: 5, year: 2025 });
    expect(other.body).toHaveLength(0);
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

    const ops = await agent.get('/api/operations').query({ month: 4, year: 2025 });
    expect(ops.body).toHaveLength(2);
  });

  it('est idempotent — ne duplique pas', async () => {
    await agent.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    const res = await agent.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    expect(res.body.imported).toBe(0);

    const ops = await agent.get('/api/operations').query({ month: 4, year: 2025 });
    expect(ops.body).toHaveLength(2);
  });

  it('calcule le bon jour du mois', async () => {
    await agent.post('/api/operations/generate-recurring').send({ month: 4, year: 2025 });
    const ops = (await agent.get('/api/operations').query({ month: 4, year: 2025 })).body;
    const loyer = ops.find((o) => o.label === 'Loyer');
    expect(new Date(loyer.date).getUTCDate()).toBe(5);
  });

  it('rejette month/year invalides', async () => {
    expect((await agent.post('/api/operations/generate-recurring').send({ month: 13, year: 2025 })).status).toBe(400);
    expect((await agent.post('/api/operations/generate-recurring').send({})).status).toBe(400);
  });
});
