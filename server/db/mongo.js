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
const PasswordResetToken = require('../models/PasswordResetToken');

// ─── USERS ───────────────────────────────────────────────────────────────────
// findById exclut passwordHash via .select('-passwordHash') pour ne pas
// l'exposer dans req.user. findByIdWithHash est réservé à l'authentification.
const users = {
  findByEmail: (email) => User.findOne({ email }),
  findByGoogleId: (googleId) => User.findOne({ googleId }),
  findById: (id) => User.findById(id).select('-passwordHash'),
  findByIdWithHash: (id) => User.findById(id),
  create: (data) => User.create({ emailVerified: !!data.googleId, ...data }),
  emailExists: async (email) => !!(await User.findOne({ email })),

  updateProfile: (id, { title, firstName, lastName, nickname }) =>
    User.findByIdAndUpdate(
      id,
      { $set: { title, firstName, lastName, nickname } },
      { new: true },
    ).select('-passwordHash'),

  updateEmail: (id, email) =>
    User.findByIdAndUpdate(id, { $set: { email } }, { new: true }).select('-passwordHash'),

  updateAvatar: (id, avatarUrl) =>
    User.findByIdAndUpdate(id, { $set: { avatarUrl } }, { new: true }).select('-passwordHash'),

  findAll: () =>
    User.find({}).select('-passwordHash').sort({ createdAt: -1 }),

  updateByAdmin: (id, { email, role }) =>
    User.findByIdAndUpdate(
      id,
      { $set: { email, role } },
      { new: true },
    ).select('-passwordHash'),

  deleteUser: (id) => User.findByIdAndDelete(id),

  setPassword: (id, passwordHash) =>
    User.findByIdAndUpdate(id, { $set: { passwordHash } }, { new: true }).select('-passwordHash'),

  setEmailVerified: (id) =>
    User.findByIdAndUpdate(id, { $set: { emailVerified: true } }, { new: true }).select('-passwordHash'),

  applyPendingEmail: (id, email) =>
    User.findByIdAndUpdate(id, { $set: { email, emailVerified: true } }, { new: true }).select('-passwordHash'),
};

// ─── BANKS ───────────────────────────────────────────────────────────────────
// Toutes les requêtes scopent sur userId pour l'isolation des données.
// findOneAndUpdate/findOneAndDelete filtrent sur { _id, userId } :
// impossible de modifier la banque d'un autre utilisateur même en connaissant l'ID.
const banks = {
  findByUser: (userId) => Bank.find({ userId }).sort('label'),
  deleteByUser: (userId) => Bank.deleteMany({ userId }),
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
  deleteByUser: (userId) => Period.deleteMany({ userId }),
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

  deleteByUser: (userId) => RecurringOperation.deleteMany({ userId }),

  create: async (data) => {
    const op = await RecurringOperation.create(data);
    return op.populate('bankId', 'label');
  },

  update: (id, userId, data) =>
    RecurringOperation.findOneAndUpdate({ _id: id, userId }, data, { returnDocument: 'after' })
      .populate('bankId', 'label'),

  delete: (id, userId) => RecurringOperation.findOneAndDelete({ _id: id, userId }),
};

// ─── RESET TOKENS ────────────────────────────────────────────────────────────────
const resetTokens = {
  create: (userId, token, expiresAt, { type = 'password_reset', pendingEmail = null, oldPasswordHash = null } = {}) =>
    PasswordResetToken.create({ token, userId, expiresAt, type, pendingEmail, oldPasswordHash }),

  findValid: (token) =>
    PasswordResetToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    }),

  markUsed: (token) =>
    PasswordResetToken.updateOne({ token }, { $set: { used: true } }),

  deleteByUser: (userId) =>
    PasswordResetToken.deleteMany({ userId }),
};

module.exports = { users, banks, operations, periods, recurringOps, resetTokens };
