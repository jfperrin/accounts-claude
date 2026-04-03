const { Schema, model } = require('mongoose');

const schema = new Schema({
  label: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  pointed: { type: Boolean, default: false },
  bankId: { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  periodId: { type: Schema.Types.ObjectId, ref: 'Period', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = model('Operation', schema);
