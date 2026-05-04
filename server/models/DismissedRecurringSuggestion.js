// Suggestions de récurrentes ignorées par l'utilisateur.
// La clé identifie une suggestion (groupe d'opérations similaires sur une banque)
// pour ne plus la proposer après dismiss.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  key:    { type: String, required: true },
}, { timestamps: true });

schema.index({ userId: 1, key: 1 }, { unique: true });

module.exports = model('DismissedRecurringSuggestion', schema);
