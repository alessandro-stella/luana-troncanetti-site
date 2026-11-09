import { Schema, model, models, type Model } from "mongoose";

export interface ISiteSection {
  name: string;
  slug: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const SiteSectionSchema = new Schema<ISiteSection>(
  {
    name: {
      type: String,
      required: [true, "Il nome è obbligatorio"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug non valido (solo lettere minuscole, numeri e trattini)",
      ],
    },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export const SiteSection =
  (models.SiteSection as Model<ISiteSection>) ||
  model<ISiteSection>("SiteSection", SiteSectionSchema);
