const { Schema, model } = require('mongoose');

const schema = new Schema({
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

schema.index({ month: 1, year: 1, userId: 1 }, { unique: true });

module.exports = model('Period', schema);
