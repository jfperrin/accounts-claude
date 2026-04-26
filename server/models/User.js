const { Schema, model } = require('mongoose');

const schema = new Schema({
  passwordHash:  { type: String },
  googleId:      { type: String, trim: true },
  email:         { type: String, required: true, unique: true, trim: true },
  emailVerified: { type: Boolean, default: false },
  role:          { type: String, enum: ['user', 'admin'], default: 'user' },
  title:         { type: String, trim: true },
  firstName:     { type: String, trim: true },
  lastName:      { type: String, trim: true },
  nickname:      { type: String, trim: true },
  avatarUrl:     { type: String, trim: true },
  acceptedToSAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = model('User', schema);
