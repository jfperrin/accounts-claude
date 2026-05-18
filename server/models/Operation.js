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
  // Provenance de la catégorie : 'auto' (inférée par hint à l'import),
  // 'manual' (saisie/modifiée par l'utilisateur). null sans catégorie.
  categorySource: { type: String, enum: ['auto', 'manual', null], default: null },
  transferId: { type: String, default: null, index: true },
  // Identifiant unique de transaction OFX (Financial Institution Transaction ID).
  // null pour les ops créées manuellement ou importées depuis QIF (format sans ID).
  // Permet une dédup parfaite des imports OFX successifs (même fitId + même
  // bankId = même transaction). Index sparse pour ne pas peser sur les ops null.
  fitId:      { type: String, default: null, index: true, sparse: true },
  bankId:     { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('Operation', schema);
