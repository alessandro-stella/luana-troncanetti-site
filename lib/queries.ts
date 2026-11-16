import { isObjectIdOrHexString, type PopulateOptions } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Article } from "@/models/Article";
import { Media } from "@/models/Media";
import { SiteSection } from "@/models/SiteSection";
import type { ArticleEditDto, MediaItem } from "@/lib/types";

const RELATED_POPULATE: PopulateOptions = {
  path: "related",
  select: "title slug status section",
  populate: { path: "section", select: "slug" },
};

const MEDIA_PAGE_SIZE = 24;

// ---------- Sections ----------

export async function getAllSections() {
  await dbConnect();
  return SiteSection.find().sort({ name: 1 }).lean();
}

export async function getSectionBySlug(slug: string) {
  await dbConnect();
  return SiteSection.findOne({ slug }).lean();
}

// ---------- Articles (public) ----------

export async function getPublishedArticles() {
  await dbConnect();
  return Article.find({ status: "published" }).sort({ publishedAt: -1 }).lean();
}

export async function getArticleBySectionAndSlug(
  sectionSlug: string,
  articleSlug: string,
) {
  await dbConnect();

  const section = await SiteSection.findOne({ slug: sectionSlug }).lean();
  if (!section) return null;

  return Article.findOne({
    slug: articleSlug,
    section: section._id,
    status: "published",
  })
    .populate("section")
    .populate(RELATED_POPULATE)
    .lean();
}

export async function getArticlesBySection(sectionSlug: string) {
  await dbConnect();

  const section = await SiteSection.findOne({ slug: sectionSlug }).lean();
  if (!section) return [];

  return Article.find({ section: section._id, status: "published" })
    .sort({ publishedAt: -1 })
    .populate("section")
    .lean();
}

export async function getAllArticleParams() {
  await dbConnect();

  const articles = await Article.find({ status: "published" })
    .select("slug section")
    .populate<{ section: { slug: string } | null }>("section", "slug")
    .lean();

  return articles
    .filter((a) => a.section)
    .map((a) => ({ section: a.section!.slug, slug: a.slug }));
}

// ---------- Articles (admin) ----------

export async function getAllArticlesForAdmin() {
  await dbConnect();
  return Article.find().sort({ updatedAt: -1 }).populate("section").lean();
}

export async function getArticleForEdit(
  id: string,
): Promise<ArticleEditDto | null> {
  if (!isObjectIdOrHexString(id)) return null;

  await dbConnect();

  const article = await Article.findById(id)
    .populate<{ section: { slug: string } | null }>("section", "slug")
    .lean();
  if (!article || !article.section) return null;

  return {
    id: String(article._id),
    status: article.status,
    sectionSlug: article.section.slug,
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle ?? "",
    relatedIds: (article.related ?? []).map(String),
    blocks: article.sections.map((s) => ({
      subtitle: s.subtitle ?? "",
      body: s.body,
      align: s.align ?? "left",
      imageUrl: s.image?.url ?? "",
      imageAlt: s.image?.alt ?? "",
      imagePosition: s.image?.position ?? "bottom",
    })),
  };
}

// ---------- Media ----------

export async function getMediaPage(
  cursor?: string,
): Promise<{ items: MediaItem[]; nextCursor: string | null }> {
  await dbConnect();

  const filter =
    cursor && isObjectIdOrHexString(cursor) ? { _id: { $lt: cursor } } : {};

  const docs = await Media.find(filter)
    .select("url")
    .sort({ _id: -1 })
    .limit(MEDIA_PAGE_SIZE + 1)
    .lean();

  const page = docs.slice(0, MEDIA_PAGE_SIZE);

  return {
    items: page.map((d) => ({ id: String(d._id), url: d.url })),
    nextCursor:
      docs.length > MEDIA_PAGE_SIZE ? String(page[page.length - 1]._id) : null,
  };
}

export async function isMediaInUse(publicId: string) {
  await dbConnect();

  const pattern = publicId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = await Article.exists({
    $or: [
      { "sections.image.url": { $regex: pattern } },
      { "sections.body": { $regex: pattern } },
    ],
  });

  return !!found;
}
