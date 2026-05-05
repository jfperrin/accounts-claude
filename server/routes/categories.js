const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const { CATEGORIES: DEFAULTS } = require('../constants/categories');

const KINDS = ['debit', 'credit', 'transfer'];

// Normalise maxAmount : "" / null / undefined → null ; sinon Number positif fini
function parseMaxAmount(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return n;
}

function parseKind(raw) {
  if (raw === undefined) return undefined;
  return KINDS.includes(raw) ? raw : 'invalid';
}

// GET /api/categories
router.get('/', wrap(async (req, res) => {
  const { categories } = req.app.locals.db;
  const userId = req.user._id;

  let cats = await categories.findByUser(userId);
  if (!cats.length) {
    await Promise.all(DEFAULTS.map((label) => categories.create({ label, userId })));
    cats = await categories.findByUser(userId);
  }
  res.json(cats);
}));

// POST /api/categories  { label, color?, maxAmount?, kind? }
router.post('/', wrap(async (req, res) => {
  const { label, color } = req.body;
  if (!label?.trim()) return res.status(400).json({ message: 'label requis' });

  const maxAmount = parseMaxAmount(req.body.maxAmount);
  if (maxAmount === 'invalid') return res.status(400).json({ message: 'maxAmount invalide' });
  const kind = parseKind(req.body.kind);
  if (kind === 'invalid') return res.status(400).json({ message: 'kind invalide' });

  const cat = await req.app.locals.db.categories.create({
    label: label.trim(),
    color: color ?? null,
    maxAmount: maxAmount === undefined ? null : maxAmount,
    kind: kind ?? 'debit',
    userId: req.user._id,
  });
  res.status(201).json(cat);
}));

// PUT /api/categories/:id  { label, color?, maxAmount?, kind? }
router.put('/:id', wrap(async (req, res) => {
  const { label, color } = req.body;
  if (!label?.trim()) return res.status(400).json({ message: 'label requis' });

  const maxAmount = parseMaxAmount(req.body.maxAmount);
  if (maxAmount === 'invalid') return res.status(400).json({ message: 'maxAmount invalide' });
  const kind = parseKind(req.body.kind);
  if (kind === 'invalid') return res.status(400).json({ message: 'kind invalide' });

  const cat = await req.app.locals.db.categories.update(req.params.id, req.user._id, {
    label: label.trim(),
    color: color ?? null,
    maxAmount,
    kind,
  });
  if (!cat) return res.status(404).json({ message: 'Introuvable' });
  res.json(cat);
}));

// DELETE /api/categories/:id
router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.categories.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

module.exports = router;
