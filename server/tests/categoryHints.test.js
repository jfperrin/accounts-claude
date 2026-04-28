// Tests d'intégration pour le cache label → catégorie utilisé par l'auto-affectation
// à l'import. Endpoints : /api/category-hints (GET, POST /rebuild, DELETE)
// + hooks sur POST/PUT /api/operations.

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

describe('GET /api/category-hints', () => {
  it('retourne 401 sans auth', async () => {
    const res = await request(app).get('/api/category-hints');
    expect(res.status).toBe(401);
  });

  it('retourne un tableau vide initialement', async () => {
    const res = await agent.get('/api/category-hints');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('hooks de synchronisation sur opérations', () => {
  it('upsert un hint quand on crée une op avec catégorie', async () => {
    await agent.post('/api/operations').send({
      label: 'CARREFOUR PARIS', amount: -45,
      date: '2026-04-05T00:00:00.000Z', bankId,
      category: 'Courses',
    });

    const hints = (await agent.get('/api/category-hints')).body;
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ label: 'CARREFOUR PARIS', category: 'Courses' });
  });

  it('ne crée pas de hint si la catégorie est nulle', async () => {
    await agent.post('/api/operations').send({
      label: 'CARREFOUR PARIS', amount: -45,
      date: '2026-04-05T00:00:00.000Z', bankId,
    });

    const hints = (await agent.get('/api/category-hints')).body;
    expect(hints).toHaveLength(0);
  });

  it('upsert un hint quand on assigne une catégorie via PUT', async () => {
    const { body: op } = await agent.post('/api/operations').send({
      label: 'CARREFOUR PARIS', amount: -45,
      date: '2026-04-05T00:00:00.000Z', bankId,
    });

    await agent.put(`/api/operations/${op._id}`).send({ category: 'Courses' });

    const hints = (await agent.get('/api/category-hints')).body;
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ label: 'CARREFOUR PARIS', category: 'Courses' });
  });

  it('met à jour le hint quand on change la catégorie', async () => {
    const { body: op } = await agent.post('/api/operations').send({
      label: 'CARREFOUR PARIS', amount: -45,
      date: '2026-04-05T00:00:00.000Z', bankId,
      category: 'Courses',
    });
    await agent.put(`/api/operations/${op._id}`).send({ category: 'Alimentation' });

    const hints = (await agent.get('/api/category-hints')).body;
    expect(hints).toHaveLength(1);
    expect(hints[0].category).toBe('Alimentation');
  });

  it('supprime le hint quand on efface la catégorie (PUT category=null)', async () => {
    const { body: op } = await agent.post('/api/operations').send({
      label: 'CARREFOUR PARIS', amount: -45,
      date: '2026-04-05T00:00:00.000Z', bankId,
      category: 'Courses',
    });
    await agent.put(`/api/operations/${op._id}`).send({ category: null });

    const hints = (await agent.get('/api/category-hints')).body;
    expect(hints).toHaveLength(0);
  });
});

describe('POST /api/category-hints/rebuild', () => {
  it('reconstruit le cache depuis les opérations catégorisées', async () => {
    // On crée plusieurs ops sans laisser le hook les indexer (insertion en bulk
    // via le repo direct) — pour simuler un état où les hints sont obsolètes.
    await agent.post('/api/operations').send({
      label: 'LOYER', amount: -800,
      date: '2026-04-05T00:00:00.000Z', bankId,
      category: 'Logement',
    });
    await agent.post('/api/operations').send({
      label: 'CARREFOUR', amount: -45,
      date: '2026-04-10T00:00:00.000Z', bankId,
      category: 'Courses',
    });

    // Reset puis rebuild
    await agent.delete('/api/category-hints');
    expect((await agent.get('/api/category-hints')).body).toEqual([]);

    const res = await agent.post('/api/category-hints/rebuild');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);

    const hints = (await agent.get('/api/category-hints')).body;
    expect(hints).toHaveLength(2);
    const byLabel = Object.fromEntries(hints.map((h) => [h.label, h.category]));
    expect(byLabel.LOYER).toBe('Logement');
    expect(byLabel.CARREFOUR).toBe('Courses');
  });

  it('prend la catégorie majoritaire en cas de conflit sur un même libellé', async () => {
    // 2 ops "VIRT" en "Salaire", 1 op "VIRT" en "Autre" → majoritaire = Salaire
    await agent.post('/api/operations').send({
      label: 'VIRT', amount: 2500, date: '2026-04-01T00:00:00.000Z', bankId, category: 'Salaire',
    });
    await agent.post('/api/operations').send({
      label: 'VIRT', amount: 2500, date: '2026-04-02T00:00:00.000Z', bankId, category: 'Salaire',
    });
    await agent.post('/api/operations').send({
      label: 'VIRT', amount: 100, date: '2026-04-03T00:00:00.000Z', bankId, category: 'Autre',
    });

    await agent.post('/api/category-hints/rebuild');
    const hints = (await agent.get('/api/category-hints')).body;
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ label: 'VIRT', category: 'Salaire' });
  });
});

describe('DELETE /api/category-hints', () => {
  it('vide les hints de l\'utilisateur', async () => {
    await agent.post('/api/operations').send({
      label: 'LOYER', amount: -800,
      date: '2026-04-05T00:00:00.000Z', bankId,
      category: 'Logement',
    });
    expect((await agent.get('/api/category-hints')).body).toHaveLength(1);

    const res = await agent.delete('/api/category-hints');
    expect(res.status).toBe(204);
    expect((await agent.get('/api/category-hints')).body).toEqual([]);
  });

  it('n\'affecte pas les hints d\'un autre utilisateur', async () => {
    await agent.post('/api/operations').send({
      label: 'LOYER', amount: -800,
      date: '2026-04-05T00:00:00.000Z', bankId,
      category: 'Logement',
    });

    const bob = request.agent(app);
    await createVerifiedUser(app, 'bob@test.com', 'pass1234');
    await bob.post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass1234' });
    const bobBankId = (await bob.post('/api/banks').send({ label: 'CA', currentBalance: 0 })).body._id;
    await bob.post('/api/operations').send({
      label: 'COURSES', amount: -30,
      date: '2026-04-05T00:00:00.000Z', bankId: bobBankId,
      category: 'Alimentation',
    });

    await agent.delete('/api/category-hints');
    expect((await bob.get('/api/category-hints')).body).toHaveLength(1);
  });
});
