import type { PopulateOptions } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Article } from "@/models/Article";
import { SiteSection } from "@/models/SiteSection";

const RELATED_POPULATE: PopulateOptions = {
  path: "related",
  select: "title slug status section",
  populate: { path: "section", select: "slug" },
};

// ---------- Sections ----------

export async function getAllSections() {
  await dbConnect();
  return SiteSection.find().sort({ name: 1 }).lean();
}

export async function getSectionBySlug(slug: string) {
  await dbConnect();
  return SiteSection.findOne({ slug }).lean();
}

// ---------- Articles ----------

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

export async function getAllArticlesForAdmin() {
  await dbConnect();
  return Article.find().sort({ updatedAt: -1 }).populate("section").lean();
}
