// Modèle Mongoose pour les opérations bancaires.
// Une opération est rattachée à une banque, datée, signée (négatif = débit, positif = crédit).
// Le champ pointed indique qu'elle a été rapprochée du relevé bancaire :
// les opérations non pointées entrent dans le calcul du solde projeté.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  label:    { type: String, required: true, trim: true },
  amount:   { type: Number, required: true },
  date:     { type: Date, required: true },
  pointed:    { type: Boolean, default: false },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  bankId:     { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('Operation', schema);
