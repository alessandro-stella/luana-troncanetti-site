import { Suspense } from "react";
import { hasValidSession } from "@/lib/auth";
import { getAllSections, getAllArticlesForAdmin } from "@/lib/queries";
import LoginForm from "./LoginForm";
import AdminPanel from "./AdminPanel";

export const instant = false;

async function AdminGate() {
  if (!(await hasValidSession())) {
    return <LoginForm />;
  }

  const [sections, articles] = await Promise.all([
    getAllSections(),
    getAllArticlesForAdmin(),
  ]);

  return (
    <AdminPanel
      sections={sections.map((s) => ({
        id: String(s._id),
        name: s.name,
        slug: s.slug,
      }))}
      articles={articles.map((a) => {
        const section = a.section as unknown as {
          name: string;
          slug: string;
        } | null;
        return {
          id: String(a._id),
          title: a.title,
          slug: a.slug,
          status: String(a.status),
          sectionName: section?.name ?? "?",
          sectionSlug: section?.slug ?? "",
        };
      })}
    />
  );
}

export default function AdminPage() {
  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <Suspense fallback={<p className="text-gray-500">Caricamento…</p>}>
        <AdminGate />
      </Suspense>
    </main>
  );
}
