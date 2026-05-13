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
    const cat = (await alice.post('/api/categories').send({ label: 'Logement' })).body;
    const res = await alice.post('/api/recurring-operations').send(makeRec({ categoryId: cat._id }));
    expect(String(res.body.categoryId)).toBe(String(cat._id));
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
    const cat = (await alice.post('/api/categories').send({ label: 'Transport' })).body;
    const { body: rec } = await alice.post('/api/recurring-operations').send(makeRec());
    const res = await alice.put(`/api/recurring-operations/${rec._id}`).send({
      label: rec.label, amount: rec.amount, dayOfMonth: rec.dayOfMonth, bankId, categoryId: cat._id,
    });
    expect(String(res.body.categoryId)).toBe(String(cat._id));
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

describe('GET /api/recurring-operations/suggestions', () => {
  it("n'inclut pas les virements internes déjà liés (transferId posé)", async () => {
    const otherBankId = (await alice.post('/api/banks').send({ label: 'Boursorama' })).body._id;
    for (const date of ['2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05']) {
      await alice.post('/api/operations/transfer').send({
        fromBankId: bankId,
        toBankId: otherBankId,
        amount: 500,
        date,
      });
    }
    const res = await alice.get('/api/recurring-operations/suggestions');
    expect(res.status).toBe(200);
    expect(res.body.find((s) => /virement/i.test(s.label))).toBeUndefined();
  });

  it("n'inclut pas les virements internes détectés heuristiquement (non liés)", async () => {
    const otherBankId = (await alice.post('/api/banks').send({ label: 'Boursorama' })).body._id;
    // Quatre paires débit/crédit opposés sur deux banques, non liées via /transfer.
    // detectTransferCandidates doit les apparier et les exclure des suggestions.
    for (const date of ['2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05']) {
      await alice.post('/api/operations').send({
        label: 'VIR vers Boursorama', amount: -500, date, bankId, pointed: false,
      });
      await alice.post('/api/operations').send({
        label: 'VIR depuis BNP', amount: 500, date, bankId: otherBankId, pointed: false,
      });
    }
    const res = await alice.get('/api/recurring-operations/suggestions');
    expect(res.status).toBe(200);
    expect(res.body.find((s) => /vir/i.test(s.label))).toBeUndefined();
  });

  it('détecte un loyer mensuel et exclut un virement interne concomitant', async () => {
    const otherBankId = (await alice.post('/api/banks').send({ label: 'Boursorama' })).body._id;
    for (const date of ['2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05']) {
      await alice.post('/api/operations').send({
        label: 'PRLV LOYER', amount: -800, date, bankId, pointed: false,
      });
      await alice.post('/api/operations/transfer').send({
        fromBankId: bankId,
        toBankId: otherBankId,
        amount: 200,
        date,
      });
    }
    const res = await alice.get('/api/recurring-operations/suggestions');
    expect(res.status).toBe(200);
    const labels = res.body.map((s) => s.label);
    expect(labels).toContain('PRLV LOYER');
    expect(res.body.find((s) => /virement/i.test(s.label))).toBeUndefined();
  });
});
