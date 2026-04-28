// Cache des associations libellé → catégorie pour accélérer l'inférence à l'import.
// Une entrée par couple (userId, label) unique. Mise à jour quand l'utilisateur
// affecte une catégorie à une opération, ou pendant l'import quand une catégorie
// est inférée. Reset possible via DELETE /api/category-hints.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  label:    { type: String, required: true },
  category: { type: String, required: true },
}, { timestamps: true });

schema.index({ userId: 1, label: 1 }, { unique: true });

module.exports = model('CategoryHint', schema);
