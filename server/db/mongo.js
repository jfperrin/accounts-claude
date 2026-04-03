const Bank = require('../models/Bank');
const User = require('../models/User');
const Operation = require('../models/Operation');
const Period = require('../models/Period');
const RecurringOperation = require('../models/RecurringOperation');

const users = {
  findByUsername: (username) => User.findOne({ username }),
  findByGoogleId: (googleId) => User.findOne({ googleId }),
  findById: (id) => User.findById(id).select('-passwordHash'),
  findByIdWithHash: (id) => User.findById(id),
  create: (data) => User.create(data),
  usernameExists: async (username) => !!(await User.findOne({ username })),
};

const banks = {
  findByUser: (userId) => Bank.find({ userId }).sort('label'),
  create: ({ label, userId }) => Bank.create({ label, userId }),
  update: (id, userId, data) =>
    Bank.findOneAndUpdate({ _id: id, userId }, data, { returnDocument: 'after' }),
  delete: (id, userId) => Bank.findOneAndDelete({ _id: id, userId }),
};

const operations = {
  findByPeriod: (periodId, userId) =>
    Operation.find({ periodId, userId }).populate('bankId', 'label').sort('date'),

  findByPeriodMinimal: (periodId, userId) =>
    Operation.find({ periodId, userId }).select('label bankId amount'),

  create: async (data) => {
    const op = await Operation.create(data);
    return op.populate('bankId', 'label');
  },

  update: (id, userId, data) =>
    Operation.findOneAndUpdate({ _id: id, userId }, data, { returnDocument: 'after' })
      .populate('bankId', 'label'),

  delete: (id, userId) => Operation.findOneAndDelete({ _id: id, userId }),

  deleteByPeriod: (periodId, userId) => Operation.deleteMany({ periodId, userId }),

  findById: (id, userId) => Operation.findOne({ _id: id, userId }),

  togglePointed: async (id, userId) => {
    const op = await Operation.findOne({ _id: id, userId });
    if (!op) return null;
    op.pointed = !op.pointed;
    await op.save();
    return op;
  },

  insertMany: (items) => Operation.insertMany(items),
};

const periods = {
  findByUser: (userId) => Period.find({ userId }).sort({ year: -1, month: -1 }),
  create: (data) => Period.create(data),
  findOne: (id, userId) => Period.findOne({ _id: id, userId }),
  updateBalances: (id, userId, balances) =>
    Period.findOneAndUpdate({ _id: id, userId }, { $set: { balances } }, { returnDocument: 'after' }),
  delete: (id, userId) => Period.findOneAndDelete({ _id: id, userId }),
};

const recurringOps = {
  findByUser: (userId) =>
    RecurringOperation.find({ userId }).populate('bankId', 'label').sort('label'),

  findByUserRaw: (userId) => RecurringOperation.find({ userId }),

  create: async (data) => {
    const op = await RecurringOperation.create(data);
    return op.populate('bankId', 'label');
  },

  update: (id, userId, data) =>
    RecurringOperation.findOneAndUpdate({ _id: id, userId }, data, { returnDocument: 'after' })
      .populate('bankId', 'label'),

  delete: (id, userId) => RecurringOperation.findOneAndDelete({ _id: id, userId }),
};

module.exports = { users, banks, operations, periods, recurringOps };
