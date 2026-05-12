const { Schema, model } = require('mongoose');

const schema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  codeHash:  { type: String, required: true },
  purpose:   { type: String, enum: ['login', 'setup', 'disable'], required: true },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('MfaEmailCode', schema);
