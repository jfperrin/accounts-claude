require('dotenv').config();
const createApp = require('./app');

async function main() {
  const useSQLite = process.env.NODE_ENV === 'development' || !process.env.MONGODB_URI;

  let db, mongoUri;
  if (useSQLite) {
    db = require('./db/sqlite')();
  } else {
    await require('./config/db')();
    db = require('./db/mongo');
    mongoUri = process.env.MONGODB_URI;
  }

  const app = createApp(db, mongoUri);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}

main().catch((err) => { console.error(err); process.exit(1); });
