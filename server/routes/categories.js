const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const { CATEGORIES: DEFAULTS } = require('../constants/categories');

// GET /api/categories
// Retourne les catégories de l'utilisateur. Si l'utilisateur n'en a aucune,
// on insère les catégories par défaut (seed one-shot).
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

// POST /api/categories  { label }
router.post('/', wrap(async (req, res) => {
  const { label } = req.body;
  if (!label?.trim()) return res.status(400).json({ message: 'label requis' });
  const cat = await req.app.locals.db.categories.create({ label: label.trim(), userId: req.user._id });
  res.status(201).json(cat);
}));

// PUT /api/categories/:id  { label }
router.put('/:id', wrap(async (req, res) => {
  const { label } = req.body;
  if (!label?.trim()) return res.status(400).json({ message: 'label requis' });
  const cat = await req.app.locals.db.categories.update(req.params.id, req.user._id, { label: label.trim() });
  if (!cat) return res.status(404).json({ message: 'Introuvable' });
  res.json(cat);
}));

// DELETE /api/categories/:id
router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.categories.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

module.exports = router;
