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

const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const User = require('../models/User');
const Operation = require('../models/Operation');
const RecurringOperation = require('../models/RecurringOperation');
const PasswordResetToken = require('../models/PasswordResetToken');
const Category = require('../models/Category');
const CategoryHint = require('../models/CategoryHint');
const DismissedRecurringSuggestion = require('../models/DismissedRecurringSuggestion');
const MfaEmailCode = require('../models/MfaEmailCode');
const RefreshToken = require('../models/RefreshToken');

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
      { returnDocument: 'after' },
    ).select('-passwordHash'),

  updateEmail: (id, email) =>
    User.findByIdAndUpdate(id, { $set: { email } }, { returnDocument: 'after' }).select('-passwordHash'),

  updateAvatar: (id, avatarUrl) =>
    User.findByIdAndUpdate(id, { $set: { avatarUrl } }, { returnDocument: 'after' }).select('-passwordHash'),

  findAll: () =>
    User.find({}).select('-passwordHash').sort({ createdAt: -1 }),

  updateByAdmin: (id, { email, role, emailVerified }) =>
    User.findByIdAndUpdate(
      id,
      { $set: { email, role, ...(emailVerified !== undefined && { emailVerified }) } },
      { returnDocument: 'after' },
    ).select('-passwordHash'),

  deleteUser: (id) => User.findByIdAndDelete(id),

  setPassword: (id, passwordHash) =>
    User.findByIdAndUpdate(id, { $set: { passwordHash } }, { returnDocument: 'after' }).select('-passwordHash'),

  setEmailVerified: (id) =>
    User.findByIdAndUpdate(id, { $set: { emailVerified: true } }, { returnDocument: 'after' }).select('-passwordHash'),

  applyPendingEmail: (id, email) =>
    User.findByIdAndUpdate(id, { $set: { email, emailVerified: true } }, { returnDocument: 'after' }).select('-passwordHash'),

  acceptToS: (id) =>
    User.findByIdAndUpdate(id, { $set: { acceptedToSAt: new Date() } }, { returnDocument: 'after' }).select('-passwordHash'),

  updateMfa: (id, fields) => {
    const $set = {};
    if (Object.prototype.hasOwnProperty.call(fields, 'totpSecret'))     $set.totpSecret = fields.totpSecret;
    if (Object.prototype.hasOwnProperty.call(fields, 'totpEnabled'))    $set.totpEnabled = fields.totpEnabled;
    if (Object.prototype.hasOwnProperty.call(fields, 'emailMfaEnabled'))$set.emailMfaEnabled = fields.emailMfaEnabled;
    if (Object.prototype.hasOwnProperty.call(fields, 'recoveryCodes'))  $set.recoveryCodes = fields.recoveryCodes;
    return User.findByIdAndUpdate(id, { $set }, { returnDocument: 'after' }).select('-passwordHash');
  },

  // Retrait atomique d'un hash de recovery code. Retourne true si retiré, false si déjà absent.
  // Empêche la consommation concurrente d'un même code par 2 requêtes parallèles.
  pullRecoveryCode: async (id, hash) => {
    const result = await User.updateOne(
      { _id: id, recoveryCodes: hash },
      { $pull: { recoveryCodes: hash } },
    );
    return result.modifiedCount > 0;
  },

  // Incrémente atomiquement le compteur d'échecs MFA et renvoie la nouvelle valeur.
  incrementMfaFailures: async (id) => {
    const u = await User.findByIdAndUpdate(
      id,
      { $inc: { mfaFailedAttempts: 1 } },
      { returnDocument: 'after', select: 'mfaFailedAttempts' },
    );
    return u ? u.mfaFailedAttempts : 0;
  },

  // Pose un verrou temporaire (date) sur le MFA. Conserve mfaFailedAttempts pour suivi.
  setMfaLock: (id, until) =>
    User.findByIdAndUpdate(id, { $set: { mfaLockedUntil: until } }),

  // Remet à zéro le compteur et le lock (utilisé après un succès).
  resetMfaFailures: (id) =>
    User.findByIdAndUpdate(id, { $set: { mfaFailedAttempts: 0, mfaLockedUntil: null } }),
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

  findByDateRange(start, end, userId, filters = {}) {
    const query = { userId, date: { $gte: start, $lt: end } };
    if (filters.q) query.label = { $regex: filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (filters.categoryId === 'none') query.categoryId = null;
    else if (filters.categoryId) query.categoryId = filters.categoryId;
    if (filters.pointed === true || filters.pointed === false) query.pointed = filters.pointed;
    return Operation.find(query).populate('bankId', 'label').sort('-date');
  },

  // Toutes les opérations non pointées de l'utilisateur (toutes dates confondues).
  // Endpoint dédié pour HomePage.UnpointedOperationsList — évite de rapatrier
  // l'historique complet et de filtrer côté client.
  findUnpointed(userId) {
    return Operation.find({ userId, pointed: false })
      .populate('bankId', 'label')
      .sort('-date');
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
    return Operation.find({ userId }).select('label bankId amount date pointed categoryId transferId');
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

  findByTransferId: (transferId, userId) =>
    Operation.find({ transferId, userId }).populate('bankId', 'label'),

  deleteByTransferId: (transferId, userId) =>
    Operation.deleteMany({ transferId, userId }),

  // Lie deux opérations en virement interne via un transferId commun.
  // Validations strictes (banques différentes, montants opposés, pas déjà
  // liées). On lit les deux ops, on vérifie, puis on écrit en parallèle.
  async linkAsTransfer(idA, idB, userId) {
    const [a, b] = await Promise.all([
      Operation.findOne({ _id: idA, userId }),
      Operation.findOne({ _id: idB, userId }),
    ]);
    if (!a || !b) return { error: 'NOT_FOUND' };
    if (String(a._id) === String(b._id)) return { error: 'SAME_OP' };
    if (a.transferId || b.transferId) return { error: 'ALREADY_LINKED' };
    if (String(a.bankId) === String(b.bankId)) return { error: 'SAME_BANK' };
    if (Math.round(a.amount * 100) !== -Math.round(b.amount * 100)) return { error: 'AMOUNT_MISMATCH' };

    const transferId = randomUUID();
    await Operation.updateMany({ _id: { $in: [idA, idB] }, userId }, { $set: { transferId } });
    const [opA, opB] = await Promise.all([
      Operation.findOne({ _id: idA }).populate('bankId', 'label'),
      Operation.findOne({ _id: idB }).populate('bankId', 'label'),
    ]);
    return { transferId, opA, opB };
  },

  async unlinkTransfer(transferId, userId) {
    const res = await Operation.updateMany({ transferId, userId }, { $set: { transferId: null } });
    return res.modifiedCount ?? 0;
  },

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
// La suppression d'une catégorie déréfère les opérations, récurrentes et hints
// qui la pointent (équivalent du ON DELETE SET NULL/CASCADE de SQLite).
const categories = {
  findByUser: (userId) => Category.find({ userId }).sort('label'),

  create: (data) => Category.create(data),

  update: (id, userId, { label, color, maxAmount, kind, parentId }) =>
    Category.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          label,
          color: color ?? null,
          ...(maxAmount !== undefined && { maxAmount: maxAmount ?? null }),
          ...(kind !== undefined && { kind }),
          ...(parentId !== undefined && { parentId: parentId ?? null }),
        },
      },
      { returnDocument: 'after' },
    ),

  hasChildren: async (id, userId) => {
    const child = await Category.findOne({ userId, parentId: id }).select('_id').lean();
    return !!child;
  },

  async delete(id, userId) {
    const removed = await Category.findOneAndDelete({ _id: id, userId });
    if (!removed) return null;
    await Promise.all([
      // Enfants orphelins → racine (équivalent ON DELETE SET NULL SQLite)
      Category.updateMany({ userId, parentId: id }, { $set: { parentId: null } }),
      Operation.updateMany({ userId, categoryId: id }, { $set: { categoryId: null } }),
      RecurringOperation.updateMany({ userId, categoryId: id }, { $set: { categoryId: null } }),
      CategoryHint.deleteMany({ userId, categoryId: id }),
    ]);
    return removed;
  },
};

// ─── CATEGORY HINTS ──────────────────────────────────────────────────────────
// Cache label → catégorie. Une entrée par couple (userId, label) unique.
// rebuildFromOperations agrège en JS (parité avec SQLite) : on récupère les ops
// catégorisées, on groupe par label, on prend la catégorie majoritaire (à égalité,
// la plus récente). Truncate + insertMany dans la foulée.
const categoryHints = {
  findByUser: (userId) => CategoryHint.find({ userId }),

  upsert: (userId, label, categoryId) =>
    CategoryHint.updateOne(
      { userId, label },
      { $set: { categoryId } },
      { upsert: true },
    ),

  deleteHint: (userId, label) => CategoryHint.deleteOne({ userId, label }),

  deleteAll: (userId) => CategoryHint.deleteMany({ userId }),

  async rebuildFromOperations(userId) {
    const rows = await Operation.find({ userId, categoryId: { $ne: null } })
      .select('label categoryId updatedAt');

    const byLabel = new Map();
    for (const r of rows) {
      let entry = byLabel.get(r.label);
      if (!entry) {
        entry = { byCat: new Map(), latestCat: null, latestUpdated: 0 };
        byLabel.set(r.label, entry);
      }
      const cid = String(r.categoryId);
      entry.byCat.set(cid, (entry.byCat.get(cid) || 0) + 1);
      const t = r.updatedAt ? r.updatedAt.getTime() : 0;
      if (t > entry.latestUpdated) {
        entry.latestUpdated = t;
        entry.latestCat = cid;
      }
    }

    const docs = [];
    for (const [label, entry] of byLabel) {
      let winner = null;
      let max = 0;
      for (const [catId, count] of entry.byCat) {
        if (count > max || (count === max && catId === entry.latestCat)) {
          max = count;
          winner = catId;
        }
      }
      if (winner) docs.push({ userId, label, categoryId: winner });
    }

    await CategoryHint.deleteMany({ userId });
    if (docs.length) await CategoryHint.insertMany(docs);
    return byLabel.size;
  },
};

// ─── DISMISSED RECURRING SUGGESTIONS ─────────────────────────────────────────
// Clés (label normalisé + bankId) ignorées par l'utilisateur pour ne plus
// proposer une suggestion de récurrente automatiquement détectée.
const dismissedRecurringSuggestions = {
  findKeysByUser: async (userId) => {
    const rows = await DismissedRecurringSuggestion.find({ userId }).select('key');
    return rows.map((r) => r.key);
  },

  add: (userId, key) =>
    DismissedRecurringSuggestion.updateOne(
      { userId, key },
      { $setOnInsert: { userId, key } },
      { upsert: true },
    ),

  remove: (userId, key) =>
    DismissedRecurringSuggestion.deleteOne({ userId, key }),
};

// ─── MFA EMAIL CODES ──────────────────────────────────────────────────────────
const mfaCodes = {
  create: ({ userId, codeHash, purpose, expiresAt }) =>
    MfaEmailCode.create({ userId, codeHash, purpose, expiresAt }),

  findLatestValid: ({ userId, purpose }) =>
    MfaEmailCode.findOne({ userId, purpose, used: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 }),

  markUsed: (id) =>
    MfaEmailCode.findByIdAndUpdate(id, { $set: { used: true } }),

  countRecent: async ({ userId, purpose, sinceMs }) => {
    const since = new Date(Date.now() - sinceMs);
    return MfaEmailCode.countDocuments({ userId, purpose, createdAt: { $gt: since } });
  },

  deleteExpired: () =>
    MfaEmailCode.deleteMany({ expiresAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
};

// ─── REFRESH TOKENS ───────────────────────────────────────────────────────────
const refreshTokens = {
  create: ({ userId, tokenHash, userAgent, ip, expiresAt }) =>
    RefreshToken.create({ userId, tokenHash, userAgent, ip, expiresAt }),

  findByHash: (tokenHash) =>
    RefreshToken.findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } }),

  findActive: (userId) =>
    RefreshToken.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ lastUsedAt: -1 }),

  touchAndRotate: (id, newHash, newExpiresAt) =>
    RefreshToken.findByIdAndUpdate(
      id,
      { $set: { tokenHash: newHash, lastUsedAt: new Date(), expiresAt: newExpiresAt } },
    ),

  revokeById: (id, userId) =>
    RefreshToken.updateOne({ _id: id, userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),

  revokeOthers: (userId, exceptId) =>
    RefreshToken.updateMany(
      { userId, _id: { $ne: exceptId }, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ),

  revokeAll: (userId) =>
    RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),

  deleteExpired: () =>
    RefreshToken.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      ],
    }),
};

// ─── MIGRATION LEGACY : category (string) → categoryId (ObjectId) ────────────
// One-shot au boot. Chaque appel parcourt les collections concernées et résout
// le label texte vers l'_id de Category correspondant pour ce user. Idempotent :
// les docs sans `category` (déjà migrés) sont ignorés. Les libellés orphelins
// (catégorie supprimée) sont nullifiés. À la fin on $unset le champ legacy.
async function migrateLegacyCategoryFields() {
  const cats = await Category.find({}).select('_id userId label');
  // Index : `${userId}|${label}` → categoryId
  const lookup = new Map(cats.map((c) => [`${String(c.userId)}|${c.label}`, c._id]));

  for (const Model of [Operation, RecurringOperation]) {
    const docs = await Model.find({ category: { $exists: true, $ne: null } })
      .select('_id userId category');
    for (const d of docs) {
      const cid = lookup.get(`${String(d.userId)}|${d.category}`) ?? null;
      await Model.updateOne(
        { _id: d._id },
        { $set: { categoryId: cid }, $unset: { category: '' } },
      );
    }
    // Cleanup : retire le champ legacy résiduel sur les docs déjà migrés.
    await Model.updateMany({ category: { $exists: true } }, { $unset: { category: '' } });
  }

  // Hints : même logique, mais un hint sans cible n'a aucun sens → on supprime.
  const hints = await CategoryHint.find({ category: { $exists: true, $ne: null } })
    .select('_id userId category');
  for (const h of hints) {
    const cid = lookup.get(`${String(h.userId)}|${h.category}`) ?? null;
    if (cid) {
      await CategoryHint.updateOne(
        { _id: h._id },
        { $set: { categoryId: cid }, $unset: { category: '' } },
      );
    } else {
      await CategoryHint.deleteOne({ _id: h._id });
    }
  }
  await CategoryHint.updateMany({ category: { $exists: true } }, { $unset: { category: '' } });

  // Migration : la case "excludedFromBudget" a été remplacée par un 3e kind ('transfer').
  // Idempotent : les docs déjà migrés n'ont plus le champ et passent inaperçus.
  await Category.updateMany(
    { excludedFromBudget: true },
    { $set: { kind: 'transfer' }, $unset: { excludedFromBudget: '' } },
  );
  await Category.updateMany(
    { excludedFromBudget: { $exists: true } },
    { $unset: { excludedFromBudget: '' } },
  );

  // Migration : kind='transfer' supprimé au profit du transferId sur les opérations.
  // Les anciennes catégories 'transfer' redeviennent 'debit'. Idempotent.
  await Category.updateMany({ kind: 'transfer' }, { $set: { kind: 'debit' } });
}

module.exports = {
  users, banks, operations, recurringOps, resetTokens,
  categories, categoryHints, dismissedRecurringSuggestions, mfaCodes, refreshTokens,
  migrateLegacyCategoryFields,
};
