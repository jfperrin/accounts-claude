// Fabrique de l'application Express.
// Séparée de index.js pour pouvoir être importée dans les tests sans démarrer
// le serveur HTTP (pattern "app factory").

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const requireAuth = require('./middleware/requireAuth');
const requireAdmin = require('./middleware/requireAdmin');

// mongoUri est null en développement (SQLite) → on utilise MemoryStore pour les sessions.
// En production, mongoUri est fourni → sessions persistées dans MongoDB via connect-mongo.
module.exports = function createApp(db, mongoUri) {
  const app = express();

  // Configure les stratégies Passport avec l'implémentation de base de données active.
  // Doit être appelé avant app.use(passport.session()) pour que serializeUser/
  // deserializeUser soient enregistrés au moment où les routes les utilisent.
  require('./config/passport')(db);

  // Nécessaire pour que req.ip soit fiable derrière un reverse proxy (nginx, Render, etc.)
  app.set('trust proxy', 1);

  // Security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
  app.use(helmet());

  // CORS : autorise les requêtes cross-origin depuis le client Vite en dev.
  // credentials:true est obligatoire pour que le cookie de session soit transmis.
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
  app.use(express.json());

  // Sert les avatars en dev (stockage disque local)
  if (!mongoUri) app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Session store :
  //   - MongoStore  → sessions survivent aux redémarrages (prod)
  //   - MemoryStore → sessions perdues au redémarrage, acceptable en dev local
  const store = mongoUri
    ? require('connect-mongo').MongoStore.create({ mongoUrl: mongoUri })
    : undefined;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }

  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: isProd,        // HTTPS uniquement en production
      sameSite: 'strict',    // protection CSRF
      // maxAge fixé par le handler login selon le choix de l'utilisateur (1j / 30j / 365j)
    },
  }));

  app.use(passport.initialize());
  app.use(passport.session()); // restaure req.user depuis la session à chaque requête

  // Les repos (users, banks, operations, periods, recurringOps) sont attachés à
  // app.locals.db pour être accessibles dans toutes les routes via req.app.locals.db.
  app.locals.db = db;

  // Routes publiques (pas de requireAuth)
  app.use('/api/auth', require('./routes/auth'));

  // Routes protégées : requireAuth renvoie 401 si la session est absente
  app.use('/api/banks', requireAuth, require('./routes/banks'));
  app.use('/api/recurring-operations', requireAuth, require('./routes/recurringOperations'));
  app.use('/api/operations', requireAuth, require('./routes/operations'));
  app.use('/api/categories', requireAuth, require('./routes/categories'));
  app.use('/api/admin', requireAuth, requireAdmin, require('./routes/admin'));

  // Sert le build Vite en production (client/dist copié dans server/public).
  // En dev, Vite tourne sur son propre port et ce bloc est ignoré.
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    // Toutes les routes non-API renvoient index.html pour que le routeur React prenne le relais
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  // Gestionnaire d'erreurs global : capte tout ce qui est passé à next(err)
  // (notamment via asyncHandler) et renvoie une réponse JSON propre.
  app.use((err, _req, res, _next) => {
    // Erreurs d'upload (multer) ou validation métier déclenchée par un middleware
    // (file filter, parser CSV qui pose err.status = 400, etc.).
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
