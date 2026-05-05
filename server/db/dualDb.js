// Permet de servir SQLite et MongoDB en parallèle en dev, avec sélection
// par requête via le cookie `db_backend` (sqlite|mongo).
//
// AsyncLocalStorage propage le backend choisi à travers tous les `await` du
// pipeline d'une requête, sans avoir à modifier la signature de chaque
// fonction repo. Le proxy résout dynamiquement à la lecture.

const { AsyncLocalStorage } = require('async_hooks');

const dbContext = new AsyncLocalStorage();

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const m = raw.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function currentBackend() {
  return dbContext.getStore()?.backend ?? 'sqlite';
}

// Proxy à 2 niveaux : `db.users.findById(...)` →
//   1. get(repo) → résout sqlite ou mongo selon le contexte
//   2. retourne le repo de ce backend
function createDualDb(sqlite, mongo) {
  const handler = {
    get(_target, prop) {
      const backend = currentBackend() === 'mongo' ? mongo : sqlite;
      return backend[prop];
    },
  };
  return new Proxy({}, handler);
}

// Middleware Express : lit le cookie et place le backend dans le contexte
// async pour la durée de la requête.
function dbMiddleware(req, _res, next) {
  const cookieVal = readCookie(req, 'db_backend');
  const backend = cookieVal === 'mongo' ? 'mongo' : 'sqlite';
  dbContext.run({ backend }, next);
}

module.exports = { createDualDb, dbMiddleware, currentBackend };
