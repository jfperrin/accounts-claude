const { Schema, model } = require('mongoose');

// Stocke les refresh tokens actifs. Le `tokenHash` est un sha256 du token brut —
// le token brut n'est jamais en clair en DB. Pour révoquer une session, on
// supprime la row (ou on pose `revokedAt`).
const schema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash:   { type: String, required: true, unique: true, index: true },
  userAgent:   { type: String, default: null },
  ip:          { type: String, default: null },
  createdAt:   { type: Date, default: Date.now },
  lastUsedAt:  { type: Date, default: Date.now },
  expiresAt:   { type: Date, required: true, index: true },
  revokedAt:   { type: Date, default: null },
});

module.exports = model('RefreshToken', schema);
