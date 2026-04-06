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
      username    TEXT NOT NULL UNIQUE,
      password_hash TEXT,           -- NULL pour les comptes Google (pas de mot de passe local)
      google_id   TEXT UNIQUE,      -- NULL pour les comptes locaux
      email       TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS banks (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      user_id    TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS periods (
      id         TEXT PRIMARY KEY,
      month      INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      year       INTEGER NOT NULL,
      user_id    TEXT NOT NULL REFERENCES users(id),
      balances   TEXT NOT NULL DEFAULT '{}', -- JSON : { "bankId": solde_initial }
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(month, year, user_id)           -- une seule période par mois/an/utilisateur
    );

    CREATE TABLE IF NOT EXISTS operations (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      amount     REAL NOT NULL,   -- négatif = débit, positif = crédit
      date       TEXT NOT NULL,   -- stockée en ISO 8601
      pointed    INTEGER NOT NULL DEFAULT 0, -- booléen SQLite : 0=false, 1=true
      bank_id    TEXT NOT NULL REFERENCES banks(id),
      period_id  TEXT NOT NULL REFERENCES periods(id),
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
  `);

  // Profile columns — idempotent: silently ignored if already exist
  for (const col of [
    'ALTER TABLE users ADD COLUMN title      TEXT',
    'ALTER TABLE users ADD COLUMN first_name TEXT',
    'ALTER TABLE users ADD COLUMN last_name  TEXT',
    'ALTER TABLE users ADD COLUMN nickname   TEXT',
    'ALTER TABLE users ADD COLUMN avatar_url TEXT',
  ]) {
    try { db.exec(col); } catch (_) { /* column already exists */ }
  }
}

// --- Fonctions de mapping SQLite row → objet métier ---
// Chaque mapper traduit les conventions SQL (snake_case, 0/1, JSON string)
// vers le format attendu par le client (camelCase, boolean, objet).

const mapUser = (row) => row && {
  _id:          row.id,
  username:     row.username,
  passwordHash: row.password_hash, // undefined si la colonne n'était pas dans le SELECT
  googleId:     row.google_id,
  email:        row.email,
  title:        row.title ?? null,
  firstName:    row.first_name ?? null,
  lastName:     row.last_name ?? null,
  nickname:     row.nickname ?? null,
  avatarUrl:    row.avatar_url ?? null,
};

const mapBank = (row) => row && {
  _id: row.id,
  label: row.label,
  userId: row.user_id,
};

const mapPeriod = (row) => row && {
  _id: row.id,
  month: row.month,
  year: row.year,
  userId: row.user_id,
  balances: JSON.parse(row.balances || '{}'), // restitué en objet JS
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
  bankId: row.bank_label != null ? { _id: row.bank_id, label: row.bank_label } : row.bank_id,
  periodId: row.period_id,
  userId: row.user_id,
};

const mapRecurring = (row) => row && {
  _id: row.id,
  label: row.label,
  amount: row.amount,
  dayOfMonth: row.day_of_month,
  bankId: row.bank_label != null ? { _id: row.bank_id, label: row.bank_label } : row.bank_id,
  userId: row.user_id,
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
    findByUsername: (username) =>
      mapUser(db.prepare('SELECT * FROM users WHERE username = ?').get(username)),

    findByGoogleId: (googleId) =>
      mapUser(db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId)),

    findById: (id) =>
      mapUser(db.prepare('SELECT id, username, email, google_id, title, first_name, last_name, nickname, avatar_url FROM users WHERE id = ?').get(id)),

    findByIdWithHash: (id) =>
      mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)),

    create({ username, passwordHash, googleId, email }) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO users (id, username, password_hash, google_id, email) VALUES (?, ?, ?, ?, ?)',
      ).run(id, username, passwordHash ?? null, googleId ?? null, email ?? null);
      return { _id: id, username };
    },

    usernameExists: (username) =>
      !!db.prepare('SELECT 1 FROM users WHERE username = ?').get(username),

    updateProfile(id, { title, firstName, lastName, nickname }) {
      db.prepare(
        `UPDATE users SET title=?, first_name=?, last_name=?, nickname=?, updated_at=datetime('now') WHERE id=?`
      ).run(title ?? null, firstName ?? null, lastName ?? null, nickname ?? null, uid(id));
      return this.findById(id);
    },

    updateAvatar(id, avatarUrl) {
      db.prepare(`UPDATE users SET avatar_url=?, updated_at=datetime('now') WHERE id=?`)
        .run(avatarUrl ?? null, uid(id));
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

    create({ label, userId }) {
      const id = randomUUID();
      db.prepare('INSERT INTO banks (id, label, user_id) VALUES (?, ?, ?)').run(id, label, uid(userId));
      return { _id: id, label, userId: uid(userId) };
    },

    update(id, userId, { label }) {
      const n = db.prepare(
        "UPDATE banks SET label = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      ).run(label, id, uid(userId)).changes;
      return n ? { _id: id, label, userId: uid(userId) } : null;
    },

    delete: (id, userId) =>
      db.prepare('DELETE FROM banks WHERE id = ? AND user_id = ?').run(id, uid(userId)),
  };

  // ─────────────────────────────────────────────
  // OPERATIONS
  // findByPeriod et create/update utilisent un JOIN avec banks pour retourner
  // bankId sous forme d'objet { _id, label } (équivalent du .populate() Mongoose).
  //
  // findByPeriodMinimal retourne uniquement label/bankId/amount : utilisé par
  // import-recurring pour construire le Set de déduplication sans charger les données complètes.
  //
  // insertMany est encapsulé dans une transaction SQLite pour garantir l'atomicité :
  // soit toutes les opérations sont insérées, soit aucune (en cas d'erreur).
  // ─────────────────────────────────────────────
  const operations = {
    findByPeriod: (periodId, userId) =>
      db.prepare(`${OPS_WITH_BANK} WHERE o.period_id = ? AND o.user_id = ? ORDER BY o.date`)
        .all(periodId, uid(userId)).map(mapOp),

    findByPeriodMinimal: (periodId, userId) =>
      db.prepare('SELECT label, bank_id AS bankId, amount FROM operations WHERE period_id = ? AND user_id = ?')
        .all(periodId, uid(userId)),

    create({ label, amount, date, pointed = false, bankId, periodId, userId }) {
      const id = randomUUID();
      const dateStr = date instanceof Date ? date.toISOString() : date;
      db.prepare(
        'INSERT INTO operations (id, label, amount, date, pointed, bank_id, period_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(id, label, amount, dateStr, pointed ? 1 : 0, uid(bankId), uid(periodId), uid(userId));
      return mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ?`).get(id));
    },

    update(id, userId, body) {
      // On charge la row courante pour conserver les champs non fournis dans le body
      const cur = db.prepare('SELECT * FROM operations WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      const { label = cur.label, amount = cur.amount, date = cur.date, bankId = cur.bank_id } = body;
      const pointed = body.pointed !== undefined ? (body.pointed ? 1 : 0) : cur.pointed;
      const dateStr = date instanceof Date ? date.toISOString() : date;
      db.prepare(`
        UPDATE operations
        SET label = ?, amount = ?, date = ?, pointed = ?, bank_id = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(label, amount, dateStr, pointed, uid(bankId), id, uid(userId));
      return mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ?`).get(id));
    },

    delete: (id, userId) =>
      db.prepare('DELETE FROM operations WHERE id = ? AND user_id = ?').run(id, uid(userId)),

    // Utilisé lors de la suppression d'une période (cascade manuelle)
    deleteByPeriod: (periodId, userId) =>
      db.prepare('DELETE FROM operations WHERE period_id = ? AND user_id = ?').run(periodId, uid(userId)),

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
        'INSERT INTO operations (id, label, amount, date, pointed, bank_id, period_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      );
      db.transaction((ops) => {
        for (const op of ops) {
          const dateStr = op.date instanceof Date ? op.date.toISOString() : op.date;
          stmt.run(randomUUID(), op.label, op.amount, dateStr, op.pointed ? 1 : 0,
            uid(op.bankId), uid(op.periodId), uid(op.userId));
        }
      })(items);
    },
  };

  // ─────────────────────────────────────────────
  // PERIODS
  // La contrainte UNIQUE(month, year, user_id) dans SQLite lève une erreur
  // "UNIQUE constraint failed". On l'intercepte et on pose err.code = 11000
  // pour rester compatible avec le handler de la route (qui gère ce code
  // pour MongoDB comme pour SQLite).
  //
  // delete retourne la période supprimée pour permettre la cascade des opérations
  // dans la route DELETE /periods/:id.
  // ─────────────────────────────────────────────
  const periods = {
    findByUser: (userId) =>
      db.prepare('SELECT * FROM periods WHERE user_id = ? ORDER BY year DESC, month DESC')
        .all(uid(userId)).map(mapPeriod),

    create({ month, year, userId }) {
      const id = randomUUID();
      try {
        db.prepare('INSERT INTO periods (id, month, year, user_id) VALUES (?, ?, ?, ?)')
          .run(id, month, year, uid(userId));
        return { _id: id, month, year, userId: uid(userId), balances: {} };
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          const dup = new Error('Cette période existe déjà');
          dup.code = 11000; // code conventionnel de duplication MongoDB, réutilisé ici
          throw dup;
        }
        throw err;
      }
    },

    findOne: (id, userId) =>
      mapPeriod(db.prepare('SELECT * FROM periods WHERE id = ? AND user_id = ?').get(id, uid(userId))),

    updateBalances(id, userId, balances) {
      const n = db.prepare(
        "UPDATE periods SET balances = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      ).run(JSON.stringify(balances), id, uid(userId)).changes;
      return n ? mapPeriod(db.prepare('SELECT * FROM periods WHERE id = ?').get(id)) : null;
    },

    delete(id, userId) {
      const row = db.prepare('SELECT * FROM periods WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!row) return null;
      db.prepare('DELETE FROM periods WHERE id = ? AND user_id = ?').run(id, uid(userId));
      return mapPeriod(row); // retourné pour déclencher la suppression des opérations associées
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
        bankId: r.bank_id, // ID brut pour la déduplication
        userId: r.user_id,
      })),

    create({ label, amount, dayOfMonth, bankId, userId }) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO recurring_operations (id, label, amount, day_of_month, bank_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, label, amount, dayOfMonth, uid(bankId), uid(userId));
      return mapRecurring(db.prepare(`${RECUR_WITH_BANK} WHERE r.id = ?`).get(id));
    },

    update(id, userId, body) {
      const cur = db.prepare('SELECT * FROM recurring_operations WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      const { label = cur.label, amount = cur.amount, dayOfMonth = cur.day_of_month, bankId = cur.bank_id } = body;
      db.prepare(`
        UPDATE recurring_operations
        SET label = ?, amount = ?, day_of_month = ?, bank_id = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(label, amount, dayOfMonth, uid(bankId), id, uid(userId));
      return mapRecurring(db.prepare(`${RECUR_WITH_BANK} WHERE r.id = ?`).get(id));
    },

    delete: (id, userId) =>
      db.prepare('DELETE FROM recurring_operations WHERE id = ? AND user_id = ?').run(id, uid(userId)),
  };

  return { users, banks, operations, periods, recurringOps };
};
