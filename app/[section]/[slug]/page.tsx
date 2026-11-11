import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { getArticleBySectionAndSlug, getAllArticleParams } from "@/lib/queries";
import ArticleView from "@/components/ArticleView";

export const instant = false;

interface PageProps {
  params: Promise<{
    section: string;
    slug: string;
  }>;
}

type RelatedDoc = {
  _id: { toString(): string };
  title: string;
  slug: string;
  status: string;
  section: { slug: string } | null;
};

export async function generateStaticParams() {
  const params = await getAllArticleParams();

  return params.length > 0
    ? params
    : [{ section: "_placeholder", slug: "_placeholder" }];
}

export default async function ArticlePage({ params }: PageProps) {
  "use cache";

  const { section, slug } = await params;

  cacheLife("max");
  cacheTag(`article:${section}/${slug}`);

  const article = await getArticleBySectionAndSlug(section, slug);

  if (!article) {
    notFound();
  }

  const relatedDocs = (article.related ?? []) as unknown as RelatedDoc[];

  if (relatedDocs.length > 0) {
    cacheTag(...relatedDocs.map((r) => `ref:${r._id.toString()}`));
  }

  const related = relatedDocs
    .filter((r) => r.status === "published" && r.section)
    .map((r) => ({ title: r.title, href: `/${r.section!.slug}/${r.slug}` }));

  return (
    <div className="max-w-3xl mx-auto py-10">
      <ArticleView
        title={article.title}
        subtitle={article.subtitle}
        blocks={article.sections}
        related={related}
      />
    </div>
  );
}
