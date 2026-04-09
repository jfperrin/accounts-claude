const { Schema, model } = require('mongoose');

const schema = new Schema({
  token:     { type: String, required: true, unique: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('PasswordResetToken', schema);
