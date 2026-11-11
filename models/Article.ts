import { Schema, model, models, type Model, type Types } from "mongoose";
import "./SiteSection";

// ---------- Types ----------

export interface IArticleImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface IArticleSection {
  _id?: Types.ObjectId;
  subtitle?: string;
  body: string;
  image?: IArticleImage;
}

export interface IArticle {
  title: string;
  subtitle?: string;
  slug: string;
  section: Types.ObjectId;
  sections: IArticleSection[];
  related: Types.ObjectId[];
  status: "draft" | "published";
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- Schemas ----------

const ImageSchema = new Schema<IArticleImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, default: "" },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
  },
  { _id: false },
);

const ArticleSectionSchema = new Schema<IArticleSection>({
  subtitle: { type: String, trim: true },
  body: {
    type: String,
    required: [true, "Il testo della sezione è obbligatorio"],
  },
  image: { type: ImageSchema, required: false },
});

const ArticleSchema = new Schema<IArticle>(
  {
    title: {
      type: String,
      required: [true, "Il titolo è obbligatorio"],
      trim: true,
    },
    subtitle: { type: String, trim: true, default: "" },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug non valido (solo lettere minuscole, numeri e trattini)",
      ],
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: "SiteSection",
      required: true,
    },
    sections: {
      type: [ArticleSectionSchema],
      validate: [
        (v: IArticleSection[]) => v.length > 0,
        "Serve almeno una sezione",
      ],
    },
    related: {
      type: [{ type: Schema.Types.ObjectId, ref: "Article" }],
      default: [],
    },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

// ---------- Indexes ----------

ArticleSchema.index({ section: 1, slug: 1 }, { unique: true });
ArticleSchema.index({ section: 1, status: 1, publishedAt: -1 });
ArticleSchema.index({ related: 1 });

// ---------- Model ----------

export const Article =
  (models.Article as Model<IArticle>) ||
  model<IArticle>("Article", ArticleSchema);
