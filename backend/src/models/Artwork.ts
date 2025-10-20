import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IArtwork extends Document {
  title: string;
  artist: string;
  year: number;
  imageUrl?: string;
  description?: string;
  periodId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ArtworkSchema = new Schema<IArtwork>({
  title: { type: String, required: true, index: true },
  artist: { type: String, required: true, index: true },
  year: { type: Number, required: true },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  periodId: { type: Schema.Types.ObjectId, ref: 'ArtPeriod', default: null }
}, { timestamps: true, collection: 'ArtWorks' });

const Artwork: Model<IArtwork> = mongoose.models.Artwork || mongoose.model<IArtwork>('Artwork', ArtworkSchema);
export default Artwork;
