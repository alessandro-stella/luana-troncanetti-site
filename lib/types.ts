// ---------- Media ----------

export type MediaItem = { id: string; url: string };

export type SavedMedia = MediaItem & { publicId: string };

// ---------- Articles ----------

export type ArticleBlockDto = {
  subtitle: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
};

export type ArticleEditDto = {
  id: string;
  status: "draft" | "published";
  sectionSlug: string;
  slug: string;
  title: string;
  subtitle: string;
  relatedIds: string[];
  blocks: ArticleBlockDto[];
};

export type ArticleInputDto = {
  sectionSlug: string;
  slug: string;
  title: string;
  subtitle?: string;
  relatedIds?: string[];
  sections: {
    subtitle?: string;
    body: string;
    image?: { url: string; alt?: string };
  }[];
};
