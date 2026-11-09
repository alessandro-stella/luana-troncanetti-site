import { Schema, model, models, type Model, type Types } from "mongoose";
import "./SiteSection";

export interface IArticleImage {
  url: string;
  alt: string;
}

export interface IArticleSection {
  _id?: Types.ObjectId;
  subtitle?: string;
  body: string;
  image?: IArticleImage;
}

export interface IArticle {
  title: string;
  slug: string;
  section: Types.ObjectId;
  sections: IArticleSection[];
  status: "draft" | "published";
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IArticleImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, default: "" },
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
    section: {
      type: Schema.Types.ObjectId,
      ref: "SiteSection",
      required: true,
      index: true,
    },
    sections: {
      type: [ArticleSectionSchema],
      validate: [
        (v: IArticleSection[]) => v.length > 0,
        "Serve almeno una sezione",
      ],
    },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

ArticleSchema.index({ section: 1, status: 1, publishedAt: -1 });

ArticleSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
  next();
});

export const Article =
  (models.Article as Model<IArticle>) ||
  model<IArticle>("Article", ArticleSchema);
