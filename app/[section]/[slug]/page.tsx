import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import { getArticleBySectionAndSlug, getAllArticleParams } from "@/lib/queries";

export const instant = false;

interface PageProps {
  params: Promise<{
    section: string;
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return getAllArticleParams();
}

export default async function ArticlePage({ params }: PageProps) {
  "use cache";

  const { section, slug } = await params;

  cacheLife("days");
  cacheTag(`article:${section}/${slug}`);

  const article = await getArticleBySectionAndSlug(section, slug);

  if (!article) {
    notFound();
  }

  return (
    <article className="max-w-3xl mx-auto py-10">
      <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

      <div className="mt-8 space-y-8">
        {article.sections.map((sec, index) => (
          <section key={index}>
            {sec.subtitle && (
              <h2 className="text-2xl font-semibold mb-2">{sec.subtitle}</h2>
            )}
            <div
              className="prose"
              dangerouslySetInnerHTML={{ __html: sec.body }}
            />
            {sec.image && (
              <Image
                src={sec.image.url}
                alt={sec.image.alt || ""}
                width={800}
                height={450}
                sizes="(min-width: 768px) 768px, 100vw"
                priority={index === 0}
                className="mt-4 rounded-lg h-auto w-full"
              />
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
