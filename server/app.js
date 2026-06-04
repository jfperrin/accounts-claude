// Fabrique de l'application Express.
// Séparée de index.js pour pouvoir être importée dans les tests sans démarrer
// le serveur HTTP (pattern "app factory").
//
// Auth : depuis la migration JWT, plus de session côté serveur. Trois cookies
// httpOnly portent l'état :
//   - access_token  (JWT, 15 min)
//   - refresh_token (opaque, hashé en DB, path=/api/auth)
//   - mfa_challenge (JWT court-vie, posé pendant le flow 2FA)
// passport sert uniquement à la LocalStrategy pour vérifier le password (sans
// session). Plus de passport.session(), plus de serializeUser/deserializeUser.

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const requireAuth = require('./middleware/requireAuth');
const requireAdmin = require('./middleware/requireAdmin');
const { dbMiddleware } = require('./db/dualDb');

module.exports = function createApp(db, _mongoUri, options = {}) {
  const { dualMode = false } = options;
  const app = express();

  // Configure les stratégies Passport (Local + éventuel Google) avec la DB.
  // Plus de sérialisation : passport est utilisé en mode stateless via authenticate(...).
  require('./config/passport')(db);

  // Nécessaire pour que req.ip soit fiable derrière un reverse proxy (nginx, Render, etc.)
  app.set('trust proxy', 1);

  // Security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
  app.use(helmet());

  // CORS : autorise les requêtes cross-origin depuis le client Vite en dev.
  // credentials:true est obligatoire pour que les cookies d'auth soient transmis.
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  if (dualMode) app.use(dbMiddleware);

  // Sert les avatars en dev (stockage disque local) — détecté par l'absence de
  // configuration MongoDB (les uploads partent en data URL Mongo en prod).
  if (!process.env.MONGODB_URI) {
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  }

  app.use(passport.initialize());

  // Les repos sont attachés à app.locals.db pour être accessibles via req.app.locals.db.
  app.locals.db = db;

  // Routes publiques (pas de requireAuth)
  app.use('/api/auth', require('./routes/auth'));

  if (dualMode) app.use('/api/dev', require('./routes/dev'));

  // Routes protégées : requireAuth lit le cookie access_token (JWT) et pose req.user.
  app.use('/api/banks', requireAuth, require('./routes/banks'));
  app.use('/api/recurring-operations', requireAuth, require('./routes/recurringOperations'));
  app.use('/api/operations', requireAuth, require('./routes/operations'));
  app.use('/api/categories', requireAuth, require('./routes/categories'));
  app.use('/api/category-hints', requireAuth, require('./routes/categoryHints'));
  app.use('/api/admin', requireAuth, requireAdmin, require('./routes/admin'));
  app.use('/api/budget-analyses', requireAuth, require('./routes/budgetAnalyses'));

  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  // Gestionnaire d'erreurs global
  app.use((err, _req, res, _next) => {
    if (err.name === 'MulterError'
      || err.message === 'Seules les images sont acceptées'
      || err.message === 'Seuls les fichiers .qif, .ofx ou .zip sont acceptés'
      || err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  });

  return app;
};
