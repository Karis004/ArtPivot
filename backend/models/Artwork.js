const mongoose = require('mongoose');

const ArtworkSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  artist: { type: String, required: true, index: true },
  year: { type: Number, required: true },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtPeriod', default: null }
}, { timestamps: true, collection: 'ArtWorks' });

module.exports = mongoose.model('Artwork', ArtworkSchema);
