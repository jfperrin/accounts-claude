process.env.MOCK_ANTHROPIC = '1';

const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(async () => { delete process.env.MOCK_ANTHROPIC; await teardown(); });

let agent;
beforeEach(async () => {
  await clearDB();
});

async function loginAgent(email = 'u@u.u', password = 'Password1!') {
  const user = await createVerifiedUser(app, email, password);
  const ag = request.agent(app);
  await ag.post('/api/auth/login').send({ email, password }).expect(200);
  return { agent: ag, user };
}

describe('GET /api/budget-analyses', () => {
  it('401 sans auth', async () => {
    await request(app).get('/api/budget-analyses?year=2026&month=6').expect(401);
  });

  it('404 quand pas de cache pour le mois', async () => {
    const { agent: ag } = await loginAgent();
    await ag.get('/api/budget-analyses?year=2026&month=6').expect(404);
  });

  it('400 si year ou month manquant', async () => {
    const { agent: ag } = await loginAgent('b@u.u');
    await ag.get('/api/budget-analyses?year=2026').expect(400);
    await ag.get('/api/budget-analyses?month=6').expect(400);
  });
});

describe('POST /api/budget-analyses (MOCK_ANTHROPIC)', () => {
  it('renvoie 200 + analyse mock + écrit le cache', async () => {
    const { agent: ag, user } = await loginAgent('post@u.u');

    const { body: cat } = await ag.post('/api/categories')
      .send({ label: 'Test', kind: 'debit', maxAmount: 100 })
      .expect(201);
    const { body: bank } = await ag.post('/api/banks')
      .send({ label: 'B' })
      .expect(201);
    await ag.post('/api/operations')
      .send({ label: 'X', amount: -10, date: '2026-06-03T00:00:00.000Z', bankId: bank._id, categoryId: cat._id })
      .expect(201);

    const r = await ag.post('/api/budget-analyses')
      .send({ year: 2026, month: 6 })
      .expect(200);
    expect(r.body.analysis.summary).toMatch(/MOCK/i);
    expect(r.body.stale).toBe(false);

    const r2 = await ag.get('/api/budget-analyses?year=2026&month=6').expect(200);
    expect(r2.body.analysis.summary).toBe(r.body.analysis.summary);

    void user;
  });

  it('400 si year ou month manquant', async () => {
    const { agent: ag } = await loginAgent('postval@u.u');
    await ag.post('/api/budget-analyses').send({ year: 2026 }).expect(400);
    await ag.post('/api/budget-analyses').send({ month: 6 }).expect(400);
  });
});

describe('POST /api/budget-analyses/apply-suggestion', () => {
  it('met à jour le maxAmount = suggestedBudget − Σ récurrentes', async () => {
    const { agent: ag } = await loginAgent('apply@u.u');

    const { body: cat } = await ag.post('/api/categories')
      .send({ label: 'C', kind: 'debit', maxAmount: 50 })
      .expect(201);
    const { body: bank } = await ag.post('/api/banks')
      .send({ label: 'B' })
      .expect(201);
    await ag.post('/api/recurring-operations')
      .send({ label: 'Loyer', amount: -200, dayOfMonth: 5, bankId: bank._id, categoryId: cat._id })
      .expect(201);

    const r = await ag.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: cat._id, suggestedBudget: 500 })
      .expect(200);
    expect(r.body.category.maxAmount).toBe(300);
  });

  it('404 quand la catégorie appartient à un autre user', async () => {
    const { agent: ag } = await loginAgent('me@u.u');
    const { user: other } = await loginAgent('other@u.u');

    const agOther = request.agent(app);
    await agOther.post('/api/auth/login').send({ email: 'other@u.u', password: 'Password1!' });
    const { body: cat } = await agOther.post('/api/categories')
      .send({ label: 'Other', kind: 'debit' })
      .expect(201);

    await ag.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: cat._id, suggestedBudget: 100 })
      .expect(404);

    void other;
  });

  it('400 si suggestedBudget < Σ récurrentes', async () => {
    const { agent: ag } = await loginAgent('low@u.u');

    const { body: cat } = await ag.post('/api/categories')
      .send({ label: 'C', kind: 'debit' })
      .expect(201);
    const { body: bank } = await ag.post('/api/banks')
      .send({ label: 'B' })
      .expect(201);
    await ag.post('/api/recurring-operations')
      .send({ label: 'L', amount: -500, dayOfMonth: 1, bankId: bank._id, categoryId: cat._id })
      .expect(201);

    await ag.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: cat._id, suggestedBudget: 100 })
      .expect(400);
  });

  it('400 si body invalide', async () => {
    const { agent: ag } = await loginAgent('inv@u.u');
    await ag.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: 123, suggestedBudget: 100 })
      .expect(400);
    await ag.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: 'abc', suggestedBudget: -1 })
      .expect(400);
  });
});
