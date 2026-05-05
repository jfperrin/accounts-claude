// Point d'entrée du serveur.
// Charge les variables d'environnement (.env), choisit la base de données
// en fonction de NODE_ENV, puis démarre Express.

require('dotenv').config();
const createApp = require('./app');
const { createDualDb } = require('./db/dualDb');

async function main() {
  const isDev = process.env.NODE_ENV === 'development';
  const hasMongo = !!process.env.MONGODB_URI;

  // Trois modes :
  //   1. dev sans MONGODB_URI → SQLite seul (defaut)
  //   2. dev avec MONGODB_URI → SQLite + MongoDB en parallèle, switch via cookie
  //   3. prod → MongoDB seul
  let db, mongoUri, dualMode = false;

  if (isDev && hasMongo) {
    const sqliteRepos = require('./db/sqlite')();
    await require('./config/db')();
    const mongoRepos = require('./db/mongo');
    await mongoRepos.migrateLegacyCategoryFields();

    await require('./utils/ensureAdmin')(sqliteRepos);
    await require('./utils/ensureAdmin')(mongoRepos);

    db = createDualDb(sqliteRepos, mongoRepos);
    dualMode = true;
    // mongoUri laissé null : on garde MemoryStore en dev pour que la session
    // soit partagée entre les deux backends (et perdue au redémarrage, OK).
    console.log('Dual DB mode: SQLite + MongoDB (switch via cookie db_backend)');
  } else if (isDev || !hasMongo) {
    db = require('./db/sqlite')();
    await require('./utils/ensureAdmin')(db);
  } else {
    await require('./config/db')();
    db = require('./db/mongo');
    mongoUri = process.env.MONGODB_URI;
    await db.migrateLegacyCategoryFields();
    await require('./utils/ensureAdmin')(db);
  }

  const app = createApp(db, mongoUri, { dualMode });
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}

main().catch((err) => { console.error(err); process.exit(1); });
