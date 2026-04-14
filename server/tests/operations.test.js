const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

let agent;
let bankId, periodId;

beforeEach(async () => {
  await clearDB();
  await createVerifiedUser(app, 'alice@test.com', 'pass1234');
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'alice@test.com', password: 'pass1234' });
  bankId = (await agent.post('/api/banks').send({ label: 'BNP' })).body._id;
  periodId = (await agent.post('/api/periods').send({ month: 4, year: 2025 })).body._id;
});

const makeOp = (overrides = {}) => ({
  label: 'Loyer',
  amount: -800,
  date: '2025-04-05',
  bankId,
  periodId,
  ...overrides,
});

describe('GET /api/operations', () => {
  it('exige periodId', async () => {
    expect((await agent.get('/api/operations')).status).toBe(400);
  });

  it('retourne les opérations de la période', async () => {
    await agent.post('/api/operations').send(makeOp());
    const res = await agent.get('/api/operations').query({ periodId });
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('Loyer');
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

describe('POST /api/operations/import-recurring', () => {
  beforeEach(async () => {
    await agent.post('/api/recurring-operations').send({
      label: 'Loyer', amount: -800, dayOfMonth: 5, bankId,
    });
    await agent.post('/api/recurring-operations').send({
      label: 'Salaire', amount: 2500, dayOfMonth: 28, bankId,
    });
  });

  it('importe toutes les opérations récurrentes', async () => {
    const res = await agent.post('/api/operations/import-recurring').send({ periodId });
    expect(res.body.imported).toBe(2);

    const ops = await agent.get('/api/operations').query({ periodId });
    expect(ops.body).toHaveLength(2);
  });

  it('est idempotent — ne duplique pas', async () => {
    await agent.post('/api/operations/import-recurring').send({ periodId });
    const res = await agent.post('/api/operations/import-recurring').send({ periodId });
    expect(res.body.imported).toBe(0);

    const ops = await agent.get('/api/operations').query({ periodId });
    expect(ops.body).toHaveLength(2);
  });

  it('calcule le bon jour du mois', async () => {
    const res = await agent.post('/api/operations/import-recurring').send({ periodId });
    expect(res.body.imported).toBe(2);

    const ops = (await agent.get('/api/operations').query({ periodId })).body;
    const loyer = ops.find((o) => o.label === 'Loyer');
    expect(new Date(loyer.date).getDate()).toBe(5);
  });
});

describe('DELETE /api/periods/:id — cascade', () => {
  it('supprime les opérations associées', async () => {
    await agent.post('/api/operations').send(makeOp());
    await agent.delete(`/api/periods/${periodId}`);

    const ops = await agent.get('/api/operations').query({ periodId });
    expect(ops.body).toHaveLength(0);
  });
});
