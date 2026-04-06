// Implémentation des repositories en MongoDB via Mongoose.
// Utilisée en production (MONGODB_URI présente et NODE_ENV != 'development').
//
// Chaque méthode expose la même interface que le repo SQLite pour que les routes
// n'aient pas à distinguer les deux backends.
//
// Points spécifiques à Mongoose :
//  - Les IDs sont des ObjectId (Mongoose les caste depuis les strings automatiquement)
//  - .populate('bankId', 'label') réalise un JOIN en mémoire après la requête principale
//  - findOneAndUpdate avec { returnDocument: 'after' } retourne le document mis à jour
//  - Le code d'erreur 11000 (duplicate key) est natif MongoDB pour la contrainte d'unicité

const Bank = require('../models/Bank');
const User = require('../models/User');
const Operation = require('../models/Operation');
const Period = require('../models/Period');
const RecurringOperation = require('../models/RecurringOperation');

// ─── USERS ───────────────────────────────────────────────────────────────────
// findById exclut passwordHash via .select('-passwordHash') pour ne pas
// l'exposer dans req.user. findByIdWithHash est réservé à l'authentification.
const users = {
  findByUsername: (username) => User.findOne({ username }),
  findByGoogleId: (googleId) => User.findOne({ googleId }),
  findById: (id) => User.findById(id).select('-passwordHash'),
  findByIdWithHash: (id) => User.findById(id),
  create: (data) => User.create(data),
  usernameExists: async (username) => !!(await User.findOne({ username })),

  updateProfile: (id, data) =>
    User.findByIdAndUpdate(id, { $set: data }, { new: true }).select('-passwordHash'),

  updateAvatar: (id, avatarUrl) =>
    User.findByIdAndUpdate(id, { $set: { avatarUrl } }, { new: true }).select('-passwordHash'),
};

// ─── BANKS ───────────────────────────────────────────────────────────────────
// Toutes les requêtes scopent sur userId pour l'isolation des données.
// findOneAndUpdate/findOneAndDelete filtrent sur { _id, userId } :
// impossible de modifier la banque d'un autre utilisateur même en connaissant l'ID.
const banks = {
  findByUser: (userId) => Bank.find({ userId }).sort('label'),
  create: ({ label, userId }) => Bank.create({ label, userId }),
  update: (id, userId, data) =>
    Bank.findOneAndUpdate({ _id: id, userId }, data, { returnDocument: 'after' }),
  delete: (id, userId) => Bank.findOneAndDelete({ _id: id, userId }),
};

// ─── OPERATIONS ──────────────────────────────────────────────────────────────
// findByPeriod et create/update chaînent .populate('bankId', 'label') pour que
// le client reçoive bankId sous forme d'objet { _id, label } plutôt qu'un ID brut.
//
// findByPeriodMinimal ne populate pas : on veut les IDs bruts pour construire
// la clé de déduplication "label|bankId|amount" dans import-recurring.
//
// togglePointed charge le document puis inverse pointed et appelle .save()
// plutôt qu'un $set : plus lisible, et évite une course (la valeur inversée
// est toujours l'opposé de la valeur courante en base, pas d'une variable locale).
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

// ─── PERIODS ─────────────────────────────────────────────────────────────────
// La contrainte d'unicité (month, year, userId) est définie dans le modèle Mongoose
// avec schema.index({ month, year, userId }, { unique: true }).
// En cas de doublon, MongoDB lève une erreur avec code 11000 — gérée dans la route.
//
// updateBalances utilise $set pour ne modifier que le champ balances sans écraser
// les autres champs du document.
//
// delete retourne le document supprimé pour que la route puisse déclencher
// la suppression en cascade des opérations de la période.
const periods = {
  findByUser: (userId) => Period.find({ userId }).sort({ year: -1, month: -1 }),
  create: (data) => Period.create(data),
  findOne: (id, userId) => Period.findOne({ _id: id, userId }),
  updateBalances: (id, userId, balances) =>
    Period.findOneAndUpdate({ _id: id, userId }, { $set: { balances } }, { returnDocument: 'after' }),
  delete: (id, userId) => Period.findOneAndDelete({ _id: id, userId }),
};

// ─── RECURRING OPERATIONS ────────────────────────────────────────────────────
// findByUserRaw retourne les documents Mongoose bruts (bankId = ObjectId).
// Utilisé dans import-recurring : la clé de déduplication "label|bankId|amount"
// fonctionne car les ObjectId se stringifient en hex identique des deux côtés
// (existingKeys depuis les opérations, et recurring depuis ce repo).
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
