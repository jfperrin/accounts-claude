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

const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const User = require('../models/User');
const Operation = require('../models/Operation');
const RecurringOperation = require('../models/RecurringOperation');
const PasswordResetToken = require('../models/PasswordResetToken');
const Category = require('../models/Category');

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

  acceptToS: (id) =>
    User.findByIdAndUpdate(id, { $set: { acceptedToSAt: new Date() } }, { new: true }).select('-passwordHash'),
};

// ─── BANKS ───────────────────────────────────────────────────────────────────
// Toutes les requêtes scopent sur userId pour l'isolation des données.
// findOneAndUpdate/findOneAndDelete filtrent sur { _id, userId } :
// impossible de modifier la banque d'un autre utilisateur même en connaissant l'ID.
const banks = {
  findByUser: (userId) => Bank.find({ userId }).sort('label'),
  findById: (id, userId) => Bank.findOne({ _id: id, userId }),
  deleteByUser: (userId) => Bank.deleteMany({ userId }),
  create: ({ label, userId, currentBalance = 0 }) =>
    Bank.create({ label, userId, currentBalance }),
  // PUT /api/banks/:id accepte un sous-ensemble de { label, currentBalance } :
  // Mongoose ignore les undefined dans $set, donc seul ce qui est fourni est mis à jour.
  update: (id, userId, { label, currentBalance }) =>
    Bank.findOneAndUpdate(
      { _id: id, userId },
      { $set: { ...(label !== undefined && { label }), ...(currentBalance !== undefined && { currentBalance }) } },
      { returnDocument: 'after' },
    ),
  delete: (id, userId) => Bank.findOneAndDelete({ _id: id, userId }),
};

// ─── OPERATIONS ──────────────────────────────────────────────────────────────
// findByMonth filtre les opérations par mois/année via une plage [début, fin[
// portant sur le champ `date`. Les bornes sont en UTC pour éviter les décalages
// de timezone (les dates sont stockées en UTC).
//
// findByMonthMinimal ne populate pas bankId : utilisé pour la dédup côté
// import (CSV, récurrents) où on veut les IDs bruts.
//
// sumUnpointedByBank exécute une aggregation $group pour retourner
// { [bankId]: somme des montants non pointés }, utilisé pour calculer
// le projectedBalance dans routes/banks.js.
const operations = {
  findByMonth(month, year, userId) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return Operation.find({ userId, date: { $gte: start, $lt: end } })
      .populate('bankId', 'label').sort('-date');
  },

  findByMonthMinimal(month, year, userId) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return Operation.find({ userId, date: { $gte: start, $lt: end } })
      .select('label bankId amount date');
  },

  // Toutes les opérations de l'utilisateur en projection minimale.
  // Utilisée par l'import (CSV/QIF/OFX) pour dédup globale + réconciliation
  // par montant : besoin de _id pour le tracking et pointed pour filtrer.
  findAllMinimal(userId) {
    return Operation.find({ userId }).select('label bankId amount date pointed category');
  },

  async sumUnpointedByBank(userId) {
    const rows = await Operation.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(userId)), pointed: false } },
      { $group: { _id: '$bankId', total: { $sum: '$amount' } } },
    ]);
    const out = {};
    for (const r of rows) out[String(r._id)] = r.total;
    return out;
  },

  create: async (data) => {
    const op = await Operation.create(data);
    return op.populate('bankId', 'label');
  },

  update: (id, userId, data) =>
    Operation.findOneAndUpdate({ _id: id, userId }, data, { returnDocument: 'after' })
      .populate('bankId', 'label'),

  delete: (id, userId) => Operation.findOneAndDelete({ _id: id, userId }),

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

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
const categories = {
  findByUser: (userId) => Category.find({ userId }).sort('label'),

  create: (data) => Category.create(data),

  update: (id, userId, { label }) =>
    Category.findOneAndUpdate({ _id: id, userId }, { $set: { label } }, { returnDocument: 'after' }),

  delete: (id, userId) => Category.findOneAndDelete({ _id: id, userId }),
};

module.exports = { users, banks, operations, recurringOps, resetTokens, categories };
