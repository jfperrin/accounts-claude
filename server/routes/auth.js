// Routes d'authentification — les seules accessibles sans session active.
// Préfixe : /api/auth

const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const wrap = require('../utils/asyncHandler');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 tentatives par IP par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans 15 minutes' },
});

// POST /api/auth/register
// Crée un compte local. Vérifie la disponibilité du username avant d'hasher
// le mot de passe (bcrypt, coût 12). req.login() démarre la session immédiatement
// après la création, évitant une double requête de connexion.
router.post('/register', authLimiter, wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Champs requis' });
  const db = req.app.locals.db;
  if (await db.users.usernameExists(username)) return res.status(409).json({ message: "Nom d'utilisateur déjà pris" });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ username, passwordHash });
  req.login(user, (err) => {
    if (err) return res.status(500).json({ message: 'Erreur session' });
    res.json({ _id: user._id, username: user.username });
  });
}));

// POST /api/auth/login
// Délègue à Passport LocalStrategy (définie dans config/passport.js).
// On utilise la forme callback pour pouvoir renvoyer un JSON d'erreur personnalisé
// plutôt que le comportement de redirect par défaut de passport.authenticate().
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ _id: user._id, username: user.username });
    });
  })(req, res, next);
});

// GET /api/auth/config
// Indique au client si la connexion Google est disponible (clés configurées).
// Le client l'utilise pour afficher ou cacher le bouton "Continuer avec Google".
router.get('/config', (_req, res) => {
  res.json({ googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

// GET /api/auth/google → redirige vers la page de consentement Google
// GET /api/auth/google/callback → Google rappelle ici après acceptation
// En cas d'échec, Google redirige vers /login?error=google côté client.
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${CLIENT_URL}/login?error=google`);
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?error=google` }),
  (_req, res) => res.redirect(CLIENT_URL),
);

// POST /api/auth/logout
// req.logout() (Passport) détruit la session côté serveur.
router.post('/logout', (req, res) => {
  req.logout(() => res.json({ message: 'Déconnecté' }));
});

// GET /api/auth/me
// Utilisé par AuthContext au montage du client pour savoir si une session existe.
// Retourne 401 si non authentifié (le client affiche alors la page de login).
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: 'Non authentifié' });
  res.json({ _id: req.user._id, username: req.user.username });
});

module.exports = router;
