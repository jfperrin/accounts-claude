const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.banks.findByUser(req.user._id));
}));

router.post('/', wrap(async (req, res) => {
  const bank = await req.app.locals.db.banks.create({ label: req.body.label, userId: req.user._id });
  res.status(201).json(bank);
}));

router.put('/:id', wrap(async (req, res) => {
  const bank = await req.app.locals.db.banks.update(req.params.id, req.user._id, req.body);
  if (!bank) return res.status(404).json({ message: 'Introuvable' });
  res.json(bank);
}));

router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.banks.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

module.exports = router;
