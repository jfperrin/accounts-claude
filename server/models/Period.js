// Modèle Mongoose pour les périodes (mois/année).
// Une période regroupe les opérations d'un mois donné pour un utilisateur.
//
// balances : Map { bankId → solde_initial } saisi manuellement par l'utilisateur.
// Ce n'est pas le solde calculé (qui est dérivé côté client en sommant les opérations),
// mais le solde de départ au 1er du mois, servant de base au calcul prévisionnel.
// Mongoose sérialise les Map en objet JSON { "bankId": valeur } dans les réponses API.
//
// L'index composé unique (month, year, userId) garantit qu'un utilisateur
// ne peut avoir qu'une seule période par mois/année. En cas de doublon,
// MongoDB lève une MongoServerError avec code 11000, capturée dans la route.

const { Schema, model } = require('mongoose');

const schema = new Schema({
  month:  { type: Number, required: true, min: 1, max: 12 },
  year:   { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  balances: { type: Map, of: Number, default: {} },
}, { timestamps: true });

schema.index({ month: 1, year: 1, userId: 1 }, { unique: true });

module.exports = model('Period', schema);
