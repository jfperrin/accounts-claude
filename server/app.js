const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { MongoStore } = require('connect-mongo');
const cors = require('cors');
require('./config/passport');
const requireAuth = require('./middleware/requireAuth');

module.exports = function createApp(mongoUri) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri }),
    cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/banks', requireAuth, require('./routes/banks'));
  app.use('/api/recurring-operations', requireAuth, require('./routes/recurringOperations'));
  app.use('/api/periods', requireAuth, require('./routes/periods'));
  app.use('/api/operations', requireAuth, require('./routes/operations'));

  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  });

  return app;
};
