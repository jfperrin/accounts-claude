const { Schema, model } = require('mongoose');

const schema = new Schema({
  label: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  dayOfMonth: { type: Number, required: true, min: 1, max: 31 },
  bankId: { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('RecurringOperation', schema);
