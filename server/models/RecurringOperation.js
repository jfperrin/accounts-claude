// Modèle Mongoose pour les opérations récurrentes (templates mensuels).
// Ce ne sont pas de vraies opérations : elles servent à générer des opérations
// réelles dans une période via la route POST /api/operations/import-recurring.
//
// dayOfMonth : jour du mois auquel l'opération doit être imputée.
// Si le mois est plus court (ex. février), la route d'import ajuste automatiquement
// au dernier jour du mois via Math.min(dayOfMonth, dernierJourDuMois).
//
// Pas de champ periodId : les opérations récurrentes ne sont pas liées à une période,
// elles sont réutilisées pour tous les mois.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  label:      { type: String, required: true, trim: true },
  amount:     { type: Number, required: true },
  dayOfMonth: { type: Number, required: true, min: 1, max: 31 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  bankId:     { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('RecurringOperation', schema);
