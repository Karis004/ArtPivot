import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAIHistory extends Document {
  filename: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const AIHistorySchema = new Schema<IAIHistory>(
  {
    filename: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'AI-History',
  }
);

const AIHistory: Model<IAIHistory> = mongoose.models.AIHistory || mongoose.model<IAIHistory>('AIHistory', AIHistorySchema);
export default AIHistory;
