// Tests d'intégration de l'import (QIF) avec réconciliation par montant + similarité.
// Réconciliation auto exige :
//   - même bankId
//   - montant dans la tolérance (±10 %, même signe)
//   - date dans la fenêtre (±15 jours)
//   - libellé similaire (≥ SIMILARITY_THRESHOLD = 0.7)
// Sinon → insertion comme nouvelle opération.
// Endpoint : POST /api/operations/import (.qif, .ofx ou .zip).

const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

let agent;
let bankId;

// QIF minimal : 1 ou plusieurs transactions.
// `entries` : [{ label, amount, date: 'DD/MM/YYYY' }]
function qifBuffer(entries) {
  const lines = ['!Type:Bank'];
  for (const e of entries) {
    lines.push(`D${e.date}`, `T${e.amount}`, `P${e.label}`, '^');
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

async function importFile(file, fields = {}) {
  return agent
    .post('/api/operations/import')
    .field('bankId', fields.bankId || bankId)
    .attach('file', file, fields.filename || 'test.qif');
}

beforeEach(async () => {
  await clearDB();
  await createVerifiedUser(app, 'alice@test.com', 'pass1234');
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'alice@test.com', password: 'pass1234' });
  bankId = (await agent.post('/api/banks').send({ label: 'BNP', currentBalance: 1000 })).body._id;
});

describe('POST /api/operations/import', () => {
  it('rejette les fichiers CSV (extension supprimée)', async () => {
    const buf = Buffer.from('Date;Libellé;Montant\n25/04/2026;TEST;-50\n', 'utf8');
    const res = await agent
      .post('/api/operations/import')
      .field('bankId', bankId)
      .attach('file', buf, 'test.csv');
    expect(res.status).toBe(400);
  });

  it('insère une nouvelle op pointée quand aucun candidat n\'existe (0-match)', async () => {
    const buf = qifBuffer([{ label: 'LOYER', amount: -800, date: '05/04/2026' }]);
    const res = await importFile(buf);

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.autoReconciled).toBe(0);
    expect(res.body.pendingMatches).toEqual([]);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops).toHaveLength(1);
    expect(ops[0].label).toBe('LOYER');
    expect(ops[0].pointed).toBe(true);
  });

  it('réconcilie automatiquement quand exactement 1 candidat (1-match)', async () => {
    const { body: forecast } = await agent.post('/api/operations').send({
      label: 'Loyer',
      amount: -800,
      date: '2026-04-05T00:00:00.000Z',
      bankId,
    });

    const buf = qifBuffer([{ label: 'PRLV LOYER MARS', amount: -800, date: '04/04/2026' }]);
    const res = await importFile(buf);

    expect(res.body.imported).toBe(0);
    expect(res.body.autoReconciled).toBe(1);
    expect(res.body.pendingMatches).toEqual([]);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops).toHaveLength(1);
    expect(ops[0]._id).toBe(forecast._id);
    expect(ops[0].pointed).toBe(true);
    expect(ops[0].label).toBe('Loyer (PRLV LOYER MARS)');
  });

  it('réconcilie le meilleur candidat parmi plusieurs au même montant', async () => {
    // Deux ops au même montant : la similarité de libellé tranche en faveur de la 1ère.
    await agent.post('/api/operations').send({
      label: 'Loyer A', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
    });
    await agent.post('/api/operations').send({
      label: 'Loyer B', amount: -800, date: '2026-04-15T00:00:00.000Z', bankId,
    });

    const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -800, date: '04/04/2026' }]);
    const res = await importFile(buf);

    expect(res.body.imported).toBe(0);
    expect(res.body.autoReconciled).toBe(1);
    expect(res.body.pendingMatches).toEqual([]);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops).toHaveLength(2);
    // Une seule des deux est devenue pointée
    expect(ops.filter((o) => o.pointed)).toHaveLength(1);
  });

  it('insère plutôt que réconcilier quand le libellé est trop différent malgré le même montant', async () => {
    // Op existante au même montant mais libellé sans rapport → ne doit pas être consommée.
    await agent.post('/api/operations').send({
      label: 'Achat librairie', amount: -50, date: '2026-04-05T00:00:00.000Z', bankId,
    });

    const buf = qifBuffer([{ label: 'COURSES SUPERMARCHE', amount: -50, date: '06/04/2026' }]);
    const res = await importFile(buf);

    expect(res.body.imported).toBe(1);
    expect(res.body.autoReconciled).toBe(0);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops).toHaveLength(2);
    // L'op existante reste non pointée
    expect(ops.find((o) => o.label === 'Achat librairie').pointed).toBe(false);
  });

  it('ne consomme pas 2× la même cible quand 2 lignes du fichier matchent au même montant', async () => {
    await agent.post('/api/operations').send({
      label: 'CARTE PAIEMENT', amount: -50, date: '2026-04-05T00:00:00.000Z', bankId,
    });

    const buf = qifBuffer([
      { label: 'CARTE PAIEMENT 001', amount: -50, date: '06/04/2026' },
      { label: 'CARTE PAIEMENT 002', amount: -50, date: '07/04/2026' },
    ]);
    const res = await importFile(buf);

    // 1ère ligne réconcilie → 2e voit 0 candidat (consommé) → insertion
    expect(res.body.autoReconciled).toBe(1);
    expect(res.body.imported).toBe(1);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops).toHaveLength(2);
  });

  it('dédup stricte : ne ré-importe pas un fichier déjà importé', async () => {
    const buf = qifBuffer([{ label: 'COURSES', amount: -42, date: '10/04/2026' }]);
    await importFile(buf);
    const res = await importFile(buf);

    expect(res.body.imported).toBe(0);
    expect(res.body.duplicates).toBe(1);
  });

  it('dédup réconciliation : ne re-réconcilie pas après auto-reconcile', async () => {
    await agent.post('/api/operations').send({
      label: 'Loyer', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
    });

    const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -800, date: '04/04/2026' }]);
    await importFile(buf);
    const res = await importFile(buf);

    expect(res.body.imported).toBe(0);
    expect(res.body.autoReconciled).toBe(0);
    expect(res.body.duplicates).toBe(1);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops).toHaveLength(1);
  });

  it('exclut les ops pointées des candidats à la réconciliation', async () => {
    const { body: op } = await agent.post('/api/operations').send({
      label: 'Loyer', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
    });
    await agent.patch(`/api/operations/${op._id}/point`);

    const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -800, date: '04/04/2026' }]);
    const res = await importFile(buf);

    // Op pointée → ignorée → 0 candidat → insertion
    expect(res.body.imported).toBe(1);
    expect(res.body.autoReconciled).toBe(0);
  });

  describe('fenêtre temporelle (±15 jours)', () => {
    it('ne réconcilie pas avec une op hors fenêtre (mois précédent)', async () => {
      // Op de janvier (>15j), même montant, libellé similaire → ne doit PAS matcher.
      await agent.post('/api/operations').send({
        label: 'Loyer', amount: -800, date: '2026-01-05T00:00:00.000Z', bankId,
      });

      const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -800, date: '04/04/2026' }]);
      const res = await importFile(buf);

      expect(res.body.imported).toBe(1);
      expect(res.body.autoReconciled).toBe(0);
    });

    it('réconcilie aux bornes de la fenêtre (~15 jours)', async () => {
      // Op au jour 15, ligne au jour 30 → 15 jours d'écart → DOIT matcher.
      await agent.post('/api/operations').send({
        label: 'Loyer', amount: -800, date: '2026-04-15T00:00:00.000Z', bankId,
      });

      const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -800, date: '30/04/2026' }]);
      const res = await importFile(buf);

      expect(res.body.autoReconciled).toBe(1);
      expect(res.body.imported).toBe(0);
    });
  });

  describe('tolérance montant (±10 %)', () => {
    it('réconcilie quand le montant du fichier est dans la tolérance', async () => {
      // Op pré-saisie à -800, ligne du fichier à -805 (−0,625 %) → match.
      await agent.post('/api/operations').send({
        label: 'Loyer', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
      });

      const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -805, date: '04/04/2026' }]);
      const res = await importFile(buf);

      expect(res.body.autoReconciled).toBe(1);
      expect(res.body.imported).toBe(0);
    });

    it("n'accepte pas un écart hors tolérance (≥10 %)", async () => {
      // Op à -800, ligne à -900 (12,5 %) → trop d'écart → insertion séparée.
      await agent.post('/api/operations').send({
        label: 'Loyer', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
      });

      const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -900, date: '04/04/2026' }]);
      const res = await importFile(buf);

      expect(res.body.autoReconciled).toBe(0);
      expect(res.body.imported).toBe(1);
    });

    it('refuse de matcher des opérations de signe opposé (débit vs crédit)', async () => {
      // Op débit -800, ligne crédit +800 → jamais de match malgré valeur absolue identique.
      await agent.post('/api/operations').send({
        label: 'Loyer', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
      });

      const buf = qifBuffer([{ label: 'PRLV LOYER', amount: 800, date: '04/04/2026' }]);
      const res = await importFile(buf);

      expect(res.body.autoReconciled).toBe(0);
      expect(res.body.imported).toBe(1);
    });
  });

  describe('écrasement du montant à la réconciliation', () => {
    it('remplace le montant pré-saisi par celui du fichier', async () => {
      // Op pré-saisie à -800, ligne réelle à -805 → après réconciliation,
      // l'op doit afficher -805 (le fichier fait foi).
      const { body: forecast } = await agent.post('/api/operations').send({
        label: 'Loyer', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
      });

      const buf = qifBuffer([{ label: 'PRLV LOYER', amount: -805, date: '04/04/2026' }]);
      await importFile(buf);

      const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
      const updated = ops.find((o) => o._id === forecast._id);
      expect(updated).toBeDefined();
      expect(updated.amount).toBe(-805);
      expect(updated.pointed).toBe(true);
    });
  });

  describe('inférence de catégorie via category_hints', () => {
    it('hérite de la catégorie d\'une op pré-existante au libellé similaire', async () => {
      // Op manuelle catégorisée → on importe une nouvelle ligne au libellé proche
      // → la nouvelle op doit récupérer la même catégorie.
      await agent.post('/api/operations').send({
        label: 'CARREFOUR PARIS', amount: -45.10,
        date: '2026-04-02T00:00:00.000Z', bankId,
        category: 'Courses',
      });

      const buf = qifBuffer([{ label: 'CARREFOUR LYON', amount: -32.50, date: '20/04/2026' }]);
      await importFile(buf);

      const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
      const inserted = ops.find((o) => o.label === 'CARREFOUR LYON');
      expect(inserted).toBeDefined();
      expect(inserted.category).toBe('Courses');
    });
  });
});

describe('POST /api/operations/import/resolve', () => {
  let opAId, opBId;

  beforeEach(async () => {
    opAId = (await agent.post('/api/operations').send({
      label: 'Loyer A', amount: -800, date: '2026-04-05T00:00:00.000Z', bankId,
    })).body._id;
    opBId = (await agent.post('/api/operations').send({
      label: 'Loyer B', amount: -800, date: '2026-04-15T00:00:00.000Z', bankId,
    })).body._id;
  });

  it('réconcilie l\'op sélectionnée (label suffixé + pointée)', async () => {
    const importedRow = {
      label: 'PRLV LOYER',
      amount: -800,
      date: '2026-04-04T00:00:00.000Z',
      bankId,
    };
    const res = await agent.post('/api/operations/import/resolve').send({
      resolutions: [{ importedRow, selectedOpIds: [opAId] }],
    });

    expect(res.body.reconciled).toBe(1);
    expect(res.body.imported).toBe(0);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    const a = ops.find((o) => o._id === opAId);
    const b = ops.find((o) => o._id === opBId);
    expect(a.pointed).toBe(true);
    expect(a.label).toBe('Loyer A (PRLV LOYER)');
    expect(b.pointed).toBe(false);
    expect(b.label).toBe('Loyer B');
  });

  it('insère une nouvelle op si selectedOpIds est vide', async () => {
    const importedRow = {
      label: 'AUTRE',
      amount: -800,
      date: '2026-04-04T00:00:00.000Z',
      bankId,
    };
    const res = await agent.post('/api/operations/import/resolve').send({
      resolutions: [{ importedRow, selectedOpIds: [] }],
    });

    expect(res.body.imported).toBe(1);
    expect(res.body.reconciled).toBe(0);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops).toHaveLength(3);
    const inserted = ops.find((o) => o.label === 'AUTRE');
    expect(inserted).toBeDefined();
    expect(inserted.pointed).toBe(true);
  });

  it('réconcilie plusieurs ops sélectionnées avec le même suffixe', async () => {
    const importedRow = {
      label: 'PRLV LOYER',
      amount: -800,
      date: '2026-04-04T00:00:00.000Z',
      bankId,
    };
    const res = await agent.post('/api/operations/import/resolve').send({
      resolutions: [{ importedRow, selectedOpIds: [opAId, opBId] }],
    });

    expect(res.body.reconciled).toBe(2);

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    expect(ops.find((o) => o._id === opAId).label).toBe('Loyer A (PRLV LOYER)');
    expect(ops.find((o) => o._id === opBId).label).toBe('Loyer B (PRLV LOYER)');
    expect(ops.every((o) => o.pointed)).toBe(true);
  });

  it('rejette une résolution sans importedRow valide', async () => {
    const res = await agent.post('/api/operations/import/resolve').send({
      resolutions: [{ selectedOpIds: [opAId] }],
    });
    expect(res.status).toBe(400);
  });

  it('écrase le montant pré-saisi par celui de la ligne importée', async () => {
    const importedRow = {
      label: 'PRLV LOYER',
      amount: -805,
      date: '2026-04-04T00:00:00.000Z',
      bankId,
    };
    await agent.post('/api/operations/import/resolve').send({
      resolutions: [{ importedRow, selectedOpIds: [opAId] }],
    });

    const ops = (await agent.get('/api/operations').query({ startDate: '2026-04-01', endDate: '2026-04-30' })).body;
    const a = ops.find((o) => o._id === opAId);
    expect(a.amount).toBe(-805);
    expect(a.pointed).toBe(true);
  });
});
