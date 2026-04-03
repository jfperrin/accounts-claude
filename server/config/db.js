// Connexion Mongoose à MongoDB.
// Appelé uniquement en production (NODE_ENV != 'development' et MONGODB_URI présente).
// La promesse est attendue dans index.js avant de démarrer le serveur,
// ce qui garantit qu'aucune requête n'arrive avant que la connexion soit établie.

const mongoose = require('mongoose');

module.exports = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
};
