// Modèle Mongoose pour les opérations bancaires.
// Une opération est toujours rattachée à une période ET une banque.
//
// amount : négatif = débit, positif = crédit. Pas de champ "type" séparé,
// le signe suffit et simplifie les calculs de solde côté client.
//
// pointed : indique que l'opération a été rapprochée avec le relevé bancaire.
// Les opérations non pointées entrent dans le calcul du solde prévisionnel.
//
// bankId et periodId sont des références Mongoose (ObjectId) :
// .populate('bankId', 'label') les résout en { _id, label } dans les réponses API.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  label:    { type: String, required: true, trim: true },
  amount:   { type: Number, required: true },
  date:     { type: Date, required: true },
  pointed:  { type: Boolean, default: false },
  bankId:   { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  periodId: { type: Schema.Types.ObjectId, ref: 'Period', required: true },
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('Operation', schema);
