const mongoose = require('mongoose');

const ArtPeriodSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  startYear: { type: Number, required: true },
  endYear: { type: Number, required: true },
  color: { type: String, default: '#1e6bd6' },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' }
}, { timestamps: true, collection: 'ArtPeriods' });

module.exports = mongoose.model('ArtPeriod', ArtPeriodSchema);
