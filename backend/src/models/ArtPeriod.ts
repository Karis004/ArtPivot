import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IArtPeriod extends Document {
  name: string;
  startYear: number;
  endYear: number;
  color?: string;
  description?: string;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ArtPeriodSchema = new Schema<IArtPeriod>({
  name: { type: String, required: true, index: true },
  startYear: { type: Number, required: true },
  endYear: { type: Number, required: true },
  color: { type: String, default: '#1e6bd6' },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' }
}, { timestamps: true, collection: 'ArtPeriods' });

const ArtPeriod: Model<IArtPeriod> = mongoose.models.ArtPeriod || mongoose.model<IArtPeriod>('ArtPeriod', ArtPeriodSchema);
export default ArtPeriod;
