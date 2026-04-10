const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
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

module.exports = { setup, teardown, clearDB, getApp: () => app };
