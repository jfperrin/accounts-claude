// Routes dédiées au mode développement. Montées uniquement quand le serveur
// tourne avec les deux backends activés (`dualMode` dans createApp).

const express = require('express');
const { currentBackend } = require('../db/dualDb');

const router = express.Router();

router.get('/db', (_req, res) => {
  res.json({ dualMode: true, current: currentBackend() });
});

module.exports = router;
