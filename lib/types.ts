// ---------- Layout ----------

export type Align = "left" | "center" | "right" | "justify";

export type ImagePosition = "top" | "middle" | "bottom";

// ---------- Media ----------

export type MediaItem = { id: string; url: string };

export type SavedMedia = MediaItem & { publicId: string };

export type DiagnosticStep = { name: string; ok: boolean; detail: string };

// ---------- Articles ----------

export type ArticleBlockDto = {
  subtitle: string;
  body: string;
  align: Align;
  imageUrl: string;
  imageAlt: string;
  imagePosition: ImagePosition;
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
    align?: Align;
    image?: { url: string; alt?: string; position?: ImagePosition };
  }[];
};
