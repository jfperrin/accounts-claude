const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

router.get('/', wrap(async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ message: 'periodId requis' });
  res.json(await req.app.locals.db.operations.findByPeriod(periodId, req.user._id));
}));

router.post('/', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.create({ ...req.body, userId: req.user._id });
  res.status(201).json(op);
}));

router.put('/:id', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.update(req.params.id, req.user._id, req.body);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.operations.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

router.patch('/:id/point', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.togglePointed(req.params.id, req.user._id);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

router.post('/import-recurring', wrap(async (req, res) => {
  const { periodId } = req.body;
  if (!periodId) return res.status(400).json({ message: 'periodId requis' });

  const { operations, periods, recurringOps } = req.app.locals.db;
  const userId = req.user._id;

  const period = await periods.findOne(periodId, userId);
  if (!period) return res.status(404).json({ message: 'Période introuvable' });

  const recurring = await recurringOps.findByUserRaw(userId);
  if (!recurring.length) return res.json({ imported: 0 });

  const existing = await operations.findByPeriodMinimal(periodId, userId);
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
        userId,
        pointed: false,
      };
    });

  await operations.insertMany(toInsert);
  res.json({ imported: toInsert.length });
}));

module.exports = router;
