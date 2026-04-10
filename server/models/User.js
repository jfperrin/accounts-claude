// Modèle Mongoose pour les utilisateurs.
// Utilisé uniquement en production (MongoDB). En dev SQLite, le schéma
// équivalent est défini dans db/sqlite.js via CREATE TABLE.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  passwordHash: { type: String },
  googleId:     { type: String, trim: true },
  email:        { type: String, required: true, unique: true, trim: true },
  role:         { type: String, enum: ['user', 'admin'], default: 'user' },
  title:        { type: String, trim: true },
  firstName:    { type: String, trim: true },
  lastName:     { type: String, trim: true },
  nickname:     { type: String, trim: true },
  avatarUrl:    { type: String, trim: true },
}, { timestamps: true });

// Index sparse : n'indexe que les documents ayant un googleId,
// ce qui autorise plusieurs documents sans googleId sans violer l'unicité.
schema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = model('User', schema);
