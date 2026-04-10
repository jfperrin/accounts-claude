const { Schema, model } = require('mongoose');

const schema = new Schema({
  token:        { type: String, required: true, unique: true },
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['password_reset', 'email_verify', 'email_change'], default: 'password_reset' },
  pendingEmail: { type: String, trim: true },
  expiresAt:    { type: Date, required: true },
  used:         { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('PasswordResetToken', schema);
