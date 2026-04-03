const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const wrap = require('../utils/asyncHandler');

router.post('/register', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Champs requis' });
  const exists = await User.findOne({ username });
  if (exists) return res.status(409).json({ message: 'Nom d\'utilisateur déjà pris' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, passwordHash });
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

router.post('/logout', (req, res) => {
  req.logout(() => res.json({ message: 'Déconnecté' }));
});

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: 'Non authentifié' });
  res.json({ _id: req.user._id, username: req.user.username });
});

module.exports = router;
