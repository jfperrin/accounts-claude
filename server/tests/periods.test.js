const request = require('supertest');
const { setup, teardown, clearDB } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

let agent;
let bankId, periodId;

beforeEach(async () => {
  await clearDB();
  agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'alice@test.com', password: 'pass1234' });
  bankId = (await agent.post('/api/banks').send({ label: 'BNP' })).body._id;
  periodId = (await agent.post('/api/periods').send({ month: 3, year: 2025 })).body._id;
});

describe('PATCH /api/periods/:id/balances', () => {
  it('enregistre un solde par banque', async () => {
    const res = await agent
      .patch(`/api/periods/${periodId}/balances`)
      .send({ [bankId]: 1500 });

    expect(res.status).toBe(200);
    expect(res.body.balances[bankId]).toBe(1500);
  });

  it('met à jour un solde existant', async () => {
    await agent.patch(`/api/periods/${periodId}/balances`).send({ [bankId]: 1000 });
    const res = await agent.patch(`/api/periods/${periodId}/balances`).send({ [bankId]: 2000 });

    expect(res.body.balances[bankId]).toBe(2000);
  });

  it('retourne 404 pour une période inconnue', async () => {
    const fakeId = '000000000000000000000000';
    const res = await agent.patch(`/api/periods/${fakeId}/balances`).send({ [bankId]: 500 });
    expect(res.status).toBe(404);
  });

  it("n'expose pas les soldes d'un autre utilisateur", async () => {
    await agent.patch(`/api/periods/${periodId}/balances`).send({ [bankId]: 999 });

    const bob = request.agent(app);
    await bob.post('/api/auth/register').send({ email: 'bob@test.com', password: 'pass1234' });

    const res = await bob.patch(`/api/periods/${periodId}/balances`).send({ [bankId]: 1 });
    expect(res.status).toBe(404);

    const alicePeriod = (await agent.get('/api/periods')).body.find((p) => p._id === periodId);
    expect(alicePeriod.balances[bankId]).toBe(999);
  });
});
