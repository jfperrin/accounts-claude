// Point d'entrée du serveur.
// Charge les variables d'environnement (.env), choisit la base de données
// en fonction de NODE_ENV, puis démarre Express.

require('dotenv').config();
const createApp = require('./app');

async function main() {
  // En développement (NODE_ENV=development) ou sans MONGODB_URI configurée,
  // on utilise SQLite via better-sqlite3 : aucun service externe requis.
  // En production, on connecte Mongoose à MongoDB Atlas avant de créer l'app.
  const useSQLite = process.env.NODE_ENV === 'development' || !process.env.MONGODB_URI;

  let db, mongoUri;
  if (useSQLite) {
    // createSQLiteRepos() ouvre (ou crée) dev.db et initialise le schéma
    db = require('./db/sqlite')();
  } else {
    // Connexion Mongoose bloquante : l'app ne démarre pas tant qu'elle n'est pas établie
    await require('./config/db')();
    db = require('./db/mongo');
    mongoUri = process.env.MONGODB_URI; // transmis à app.js pour le session store
  }

  // Crée ou met à jour le compte admin si ADMIN_USERNAME/PASSWORD/EMAIL sont définis
  await require('./utils/ensureAdmin')(db);

  // createApp reçoit les repos et l'URI Mongo (null en dev) pour configurer
  // le session store et attacher db à app.locals
  const app = createApp(db, mongoUri);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}

main().catch((err) => { console.error(err); process.exit(1); });
