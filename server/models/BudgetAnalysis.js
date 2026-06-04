const { Schema, model } = require('mongoose');

const schema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year:      { type: Number, required: true },
  month:     { type: Number, required: true },
  opsDigest: { type: String, required: true },
  response:  { type: Schema.Types.Mixed, required: true },
  model:     { type: String, required: true },
}, { timestamps: true });

schema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = model('BudgetAnalysis', schema);
