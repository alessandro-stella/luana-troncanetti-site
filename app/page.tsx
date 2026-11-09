import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { getAllSections } from "@/lib/queries";

export const instant = false;

export default async function HomePage() {
  "use cache";

  cacheLife("days");
  cacheTag("sections");

  const sections = await getAllSections();

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold mb-8">Il Mio Blog</h1>

      {sections.length === 0 ? (
        <p className="text-gray-500">Nessuna sezione disponibile al momento.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section) => (
            <Link
              key={section._id.toString()}
              href={`/${section.slug}`}
              className="block p-6 border rounded-lg hover:border-blue-500 hover:shadow-md transition"
            >
              <h2 className="text-2xl font-semibold capitalize">
                {section.name}
              </h2>
              {section.description && (
                <p className="mt-2 text-gray-600 line-clamp-2">
                  {section.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
