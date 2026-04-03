const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.periods.findByUser(req.user._id));
}));

router.post('/', wrap(async (req, res) => {
  try {
    const period = await req.app.locals.db.periods.create({ ...req.body, userId: req.user._id });
    res.status(201).json(period);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Cette période existe déjà' });
    throw err;
  }
}));

router.patch('/:id/balances', wrap(async (req, res) => {
  const period = await req.app.locals.db.periods.updateBalances(req.params.id, req.user._id, req.body);
  if (!period) return res.status(404).json({ message: 'Introuvable' });
  res.json(period);
}));

router.delete('/:id', wrap(async (req, res) => {
  const { periods, operations } = req.app.locals.db;
  const period = await periods.delete(req.params.id, req.user._id);
  if (period) await operations.deleteByPeriod(period._id, req.user._id);
  res.status(204).end();
}));

module.exports = router;
