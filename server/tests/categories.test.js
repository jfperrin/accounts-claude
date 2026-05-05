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

describe('GET /api/categories', () => {
  it('retourne 401 sans auth', async () => {
    expect((await request(app).get('/api/categories')).status).toBe(401);
  });

  it('seed les catégories par défaut au premier appel', async () => {
    const res = await alice.get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].label).toBeDefined();
  });

  it('ne seed pas deux fois — idempotent', async () => {
    const res1 = await alice.get('/api/categories');
    const res2 = await alice.get('/api/categories');
    expect(res2.body).toHaveLength(res1.body.length);
  });

  it('isole les catégories par utilisateur', async () => {
    await alice.post('/api/categories').send({ label: 'Alice perso' });
    const res = await bob.get('/api/categories');
    expect(res.body.every((c) => c.label !== 'Alice perso')).toBe(true);
  });
});

describe('POST /api/categories', () => {
  it('crée une catégorie', async () => {
    const res = await alice.post('/api/categories').send({ label: 'Vacances' });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Vacances');
  });

  it('crée une catégorie avec couleur', async () => {
    const res = await alice.post('/api/categories').send({ label: 'Loisirs', color: '#ff0000' });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe('#ff0000');
  });

  it('rejette un label vide', async () => {
    expect((await alice.post('/api/categories').send({ label: '' })).status).toBe(400);
    expect((await alice.post('/api/categories').send({})).status).toBe(400);
  });

  it('retourne 401 sans auth', async () => {
    expect((await request(app).post('/api/categories').send({ label: 'Test' })).status).toBe(401);
  });
});

describe('PUT /api/categories/:id', () => {
  it('met à jour sa propre catégorie', async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'Ancien' });
    const res = await alice.put(`/api/categories/${cat._id}`).send({ label: 'Nouveau' });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Nouveau');
  });

  it('met à jour la couleur', async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'Test', color: '#aaaaaa' });
    const res = await alice.put(`/api/categories/${cat._id}`).send({ label: 'Test', color: '#ff0000' });
    expect(res.body.color).toBe('#ff0000');
  });

  it("ne peut pas modifier la catégorie d'un autre utilisateur", async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'Alice cat' });
    const res = await bob.put(`/api/categories/${cat._id}`).send({ label: 'Piraté' });
    expect(res.status).toBe(404);
  });

  it('rejette un label vide', async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'Test' });
    expect((await alice.put(`/api/categories/${cat._id}`).send({ label: '  ' })).status).toBe(400);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('supprime sa propre catégorie', async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'À supprimer' });
    expect((await alice.delete(`/api/categories/${cat._id}`)).status).toBe(204);
    const cats = (await alice.get('/api/categories')).body;
    expect(cats.every((c) => c._id !== cat._id)).toBe(true);
  });

  it("ne supprime pas la catégorie d'un autre utilisateur", async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'Alice cat' });
    await bob.delete(`/api/categories/${cat._id}`);
    const cats = (await alice.get('/api/categories')).body;
    expect(cats.some((c) => c._id === cat._id)).toBe(true);
  });

  it('retourne 204 même si l\'id est inconnu', async () => {
    expect((await alice.delete('/api/categories/000000000000000000000000')).status).toBe(204);
  });
});

describe('Sous-catégories (parentId)', () => {
  it('crée une sous-catégorie sous un parent racine', async () => {
    const { body: parent } = await alice.post('/api/categories').send({ label: 'Alimentation' });
    const res = await alice.post('/api/categories').send({ label: 'Restaurants', parentId: parent._id });
    expect(res.status).toBe(201);
    expect(String(res.body.parentId)).toBe(String(parent._id));
  });

  it('expose parentId=null par défaut sur les racines', async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'Loisirs' });
    expect(cat.parentId).toBeNull();
  });

  it('refuse un parentId inconnu', async () => {
    const res = await alice.post('/api/categories').send({ label: 'X', parentId: '000000000000000000000000' });
    expect(res.status).toBe(400);
  });

  it('refuse un parentId appartenant à un autre utilisateur', async () => {
    const { body: bobCat } = await bob.post('/api/categories').send({ label: 'Bob cat' });
    const res = await alice.post('/api/categories').send({ label: 'X', parentId: bobCat._id });
    expect(res.status).toBe(400);
  });

  it('refuse une sous-catégorie sous une sous-catégorie (max 1 niveau)', async () => {
    const { body: parent } = await alice.post('/api/categories').send({ label: 'A' });
    const { body: child } = await alice.post('/api/categories').send({ label: 'B', parentId: parent._id });
    const res = await alice.post('/api/categories').send({ label: 'C', parentId: child._id });
    expect(res.status).toBe(400);
  });

  it('refuse un parent de kind différent', async () => {
    const { body: parent } = await alice.post('/api/categories').send({ label: 'Salaires', kind: 'credit' });
    const res = await alice.post('/api/categories').send({ label: 'Prime', kind: 'debit', parentId: parent._id });
    expect(res.status).toBe(400);
  });

  it('refuse de devenir son propre parent en update', async () => {
    const { body: cat } = await alice.post('/api/categories').send({ label: 'Self' });
    const res = await alice.put(`/api/categories/${cat._id}`).send({ label: 'Self', parentId: cat._id });
    expect(res.status).toBe(400);
  });

  it("refuse de passer enfant une catégorie qui a elle-même des enfants", async () => {
    const { body: a } = await alice.post('/api/categories').send({ label: 'A' });
    const { body: b } = await alice.post('/api/categories').send({ label: 'B' });
    await alice.post('/api/categories').send({ label: 'A1', parentId: a._id });
    const res = await alice.put(`/api/categories/${a._id}`).send({ label: 'A', parentId: b._id });
    expect(res.status).toBe(400);
  });

  it("supprime un parent → les enfants remontent en racine", async () => {
    const { body: parent } = await alice.post('/api/categories').send({ label: 'Alim' });
    const { body: child } = await alice.post('/api/categories').send({ label: 'Resto', parentId: parent._id });
    expect((await alice.delete(`/api/categories/${parent._id}`)).status).toBe(204);
    const cats = (await alice.get('/api/categories')).body;
    const orphan = cats.find((c) => c._id === child._id);
    expect(orphan).toBeDefined();
    expect(orphan.parentId).toBeNull();
  });

  it('peut détacher une sous-catégorie via parentId=null', async () => {
    const { body: parent } = await alice.post('/api/categories').send({ label: 'P' });
    const { body: child } = await alice.post('/api/categories').send({ label: 'C', parentId: parent._id });
    const res = await alice.put(`/api/categories/${child._id}`).send({ label: 'C', parentId: null });
    expect(res.status).toBe(200);
    expect(res.body.parentId).toBeNull();
  });
});
