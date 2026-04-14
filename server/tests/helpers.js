// Set a high rate limit so the test suite never hits the limiter.
// Must be assigned before createApp() is called (rate limiter reads this at startup).
process.env.RATE_LIMIT_MAX = '1000';
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const createApp = require('../app');
const db = require('../db/mongo');

let mongod;
let app;

async function setup() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  app = createApp(db, uri);
  return app;
}

async function teardown() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function clearDB() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );
}

// Crée un utilisateur vérifié directement en DB, sans passer par le flow email.
// Utilisé dans les tests qui ont besoin d'une session active.
async function createVerifiedUser(app, email, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  return app.locals.db.users.create({ email, passwordHash, emailVerified: true });
}

module.exports = { setup, teardown, clearDB, getApp: () => app, createVerifiedUser };
