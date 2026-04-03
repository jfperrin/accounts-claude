const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'dev.db');

function initSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id   TEXT UNIQUE,
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
      balances   TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(month, year, user_id)
    );

    CREATE TABLE IF NOT EXISTS operations (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      amount     REAL NOT NULL,
      date       TEXT NOT NULL,
      pointed    INTEGER NOT NULL DEFAULT 0,
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
}

const mapUser = (row) => row && {
  _id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  googleId: row.google_id,
  email: row.email,
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
  balances: JSON.parse(row.balances || '{}'),
};

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

  const uid = (v) => String(v);

  const users = {
    findByUsername: (username) =>
      mapUser(db.prepare('SELECT * FROM users WHERE username = ?').get(username)),

    findByGoogleId: (googleId) =>
      mapUser(db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId)),

    findById: (id) =>
      mapUser(db.prepare('SELECT id, username, email, google_id FROM users WHERE id = ?').get(id)),

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
  };

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

    deleteByPeriod: (periodId, userId) =>
      db.prepare('DELETE FROM operations WHERE period_id = ? AND user_id = ?').run(periodId, uid(userId)),

    findById: (id, userId) =>
      mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ? AND o.user_id = ?`).get(id, uid(userId))),

    togglePointed(id, userId) {
      const cur = db.prepare('SELECT pointed FROM operations WHERE id = ? AND user_id = ?').get(id, uid(userId));
      if (!cur) return null;
      db.prepare("UPDATE operations SET pointed = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
        .run(cur.pointed === 1 ? 0 : 1, id, uid(userId));
      return mapOp(db.prepare(`${OPS_WITH_BANK} WHERE o.id = ?`).get(id));
    },

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
          dup.code = 11000;
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
      return mapPeriod(row);
    },
  };

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
        bankId: r.bank_id,
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
