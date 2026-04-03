const router = require('express').Router();
const Operation = require('../models/Operation');
const RecurringOperation = require('../models/RecurringOperation');
const Period = require('../models/Period');
const wrap = require('../utils/asyncHandler');

const scope = (req) => ({ userId: req.user._id });

router.get('/', wrap(async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ message: 'periodId requis' });
  res.json(await Operation.find({ periodId, ...scope(req) }).populate('bankId', 'label').sort('date'));
}));

router.post('/', wrap(async (req, res) => {
  const op = await Operation.create({ ...req.body, ...scope(req) });
  res.status(201).json(await op.populate('bankId', 'label'));
}));

router.put('/:id', wrap(async (req, res) => {
  const op = await Operation.findOneAndUpdate(
    { _id: req.params.id, ...scope(req) },
    req.body,
    { returnDocument: 'after' }
  ).populate('bankId', 'label');
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

router.delete('/:id', wrap(async (req, res) => {
  await Operation.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  res.status(204).end();
}));

router.patch('/:id/point', wrap(async (req, res) => {
  const op = await Operation.findOne({ _id: req.params.id, ...scope(req) });
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  op.pointed = !op.pointed;
  await op.save();
  res.json(op);
}));

router.post('/import-recurring', wrap(async (req, res) => {
  const { periodId } = req.body;
  if (!periodId) return res.status(400).json({ message: 'periodId requis' });

  const period = await Period.findOne({ _id: periodId, ...scope(req) });
  if (!period) return res.status(404).json({ message: 'Période introuvable' });

  const recurring = await RecurringOperation.find(scope(req));
  if (!recurring.length) return res.json({ imported: 0 });

  const existing = await Operation.find({ periodId, ...scope(req) }).select('label bankId amount');
  const existingKeys = new Set(existing.map((o) => `${o.label}|${o.bankId}|${o.amount}`));

  const toInsert = recurring
    .filter((r) => !existingKeys.has(`${r.label}|${r.bankId}|${r.amount}`))
    .map((r) => {
      const day = Math.min(r.dayOfMonth, new Date(period.year, period.month, 0).getDate());
      return {
        label: r.label,
        amount: r.amount,
        date: new Date(period.year, period.month - 1, day),
        bankId: r.bankId,
        periodId,
        userId: req.user._id,
        pointed: false,
      };
    });

  await Operation.insertMany(toInsert);
  res.json({ imported: toInsert.length });
}));

module.exports = router;
