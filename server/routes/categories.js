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

// Normalise parentId : "" / null / "none" → null ; sinon string
function parseParentId(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '' || raw === 'none') return null;
  return String(raw);
}

// Vérifie qu'un parentId candidat est valide pour une catégorie cible.
// Règles :
//   - le parent existe et appartient au même user
//   - le parent est lui-même une racine (pas de petits-enfants — on limite à 1 niveau)
//   - le parent partage le même kind que l'enfant
//   - on ne peut pas être son propre parent
//   - la catégorie cible n'a pas elle-même d'enfants (sinon elle deviendrait un 2e niveau)
// Retourne null si OK, sinon un message d'erreur.
async function validateParent({ parentId, selfId, selfKind, userId, repo }) {
  if (parentId === null || parentId === undefined) return null;
  if (selfId && parentId === selfId) return 'Une catégorie ne peut pas être son propre parent';

  const all = await repo.findByUser(userId);
  const parent = all.find((c) => String(c._id) === String(parentId));
  if (!parent) return 'Catégorie parente introuvable';
  if (parent.parentId) return 'Le parent doit être une catégorie racine';
  if (selfKind && parent.kind !== selfKind) return 'Le parent doit avoir le même type (débit/crédit/virement)';

  if (selfId) {
    const hasKids = await repo.hasChildren(selfId, userId);
    if (hasKids) return 'Cette catégorie a des sous-catégories — elle ne peut pas devenir enfant';
  }
  return null;
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

// POST /api/categories  { label, color?, maxAmount?, kind?, parentId? }
router.post('/', wrap(async (req, res) => {
  const { label, color } = req.body;
  if (!label?.trim()) return res.status(400).json({ message: 'label requis' });

  const maxAmount = parseMaxAmount(req.body.maxAmount);
  if (maxAmount === 'invalid') return res.status(400).json({ message: 'maxAmount invalide' });
  const kind = parseKind(req.body.kind);
  if (kind === 'invalid') return res.status(400).json({ message: 'kind invalide' });
  const parentId = parseParentId(req.body.parentId);

  const repo = req.app.locals.db.categories;
  const err = await validateParent({
    parentId,
    selfId: null,
    selfKind: kind ?? 'debit',
    userId: req.user._id,
    repo,
  });
  if (err) return res.status(400).json({ message: err });

  const cat = await repo.create({
    label: label.trim(),
    color: color ?? null,
    maxAmount: maxAmount === undefined ? null : maxAmount,
    kind: kind ?? 'debit',
    parentId: parentId ?? null,
    userId: req.user._id,
  });
  res.status(201).json(cat);
}));

// PUT /api/categories/:id  { label, color?, maxAmount?, kind?, parentId? }
router.put('/:id', wrap(async (req, res) => {
  const { label, color } = req.body;
  if (!label?.trim()) return res.status(400).json({ message: 'label requis' });

  const maxAmount = parseMaxAmount(req.body.maxAmount);
  if (maxAmount === 'invalid') return res.status(400).json({ message: 'maxAmount invalide' });
  const kind = parseKind(req.body.kind);
  if (kind === 'invalid') return res.status(400).json({ message: 'kind invalide' });
  const parentId = parseParentId(req.body.parentId);

  const repo = req.app.locals.db.categories;

  // Pour la validation du parent on a besoin du kind effectif (corps ou existant).
  let effectiveKind = kind;
  if (parentId !== undefined && effectiveKind === undefined) {
    const all = await repo.findByUser(req.user._id);
    const cur = all.find((c) => String(c._id) === String(req.params.id));
    effectiveKind = cur?.kind ?? 'debit';
  }
  const err = await validateParent({
    parentId,
    selfId: req.params.id,
    selfKind: effectiveKind,
    userId: req.user._id,
    repo,
  });
  if (err) return res.status(400).json({ message: err });

  const cat = await repo.update(req.params.id, req.user._id, {
    label: label.trim(),
    color: color ?? null,
    maxAmount,
    kind,
    parentId,
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
