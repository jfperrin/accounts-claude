const { Schema, model } = require('mongoose');

const schema = new Schema({
  label:  { type: String, required: true, trim: true },
  color:  { type: String, default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('Category', schema);
