const router = require('express').Router();
const Period = require('../models/Period');
const Operation = require('../models/Operation');
const wrap = require('../utils/asyncHandler');

const scope = (req) => ({ userId: req.user._id });

router.get('/', wrap(async (req, res) => {
  res.json(await Period.find(scope(req)).sort({ year: -1, month: -1 }));
}));

router.post('/', wrap(async (req, res) => {
  try {
    const period = await Period.create({ ...req.body, ...scope(req) });
    res.status(201).json(period);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Cette période existe déjà' });
    throw err;
  }
}));

router.patch('/:id/balances', wrap(async (req, res) => {
  const period = await Period.findOneAndUpdate(
    { _id: req.params.id, ...scope(req) },
    { $set: { balances: req.body } },
    { returnDocument: 'after' }
  );
  if (!period) return res.status(404).json({ message: 'Introuvable' });
  res.json(period);
}));

router.delete('/:id', wrap(async (req, res) => {
  const period = await Period.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  if (period) await Operation.deleteMany({ periodId: period._id, ...scope(req) });
  res.status(204).end();
}));

module.exports = router;
