const router = require('express').Router();
const RecurringOperation = require('../models/RecurringOperation');
const wrap = require('../utils/asyncHandler');

const scope = (req) => ({ userId: req.user._id });

router.get('/', wrap(async (req, res) => {
  res.json(await RecurringOperation.find(scope(req)).populate('bankId', 'label').sort('label'));
}));

router.post('/', wrap(async (req, res) => {
  const op = await RecurringOperation.create({ ...req.body, ...scope(req) });
  res.status(201).json(await op.populate('bankId', 'label'));
}));

router.put('/:id', wrap(async (req, res) => {
  const op = await RecurringOperation.findOneAndUpdate(
    { _id: req.params.id, ...scope(req) },
    req.body,
    { returnDocument: 'after' }
  ).populate('bankId', 'label');
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

router.delete('/:id', wrap(async (req, res) => {
  await RecurringOperation.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  res.status(204).end();
}));

module.exports = router;
