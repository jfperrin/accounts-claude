// Modèle Mongoose pour les banques.
// Chaque banque appartient à un utilisateur via userId.
// currentBalance : solde réel saisi manuellement (lu sur le site de la banque).
// Le solde projeté est calculé serveur dans routes/banks.js :
//   projectedBalance = currentBalance + Σ amounts des Operation non pointées de la banque

const { Schema, model } = require('mongoose');

const schema = new Schema({
  label: { type: String, required: true, trim: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  currentBalance: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('Bank', schema);
