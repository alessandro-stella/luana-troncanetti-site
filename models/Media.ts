import { Schema, model, models, type Model } from "mongoose";

// ---------- Types ----------

export interface IMedia {
  url: string;
  publicId: string;
  originalName: string;
  width: number;
  height: number;
  format?: string;
  bytes?: number;
  createdAt: Date;
}

// ---------- Schema ----------

const MediaSchema = new Schema<IMedia>({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, required: true, unique: true, trim: true },
  originalName: { type: String, trim: true, default: "" },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  format: { type: String, trim: true },
  bytes: { type: Number, min: 0 },
  createdAt: { type: Date, default: Date.now },
});

// ---------- Indexes ----------

MediaSchema.index({ url: 1 });

// ---------- Model ----------

export const Media =
  (models.Media as Model<IMedia>) || model<IMedia>("Media", MediaSchema);
