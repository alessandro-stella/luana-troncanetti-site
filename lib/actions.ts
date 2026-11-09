"use server";

import { updateTag } from "next/cache";
import { dbConnect } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizeBody } from "@/lib/sanitize";
import { Article } from "@/models/Article";
import { SiteSection } from "@/models/SiteSection";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type ArticleSectionInput = {
  subtitle?: string;
  body: string;
  image?: { url: string; alt?: string; width?: number; height?: number };
};

type ArticleInput = {
  sectionSlug: string;
  slug: string;
  title: string;
  sections: ArticleSectionInput[];
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(["admin", "api", "_next"]);

function isDuplicateKey(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: number }).code === 11000
  );
}

// =====================================================================
// Section
// =====================================================================

export async function createSection(input: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Result<{ id: string }>> {
  await requireAdmin();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Il nome è obbligatorio" };
  if (!SLUG_RE.test(input.slug) || RESERVED_SLUGS.has(input.slug)) {
    return { ok: false, error: "Slug non valido o riservato" };
  }

  await dbConnect();

  try {
    const section = await SiteSection.create({
      name,
      slug: input.slug,
      description: input.description?.trim() || undefined,
    });

    updateTag("sections");
    updateTag(`section:${input.slug}`);

    return { ok: true, id: String(section._id) };
  } catch (e) {
    if (isDuplicateKey(e)) {
      return { ok: false, error: "Esiste già una sezione con questo slug" };
    }
    throw e;
  }
}

export async function updateSection(
  id: string,
  input: { name: string; description?: string },
): Promise<Result> {
  await requireAdmin();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Il nome è obbligatorio" };

  await dbConnect();

  const section = await SiteSection.findByIdAndUpdate(id, {
    name,
    description: input.description?.trim() || undefined,
  }).lean();
  if (!section) return { ok: false, error: "Sezione non trovata" };

  updateTag("sections");
  updateTag(`section:${section.slug}`);

  return { ok: true };
}

export async function deleteSection(id: string): Promise<Result> {
  await requireAdmin();
  await dbConnect();

  const section = await SiteSection.findById(id).lean();
  if (!section) return { ok: false, error: "Sezione non trovata" };

  const count = await Article.countDocuments({ section: section._id });
  if (count > 0) {
    return {
      ok: false,
      error: `La sezione contiene ${count} articoli: spostali o eliminali prima`,
    };
  }

  await SiteSection.deleteOne({ _id: section._id });

  updateTag("sections");
  updateTag(`section:${section.slug}`);

  return { ok: true };
}

// =====================================================================
// Articles
// =====================================================================

function cleanSections(sections: ArticleSectionInput[]) {
  return sections.map((s) => ({ ...s, body: sanitizeBody(s.body) }));
}

function validate(input: ArticleInput): string | null {
  if (!input.title.trim()) return "Il titolo è obbligatorio";
  if (!SLUG_RE.test(input.slug)) return "Slug non valido";
  return null;
}

async function findWithSection(id: string) {
  return Article.findById(id)
    .populate<{ section: { _id: unknown; slug: string } }>("section", "slug")
    .lean();
}

function invalidateArticle(sectionSlug: string, slug: string) {
  updateTag(`article:${sectionSlug}/${slug}`);
  updateTag(`section:${sectionSlug}`);
}

export async function createArticle(
  input: ArticleInput,
): Promise<Result<{ id: string }>> {
  await requireAdmin();

  const error = validate(input);
  if (error) return { ok: false, error };

  await dbConnect();

  const section = await SiteSection.findOne({ slug: input.sectionSlug })
    .select("_id")
    .lean();
  if (!section) return { ok: false, error: "Sezione inesistente" };

  try {
    const article = await Article.create({
      title: input.title.trim(),
      slug: input.slug,
      section: section._id,
      status: "draft",
      sections: cleanSections(input.sections),
    });

    return { ok: true, id: String(article._id) };
  } catch (e) {
    if (isDuplicateKey(e)) {
      return {
        ok: false,
        error: "Esiste già un articolo con questo slug in questa sezione",
      };
    }
    throw e;
  }
}

export async function updateArticle(
  id: string,
  input: ArticleInput,
): Promise<Result> {
  await requireAdmin();

  const error = validate(input);
  if (error) return { ok: false, error };

  await dbConnect();

  const existing = await findWithSection(id);
  if (!existing) return { ok: false, error: "Articolo non trovato" };

  const newSection = await SiteSection.findOne({ slug: input.sectionSlug })
    .select("_id")
    .lean();
  if (!newSection) return { ok: false, error: "Sezione inesistente" };

  try {
    await Article.updateOne(
      { _id: id },
      {
        $set: {
          title: input.title.trim(),
          slug: input.slug,
          section: newSection._id,
          sections: cleanSections(input.sections),
        },
      },
    );
  } catch (e) {
    if (isDuplicateKey(e)) {
      return {
        ok: false,
        error: "Esiste già un articolo con questo slug in questa sezione",
      };
    }
    throw e;
  }

  if (existing.status === "published") {
    invalidateArticle(existing.section.slug, existing.slug);
    invalidateArticle(input.sectionSlug, input.slug);
  }

  return { ok: true };
}

export async function publishArticle(id: string): Promise<Result> {
  await requireAdmin();
  await dbConnect();

  const article = await findWithSection(id);
  if (!article) return { ok: false, error: "Articolo non trovato" };

  await Article.updateOne(
    { _id: id },
    {
      $set: {
        status: "published",
        publishedAt: article.publishedAt ?? new Date(),
      },
    },
  );

  invalidateArticle(article.section.slug, article.slug);

  return { ok: true };
}

export async function unpublishArticle(id: string): Promise<Result> {
  await requireAdmin();
  await dbConnect();

  const article = await findWithSection(id);
  if (!article) return { ok: false, error: "Articolo non trovato" };

  await Article.updateOne({ _id: id }, { $set: { status: "draft" } });

  invalidateArticle(article.section.slug, article.slug);

  return { ok: true };
}

export async function deleteArticle(id: string): Promise<Result> {
  await requireAdmin();
  await dbConnect();

  const article = await findWithSection(id);
  if (!article) return { ok: false, error: "Articolo non trovato" };

  await Article.deleteOne({ _id: id });

  if (article.status === "published") {
    invalidateArticle(article.section.slug, article.slug);
  }

  return { ok: true };
}
