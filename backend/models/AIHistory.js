const mongoose = require('mongoose');

const AIHistorySchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'AI-History',
  }
);

module.exports = mongoose.model('AIHistory', AIHistorySchema);
