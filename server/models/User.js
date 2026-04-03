// Modèle Mongoose pour les utilisateurs.
// Utilisé uniquement en production (MongoDB). En dev SQLite, le schéma
// équivalent est défini dans db/sqlite.js via CREATE TABLE.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String },   // absent pour les comptes Google (connexion sans mot de passe local)
  googleId: { type: String, trim: true }, // absent pour les comptes locaux
  email: { type: String, trim: true },
}, { timestamps: true }); // ajoute createdAt et updatedAt automatiquement

// Index sparse : n'indexe que les documents ayant un googleId,
// ce qui autorise plusieurs documents sans googleId sans violer l'unicité.
schema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = model('User', schema);
