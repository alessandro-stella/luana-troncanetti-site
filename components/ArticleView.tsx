import Image from "next/image";
import Link from "next/link";

export type ArticleViewBlock = {
  subtitle?: string;
  body: string;
  image?: { url: string; alt?: string; width?: number; height?: number };
};

type ArticleViewProps = {
  title: string;
  subtitle?: string;
  blocks: ArticleViewBlock[];
  related: { title: string; href: string }[];
  preview?: boolean;
};

export default function ArticleView({
  title,
  subtitle,
  blocks,
  related,
  preview = false,
}: ArticleViewProps) {
  return (
    <article>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {subtitle && <p className="text-xl text-gray-600">{subtitle}</p>}

      <div className="mt-8 space-y-8">
        {blocks.map((block, index) => (
          <section key={index}>
            {block.subtitle && (
              <h2 className="text-2xl font-semibold mb-2">{block.subtitle}</h2>
            )}
            <div
              className="prose"
              dangerouslySetInnerHTML={{ __html: block.body }}
            />
            {block.image &&
              (preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={block.image.url}
                  alt={block.image.alt || ""}
                  className="mt-4 rounded-lg h-auto w-full"
                />
              ) : (
                <Image
                  src={block.image.url}
                  alt={block.image.alt || ""}
                  width={block.image.width ?? 800}
                  height={block.image.height ?? 450}
                  sizes="(min-width: 768px) 768px, 100vw"
                  priority={index === 0}
                  className="mt-4 rounded-lg h-auto w-full"
                />
              ))}
          </section>
        ))}
      </div>

      {related.length > 0 && (
        <aside className="mt-12 border-t pt-6">
          <h2 className="text-xl font-semibold mb-3">Vedi anche</h2>
          <ul className="space-y-2">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-blue-500 hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
