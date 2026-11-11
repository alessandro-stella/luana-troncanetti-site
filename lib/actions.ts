"use server";

import { updateTag } from "next/cache";
import { isObjectIdOrHexString, Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { checkWriteAccess, endSession, loginWithPassword } from "@/lib/auth";
import { sanitizeBody } from "@/lib/sanitize";
import { Article } from "@/models/Article";
import { SiteSection } from "@/models/SiteSection";

// ---------- Types and constants ----------

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
  subtitle?: string;
  relatedIds?: string[];
  sections: ArticleSectionInput[];
};

type RelatedResult =
  { ok: true; ids: Types.ObjectId[] } | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(["admin", "api", "_next"]);
const MAX_RELATED = 10;
const MAX_SUBTITLE = 300;

function isDuplicateKey(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: number }).code === 11000
  );
}

// ---------- Session ----------

export async function login(password: string): Promise<Result> {
  const error = await loginWithPassword(password);
  return error ? { ok: false, error } : { ok: true };
}

export async function logout(): Promise<Result> {
  await endSession();
  return { ok: true };
}

// ---------- Sections ----------

export async function createSection(
  password: string,
  input: { name: string; slug: string; description?: string },
): Promise<Result<{ id: string }>> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

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
  password: string,
  id: string,
  input: { name: string; description?: string },
): Promise<Result> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

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

export async function deleteSection(
  password: string,
  id: string,
): Promise<Result> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

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

// ---------- Article helpers ----------

function cleanSections(sections: ArticleSectionInput[]) {
  return sections.map((s) => ({ ...s, body: sanitizeBody(s.body) }));
}

function validate(input: ArticleInput): string | null {
  if (!input.title.trim()) return "Il titolo è obbligatorio";
  if (!SLUG_RE.test(input.slug)) return "Slug non valido";
  if ((input.subtitle ?? "").length > MAX_SUBTITLE) {
    return `Il sottotitolo può avere al massimo ${MAX_SUBTITLE} caratteri`;
  }
  return null;
}

async function resolveRelated(
  ids: string[] = [],
  selfId?: string,
): Promise<RelatedResult> {
  const unique = [...new Set(ids)].filter((id) => id !== selfId);

  if (unique.length > MAX_RELATED) {
    return { ok: false, error: `Massimo ${MAX_RELATED} articoli collegati` };
  }
  if (!unique.every((id) => isObjectIdOrHexString(id))) {
    return { ok: false, error: "Riferimento a un articolo non valido" };
  }

  const found = await Article.find({ _id: { $in: unique } })
    .select("_id")
    .lean();

  return { ok: true, ids: found.map((a) => a._id) };
}

async function findWithSection(id: string) {
  return Article.findById(id)
    .populate<{ section: { _id: unknown; slug: string } }>("section", "slug")
    .lean();
}

function invalidateArticle(id: string, sectionSlug: string, slug: string) {
  updateTag(`article:${sectionSlug}/${slug}`);
  updateTag(`section:${sectionSlug}`);
  updateTag(`ref:${id}`);
}

// ---------- Articles ----------

export async function createArticle(
  password: string,
  input: ArticleInput,
): Promise<Result<{ id: string }>> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

  const error = validate(input);
  if (error) return { ok: false, error };

  await dbConnect();

  const section = await SiteSection.findOne({ slug: input.sectionSlug })
    .select("_id")
    .lean();
  if (!section) return { ok: false, error: "Sezione inesistente" };

  const related = await resolveRelated(input.relatedIds);
  if (!related.ok) return related;

  try {
    const article = await Article.create({
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() ?? "",
      slug: input.slug,
      section: section._id,
      status: "draft",
      sections: cleanSections(input.sections),
      related: related.ids,
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
  password: string,
  id: string,
  input: ArticleInput,
): Promise<Result> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

  const error = validate(input);
  if (error) return { ok: false, error };

  await dbConnect();

  const existing = await findWithSection(id);
  if (!existing) return { ok: false, error: "Articolo non trovato" };

  const newSection = await SiteSection.findOne({ slug: input.sectionSlug })
    .select("_id")
    .lean();
  if (!newSection) return { ok: false, error: "Sezione inesistente" };

  const related = await resolveRelated(input.relatedIds, id);
  if (!related.ok) return related;

  try {
    await Article.updateOne(
      { _id: id },
      {
        $set: {
          title: input.title.trim(),
          subtitle: input.subtitle?.trim() ?? "",
          slug: input.slug,
          section: newSection._id,
          sections: cleanSections(input.sections),
          related: related.ids,
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
    invalidateArticle(id, existing.section.slug, existing.slug);
    invalidateArticle(id, input.sectionSlug, input.slug);
  }

  return { ok: true };
}

export async function publishArticle(
  password: string,
  id: string,
): Promise<Result> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

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

  invalidateArticle(id, article.section.slug, article.slug);

  return { ok: true };
}

export async function unpublishArticle(
  password: string,
  id: string,
): Promise<Result> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

  await dbConnect();

  const article = await findWithSection(id);
  if (!article) return { ok: false, error: "Articolo non trovato" };

  await Article.updateOne({ _id: id }, { $set: { status: "draft" } });

  invalidateArticle(id, article.section.slug, article.slug);

  return { ok: true };
}

export async function deleteArticle(
  password: string,
  id: string,
): Promise<Result> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

  await dbConnect();

  const article = await findWithSection(id);
  if (!article) return { ok: false, error: "Articolo non trovato" };

  const objectId = new Types.ObjectId(id);

  await Article.deleteOne({ _id: objectId });
  await Article.updateMany(
    { related: objectId },
    { $pull: { related: objectId } },
  );

  if (article.status === "published") {
    invalidateArticle(id, article.section.slug, article.slug);
  }

  return { ok: true };
}
