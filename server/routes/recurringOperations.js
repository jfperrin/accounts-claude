const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.recurringOps.findByUser(req.user._id));
}));

router.post('/', wrap(async (req, res) => {
  const op = await req.app.locals.db.recurringOps.create({ ...req.body, userId: req.user._id });
  res.status(201).json(op);
}));

router.put('/:id', wrap(async (req, res) => {
  const op = await req.app.locals.db.recurringOps.update(req.params.id, req.user._id, req.body);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.recurringOps.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

module.exports = router;
