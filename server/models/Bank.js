// Modèle Mongoose pour les banques.
// Chaque banque appartient à un utilisateur via userId.
// Toutes les requêtes du repo mongo.js filtrent sur { userId } pour garantir
// qu'un utilisateur ne peut pas accéder aux banques d'un autre.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  label: { type: String, required: true, trim: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('Bank', schema);
