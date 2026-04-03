const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const wrap = require('../utils/asyncHandler');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

router.post('/register', wrap(async (req, res) => {
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

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ _id: user._id, username: user.username });
    });
  })(req, res, next);
});

router.get('/config', (_req, res) => {
  res.json({ googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${CLIENT_URL}/login?error=google`);
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?error=google` }),
  (_req, res) => res.redirect(CLIENT_URL),
);

router.post('/logout', (req, res) => {
  req.logout(() => res.json({ message: 'Déconnecté' }));
});

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: 'Non authentifié' });
  res.json({ _id: req.user._id, username: req.user.username });
});

module.exports = router;
