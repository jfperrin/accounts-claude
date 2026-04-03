const router = require('express').Router();
const Period = require('../models/Period');
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

router.delete('/:id', wrap(async (req, res) => {
  await Period.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  res.status(204).end();
}));

module.exports = router;
