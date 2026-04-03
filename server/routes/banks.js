const router = require('express').Router();
const Bank = require('../models/Bank');
const wrap = require('../utils/asyncHandler');

const scope = (req) => ({ userId: req.user._id });

router.get('/', wrap(async (req, res) => {
  res.json(await Bank.find(scope(req)).sort('label'));
}));

router.post('/', wrap(async (req, res) => {
  const bank = await Bank.create({ ...req.body, ...scope(req) });
  res.status(201).json(bank);
}));

router.put('/:id', wrap(async (req, res) => {
  const bank = await Bank.findOneAndUpdate({ _id: req.params.id, ...scope(req) }, req.body, { new: true });
  if (!bank) return res.status(404).json({ message: 'Introuvable' });
  res.json(bank);
}));

router.delete('/:id', wrap(async (req, res) => {
  await Bank.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  res.status(204).end();
}));

module.exports = router;
