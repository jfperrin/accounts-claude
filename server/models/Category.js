const { Schema, model } = require('mongoose');

const schema = new Schema({
  label:     { type: String, required: true, trim: true },
  color:     { type: String, default: null },
  maxAmount: { type: Number, default: null },
  kind:      { type: String, enum: ['debit', 'credit', 'transfer'], default: 'debit' },
  parentId:  { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('Category', schema);
