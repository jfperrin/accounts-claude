const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const createApp = require('../app');

let mongod;
let app;

async function setup() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp(mongod.getUri());
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
