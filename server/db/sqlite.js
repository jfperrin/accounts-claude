// Implémentation des repositories en SQLite via better-sqlite3.
// Utilisée quand NODE_ENV=development (ou MONGODB_URI absent).
//
// better-sqlite3 est synchrone : pas de callbacks ni de Promises.
// Les méthodes retournent directement leurs valeurs. Comme les routes
// utilisent "await", ça fonctionne : await d'une valeur non-Promise la renvoie telle quelle.
//
// IDs : UUID v4 via crypto.randomUUID() pour rester compatibles avec le format _id
// attendu par le client (le client ne distingue pas ObjectId et UUID).

const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

// Le fichier dev.db est créé à côté du dossier server/ s'il n'existe pas encore.
// SQLITE_PATH permet de surcharger l'emplacement (utile pour les tests).
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'dev.db');

// Crée toutes les tables si elles n'existent pas (idempotent grâce à IF NOT EXISTS).
// Appelé une seule fois au démarrage du serveur.
function initSchema(db) {
  db.pragma('journal_mode = WAL');  // meilleures performances en lecture/écriture concurrentes
  db.pragma('foreign_keys = ON');   // intégrité référentielle activée (désactivée par défaut dans SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      password_hash TEXT,           -- NULL pour les comptes Google (pas de mot de passe local)
      google_id   TEXT UNIQUE,      -- NULL pour les comptes locaux
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS banks (
      id              TEXT PRIMARY KEY,
      label           TEXT NOT NULL,
      user_id         TEXT NOT NULL REFERENCES users(id),
      current_balance REAL NOT NULL DEFAULT 0, -- saisi manuellement, base du solde projeté
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operations (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      amount     REAL NOT NULL,   -- négatif = débit, positif = crédit
      date       TEXT NOT NULL,   -- stockée en ISO 8601
      pointed    INTEGER NOT NULL DEFAULT 0, -- booléen SQLite : 0=false, 1=true
      bank_id    TEXT NOT NULL REFERENCES banks(id),
      user_id    TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recurring_operations (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL,
      amount       REAL NOT NULL,
      day_of_month INTEGER NOT NULL CHECK(day_of_month BETWEEN 1 AND 31),
      bank_id      TEXT NOT NULL REFERENCES banks(id),
      user_id      TEXT NOT NULL REFERENCES users(id),
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         TEXT PRIMARY KEY,
      token      TEXT NOT NULL UNIQUE,
      user_id    TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      user_id    TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: drop username column if it exists (schema change from username to email)
  // SQLite 3.35+ supports DROP COLUMN. The try/catch handles older versions gracefully.
  try {
    db.exec('ALTER TABLE users DROP COLUMN username');
  } catch (_) { /* column already dropped or SQLite < 3.35 */ }

  // Migration: suppression de la notion de Period.
  // L'ancien schéma avait une table `periods` et une colonne `period_id` dans
  // `operations`. Choix utilisateur : on drop ces données plutôt que de migrer.
  // On détecte la présence de l'ancien schéma via PRAGMA table_info et on droppe
  // operations + periods. Le CREATE TABLE IF NOT EXISTS au-dessus a déjà créé
  // la nouvelle structure si la base était vide ; le drop ci-dessous force la
  // recréation avec le bon schéma quand on migre une vieille base.
  const opsCols = db.prepare('PRAGMA table_info(operations)').all();
  const hasPeriodId = opsCols.some((c) => c.name === 'period_id');
  if (hasPeriodId) {
    db.exec('DROP TABLE IF EXISTS operations');
    db.exec('DROP TABLE IF EXISTS periods');
    // Recrée la table operations sans period_id
    db.exec(`
      CREATE TABLE operations (
        id         TEXT PRIMARY KEY,
        label      TEXT NOT NULL,
        amount     REAL NOT NULL,
        date       TEXT NOT NULL,
        pointed    INTEGER NOT NULL DEFAULT 0,
        bank_id    TEXT NOT NULL REFERENCES banks(id),
        user_id    TEXT NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  // Profile and role columns — idempotent: silently ignored if already exist
  for (const col of [
    "ALTER TABLE users ADD COLUMN role  TEXT NOT NULL DEFAULT 'user'",
    'ALTER TABLE users ADD COLUMN title      TEXT',
    'ALTER TABLE users ADD COLUMN first_name TEXT',
    'ALTER TABLE users ADD COLUMN last_name  TEXT',
    'ALTER TABLE users ADD COLUMN nickname   TEXT',
    'ALTER TABLE users ADD COLUMN avatar_url TEXT',
    'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE password_reset_tokens ADD COLUMN type TEXT NOT NULL DEFAULT 'password_reset'",
    'ALTER TABLE password_reset_tokens ADD COLUMN pending_email TEXT',
    'ALTER TABLE password_reset_tokens ADD COLUMN old_password_hash TEXT',
    // Solde courant des banques (saisi manuellement par l'utilisateur)
    'ALTER TABLE banks ADD COLUMN current_balance REAL NOT NULL DEFAULT 0',
    // Catégorie sur les opérations et récurrentes
    'ALTER TABLE operations ADD COLUMN category TEXT',
    'ALTER TABLE recurring_operations ADD COLUMN category TEXT',
    'ALTER TABLE users ADD COLUMN accepted_tos_at TEXT',
    'ALTER TABLE categories ADD COLUMN color TEXT',
  ]) {
    try { db.exec(col); } catch (_) { /* column already exists */ }
  }
}

// --- Fonctions de mapping SQLite row → objet métier ---
// Chaque mapper traduit les conventions SQL (snake_case, 0/1, JSON string)
// vers le format attendu par le client (camelCase, boolean, objet).

const mapUser = (row) => row && {
  _id:           row.id,
  passwordHash:  row.password_hash,
  googleId:      row.google_id,
  email:         row.email ?? null,
  emailVerified: row.email_verified === 1,
  role:          row.role ?? 'user',
  title:        row.title ?? null,
  firstName:    row.first_name ?? null,
  lastName:     row.last_name ?? null,
  nickname:     row.nickname ?? null,
  avatarUrl:    row.avatar_url ?? null,
  acceptedToSAt: row.accepted_tos_at ? new Date(row.accepted_tos_at) : null,
};

const mapBank = (row) => row && {
  _id: row.id,
  label: row.label,
  userId: row.user_id,
  currentBalance: row.current_balance ?? 0,
};

// mapOp est utilisé après un JOIN avec banks pour inclure { _id, label } dans bankId.
// Si bank_label est présent dans la row (JOIN réalisé), bankId devient un objet populé
// comme le ferait un .populate('bankId', 'label') de Mongoose.
const mapOp = (row) => row && {
  _id: row.id,
  label: row.label,
  amount: row.amount,
  date: row.date,
  pointed: row.pointed === 1,
  category: row.category ?? null,
  bankId: row.bank_label != null ? { _id: row.bank_id, label: row.bank_label } : row.bank_id,
  userId: row.user_id,
};

const mapRecurring = (row) => row && {
  _id: row.id,
  label: row.label,
  amount: row.amount,
  dayOfMonth: row.day_of_month,
  category: row.category ?? null,
  bankId: row.bank_label != null ? { _id: row.bank_id, label: row.bank_label } : row.bank_id,
  userId: row.user_id,
};

const mapCategory = (row) => row && {
  _id: row.id,
  label: row.label,
  color: row.color ?? null,
  userId: row.user_id,
};

const mapResetToken = (row) => row && {
  _id:             row.id,
  token:           row.token,
  userId:          row.user_id,
  expiresAt:       new Date(row.expires_at),
  used:            row.used === 1,
  type:            row.type ?? 'password_reset',
  pendingEmail:    row.pending_email ?? null,
  oldPasswordHash: row.old_password_hash ?? null,
};

// Fragments SQL réutilisés pour les SELECT avec JOIN banks.
// Le JOIN LEFT permet de récupérer l'opération même si la banque a été supprimée.
const OPS_WITH_BANK = `
  SELECT o.*, b.label AS bank_label
  FROM operations o LEFT JOIN banks b ON o.bank_id = b.id
`;

const RECUR_WITH_BANK = `
  SELECT r.*, b.label AS bank_label
  FROM recurring_operations r LEFT JOIN banks b ON r.bank_id = b.id
`;

module.exports = function createSQLiteRepos() {
  const db = new Database(DB_PATH);
  initSchema(db);
  console.log(`SQLite connected: ${DB_PATH}`);

  // Conversion systématique en string pour les IDs (MongoDB retourne des ObjectId,
  // SQLite attend des TEXT → on normalise avant chaque requête)
  const uid = (v) => String(v);

  // ─────────────────────────────────────────────
  // USERS
  // findById retourne sans password_hash (colonne exclue du SELECT)
  // pour éviter d'exposer le hash dans req.user via Passport deserializeUser.
  // findByIdWithHash est réservé à l'authentification locale.
  // ─────────────────────────────────────────────
  const users = {
    findByEmail: (email) =>
      mapUser(db.prepare('SELECT * FROM users WHERE email = ?').get(email)),

    findByGoogleId: (googleId) =>
      mapUser(db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId)),

    findById: (id) =>
      mapUser(db.prepare('SELECT id, email, email_verified, role, google_id, title, first_name, last_name, nickname, avatar_url, accepted_tos_at FROM users WHERE id = ?').get(id)),

    findByIdWithHash: (id) =>
      mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)),

    create({ email, passwordHash, googleId, role, emailVerified: emailVerifiedParam, acceptedToSAt }) {
      const id = randomUUID();
      const emailVerified = emailVerifiedParam ? 1 : (googleId ? 1 : 0);
      const tosAt = acceptedToSAt ? new Date(acceptedToSAt).toISOString() : null;
      db.prepare(
        'INSERT INTO users (id, email, password_hash, google_id, role, email_verified, accepted_tos_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, email, passwordHash ?? null, googleId ?? null, role ?? 'user', emailVerified, tosAt);
      return this.findById(id);
    },

    emailExists: (email) =>
      !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email),

    updateProfile(id, { title, firstName, lastName, nickname }) {
      db.prepare(
        `UPDATE users SET title=?, first_name=?, last_name=?, nickname=?, updated_at=datetime('now') WHERE id=?`
      ).run(title ?? null, firstName ?? null, lastName ?? null, nickname ?? null, uid(id));
      return this.findById(id);
    },

    updateEmail(id, email) {
      db.prepare(`UPDATE users SET email=?, updated_at=datetime('now') WHERE id=?`)
        .run(email, uid(id));
      return this.findById(id);
    },

    updateAvatar(id, avatarUrl) {
      db.prepare(`UPDATE users SET avatar_url=?, updated_at=datetime('now') WHERE id=?`)
        .run(avatarUrl ?? null, uid(id));
      return this.findById(id);
    },

    findAll() {
      return db.prepare(
        'SELECT id, email, email_verified, role, title, first_name, last_name, nickname, avatar_url, accepted_tos_at, created_at FROM users ORDER BY created_at DESC',
      ).all().map(mapUser);
    },

    updateByAdmin(id, { email, role }) {
      db.prepare(
        `UPDATE users SET email=?, role=?, updated_at=datetime('now') WHERE id=?`,
      ).run(email ?? null, role ?? 'user', uid(id));
      return this.findById(id);
    },

    deleteUser(id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(uid(id));
    },

    setPassword(id, passwordHash) {
      db.prepare(
        `UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`
      ).run(passwordHash, uid(id));
    },

    setEmailVerified(id) {
      db.prepare(`UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`).run(uid(id));
      return this.findById(id);
    },

    applyPendingEmail(id, email) {
      db.prepare(
        `UPDATE users SET email = ?, email_verified = 1, updated_at = datetime('now') WHERE id = ?`
      ).run(email, uid(id));
      return this.findById(id);
    },

    acceptToS(id) {
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE users SET accepted_tos_at = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(now, uid(id));
      return this.findById(id);
    },
  };

  // ─────────────────────────────────────────────
  // BANKS
  // Toutes les requêtes filtrent sur user_id pour isoler les données par utilisateur.
  // update/delete retournent null si l'id n'appartient pas à l'utilisateur (0 changements).
  // ─────────────────────────────────────────────
  const banks = {
    findByUser: (userId) =>
      db.prepare('SELECT * FROM banks WHERE user_id = ? ORDER BY label').all(uid(userId)).map(mapBank),

    create({ label, userId, currentBalance = 0 }) {
      const id = randomUUID();
      db.prepare('INSERT INTO banks (id, label, user_id, current_balance) VALUES (?, ?, ?, ?)')
        .run(id, label, uid(userId), currentBalance);
      return mapBank(db.prepare('SELECT * FROM banks WHERE id = ?').get(id));
    },

    // Met à jour label et/ou currentBalance. On ne touche qu'aux champs fournis
    // (les undefined laissent la valeur courante intacte).
    update(id, userId, { label, currentBalance }) {
      const cur = db.prepare('SELECT * FROM banks WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      const newLabel = label !== undefined ? label : cur.label;
      const newBalance = currentBalance !== undefined ? currentBalance : cur.current_balance;
      db.prepare(
        "UPDATE banks SET label = ?, current_balance = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      ).run(newLabel, newBalance, id, uid(userId));
      return mapBank(db.prepare('SELECT * FROM banks WHERE id = ?').get(id));
    },

    findById: (id, userId) =>
      mapBank(db.prepare('SELECT * FROM banks WHERE id = ? AND user_id = ?').get(id, uid(userId))),

    delete: (id, userId) =>
      db.prepare('DELETE FROM banks WHERE id = ? AND user_id = ?').run(id, uid(userId)),

    deleteByUser: (userId) =>
      db.prepare('DELETE FROM banks WHERE user_id = ?').run(uid(userId)),
  };

  // ─────────────────────────────────────────────
  // OPERATIONS
  // findByMonth filtre les opérations dont la date tombe dans le mois/année
  // demandé. Le filtre se fait par préfixe ISO 'YYYY-MM' (les dates sont
  // stockées en ISO 8601, donc ce préfixe est lexicographique-équivalent
  // à month=mm/year=yyyy).
  //
  // findByMonthMinimal sert à la dédup CSV/récurrents : retourne uniquement
  // label/bankId/amount/date sans le JOIN bank.
  //
  // sumUnpointedByBank retourne un objet { [bankId]: somme } utilisé par
  // routes/banks.js pour calculer le projectedBalance.
  // ─────────────────────────────────────────────
  const operations = {
    findByMonth(month, year, userId) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return db.prepare(
        `${OPS_WITH_BANK} WHERE o.user_id = ? AND substr(o.date, 1, 7) = ? ORDER BY o.date DESC`,
      ).all(uid(userId), prefix).map(mapOp);
    },

    findByDateRange(start, end, userId) {
      return db.prepare(
        `${OPS_WITH_BANK} WHERE o.user_id = ? AND o.date >= ? AND o.date < ? ORDER BY o.date DESC`,
      ).all(uid(userId), start.toISOString(), end.toISOString()).map(mapOp);
    },

    findByMonthMinimal(month, year, userId) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return db.prepare(
        'SELECT label, bank_id AS bankId, amount, date FROM operations WHERE user_id = ? AND substr(date, 1, 7) = ?',
      ).all(uid(userId), prefix);
    },

    // Toutes les opérations de l'utilisateur en projection minimale.
    // Utilisée par l'import (CSV/QIF/OFX) pour deux choses :
    //   - dédup globale (label, bankId, amount, date)
    //   - réconciliation par montant + banque (besoin de _id et pointed pour
    //     filtrer les candidats déjà rapprochés et éviter de consommer 2× la même).
    findAllMinimal(userId) {
      return db.prepare(
        'SELECT id AS _id, label, bank_id AS bankId, amount, date, pointed, category FROM operations WHERE user_id = ?',
      ).all(uid(userId)).map((r) => ({
        _id: r._id,
        label: r.label,
        bankId: r.bankId,
        amount: r.amount,
        date: r.date,
        pointed: r.pointed === 1,
        category: r.category ?? null,
      }));
    },

    sumUnpointedByBank(userId) {
      const rows = db.prepare(
        'SELECT bank_id, SUM(amount) AS total FROM operations WHERE user_id = ? AND pointed = 0 GROUP BY bank_id',
      ).all(uid(userId));
      const out = {};
      for (const r of rows) out[r.bank_id] = r.total || 0;
      return out;
    },

    create({ label, amount, date, pointed = false, category = null, bankId, userId }) {
      const id = randomUUID();
      const dateStr = date instanceof Date ? date.toISOString() : date;
      db.prepare(
        'INSERT INTO operations (id, label, amount, date, pointed, category, bank_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(id, label, amount, dateStr, pointed ? 1 : 0, category ?? null, uid(bankId), uid(userId));
      return mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ?`).get(id));
    },

    update(id, userId, body) {
      // On charge la row courante pour conserver les champs non fournis dans le body
      const cur = db.prepare('SELECT * FROM operations WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      const { label = cur.label, amount = cur.amount, date = cur.date, bankId = cur.bank_id } = body;
      const pointed = body.pointed !== undefined ? (body.pointed ? 1 : 0) : cur.pointed;
      const category = body.category !== undefined ? (body.category ?? null) : (cur.category ?? null);
      const dateStr = date instanceof Date ? date.toISOString() : date;
      db.prepare(`
        UPDATE operations
        SET label = ?, amount = ?, date = ?, pointed = ?, category = ?, bank_id = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(label, amount, dateStr, pointed, category, uid(bankId), id, uid(userId));
      return mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ?`).get(id));
    },

    delete: (id, userId) =>
      db.prepare('DELETE FROM operations WHERE id = ? AND user_id = ?').run(id, uid(userId)),

    findById: (id, userId) =>
      mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ? AND o.user_id = ?`).get(id, uid(userId))),

    // Inverse pointed (0→1 ou 1→0) en deux requêtes : lecture puis mise à jour ciblée
    togglePointed(id, userId) {
      const cur = db.prepare('SELECT pointed FROM operations WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      db.prepare("UPDATE operations SET pointed = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
        .run(cur.pointed === 1 ? 0 : 1, id, uid(userId));
      return mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ?`).get(id));
    },

    // Transaction : toutes les insertions réussissent ou aucune n'est commitée
    insertMany(items) {
      const stmt = db.prepare(
        'INSERT INTO operations (id, label, amount, date, pointed, category, bank_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      );
      db.transaction((ops) => {
        for (const op of ops) {
          const dateStr = op.date instanceof Date ? op.date.toISOString() : op.date;
          stmt.run(randomUUID(), op.label, op.amount, dateStr, op.pointed ? 1 : 0,
            op.category ?? null, uid(op.bankId), uid(op.userId));
        }
      })(items);
    },
  };

  // ─────────────────────────────────────────────
  // RECURRING OPERATIONS
  // findByUserRaw retourne bankId comme ID brut (sans JOIN) :
  // utilisé dans import-recurring pour la déduplication par clé "label|bankId|amount".
  // findByUser retourne bankId populé (avec JOIN) : utilisé pour l'affichage dans l'UI.
  // ─────────────────────────────────────────────
  const recurringOps = {
    findByUser: (userId) =>
      db.prepare(`${RECUR_WITH_BANK} WHERE r.user_id = ? ORDER BY r.label`)
        .all(uid(userId)).map(mapRecurring),

    findByUserRaw: (userId) =>
      db.prepare('SELECT * FROM recurring_operations WHERE user_id = ?').all(uid(userId)).map((r) => ({
        _id: r.id,
        label: r.label,
        amount: r.amount,
        dayOfMonth: r.day_of_month,
        category: r.category ?? null,
        bankId: r.bank_id, // ID brut pour la déduplication
        userId: r.user_id,
      })),

    create({ label, amount, dayOfMonth, category = null, bankId, userId }) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO recurring_operations (id, label, amount, day_of_month, category, bank_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, label, amount, dayOfMonth, category ?? null, uid(bankId), uid(userId));
      return mapRecurring(db.prepare(`${RECUR_WITH_BANK} WHERE r.id = ?`).get(id));
    },

    update(id, userId, body) {
      const cur = db.prepare('SELECT * FROM recurring_operations WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      const { label = cur.label, amount = cur.amount, dayOfMonth = cur.day_of_month, bankId = cur.bank_id } = body;
      const category = body.category !== undefined ? (body.category ?? null) : (cur.category ?? null);
      db.prepare(`
        UPDATE recurring_operations
        SET label = ?, amount = ?, day_of_month = ?, category = ?, bank_id = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(label, amount, dayOfMonth, category, uid(bankId), id, uid(userId));
      return mapRecurring(db.prepare(`${RECUR_WITH_BANK} WHERE r.id = ?`).get(id));
    },

    delete: (id, userId) =>
      db.prepare('DELETE FROM recurring_operations WHERE id = ? AND user_id = ?').run(id, uid(userId)),

    deleteByUser: (userId) =>
      db.prepare('DELETE FROM recurring_operations WHERE user_id = ?').run(uid(userId)),
  };

  // ─────────────────────────────────────────────
  // RESET TOKENS
  // Jetons temporaires pour la réinitialisation de mot de passe.
  // findValid retourne un token non-utilisé et non-expiré.
  // markUsed marque le token comme consommé pour l'empêcher de réutilisation.
  // deleteByUser supprime tous les tokens d'un utilisateur (e.g. lors de la suppression du compte).
  // ─────────────────────────────────────────────
  const resetTokens = {
    create(userId, token, expiresAt, { type = 'password_reset', pendingEmail = null, oldPasswordHash = null } = {}) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO password_reset_tokens (id, token, user_id, expires_at, type, pending_email, old_password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, token, uid(userId), expiresAt.toISOString(), type, pendingEmail ?? null, oldPasswordHash ?? null);
      return mapResetToken(db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(id));
    },

    findValid(token) {
      return mapResetToken(
        db.prepare(
          "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
        ).get(token),
      );
    },

    markUsed(token) {
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);
    },

    deleteByUser(userId) {
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(uid(userId));
    },
  };

  // ─────────────────────────────────────────────
  // CATEGORIES
  // ─────────────────────────────────────────────
  const categories = {
    findByUser: (userId) =>
      db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY label').all(uid(userId)).map(mapCategory),

    create({ label, color = null, userId }) {
      const id = randomUUID();
      db.prepare('INSERT INTO categories (id, label, color, user_id) VALUES (?, ?, ?, ?)').run(id, label, color ?? null, uid(userId));
      return mapCategory(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
    },

    update(id, userId, { label, color }) {
      const cur = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      const newColor = color !== undefined ? (color ?? null) : (cur.color ?? null);
      db.prepare("UPDATE categories SET label = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
        .run(label, newColor, id, uid(userId));
      return mapCategory(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
    },

    delete: (id, userId) =>
      db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, uid(userId)),
  };

  return { users, banks, operations, recurringOps, resetTokens, categories };
};
