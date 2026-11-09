import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import {
  getAllSections,
  getSectionBySlug,
  getArticlesBySection,
} from "@/lib/queries";

export const instant = false;

interface SectionPageProps {
  params: Promise<{
    section: string;
  }>;
}

export async function generateStaticParams() {
  const sections = await getAllSections();
  return sections.map((s) => ({ section: s.slug }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  "use cache";

  const { section: sectionSlug } = await params;

  cacheLife("days");
  cacheTag(`section:${sectionSlug}`);

  const section = await getSectionBySlug(sectionSlug);
  if (!section) {
    notFound();
  }

  const articles = await getArticlesBySection(sectionSlug);

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold mb-8 capitalize">{section.name}</h1>

      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          &larr; Torna alla Home
        </Link>
      </div>

      {articles.length === 0 ? (
        <p className="text-gray-500">
          Nessun articolo pubblicato in questa sezione.
        </p>
      ) : (
        <div className="space-y-6">
          {articles.map((article) => (
            <Link
              key={article._id.toString()}
              href={`/${sectionSlug}/${article.slug}`}
              className="block p-6 border rounded-lg hover:border-blue-500 hover:shadow-md transition"
            >
              <h2 className="text-2xl font-semibold">{article.title}</h2>
              {article.publishedAt && (
                <p className="text-sm text-gray-500 mt-2">
                  Pubblicato il:{" "}
                  {new Date(article.publishedAt).toLocaleDateString("it-IT")}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
