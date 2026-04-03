const { Schema, model } = require('mongoose');

const schema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String },          // undefined for Google-only accounts
  googleId: { type: String, trim: true },  // undefined for local accounts
  email: { type: String, trim: true },
}, { timestamps: true });

schema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = model('User', schema);
