import Image from "next/image";
import Link from "next/link";
import type { Align, ImagePosition } from "@/lib/types";

// ---------- Types ----------

export type ArticleViewImage = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  position?: ImagePosition;
};

export type ArticleViewBlock = {
  subtitle?: string;
  html: string;
  align?: Align;
  image?: ArticleViewImage;
};

type ArticleViewProps = {
  title: string;
  subtitle?: string;
  blocks: ArticleViewBlock[];
  related: { title: string; href: string }[];
  preview?: boolean;
};

// ---------- Styles ----------

const ALIGN_CLS: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
};

const BODY_CLS = [
  "space-y-3 leading-relaxed",
  "[&_a]:text-blue-500 [&_a]:underline",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_h3]:text-xl [&_h3]:font-semibold [&_h4]:text-lg [&_h4]:font-semibold",
  "[&_hr]:my-4 [&_code]:rounded [&_code]:px-1 [&_pre]:overflow-x-auto",
  "[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg",
].join(" ");

// ---------- Block image ----------

function BlockImage({
  image,
  priority,
  preview,
}: {
  image: ArticleViewImage;
  priority: boolean;
  preview: boolean;
}) {
  if (preview) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.url}
        alt={image.alt || ""}
        className="my-4 rounded-lg h-auto w-full"
      />
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt || ""}
      width={image.width ?? 800}
      height={image.height ?? 450}
      sizes="(min-width: 768px) 768px, 100vw"
      priority={priority}
      className="my-4 rounded-lg h-auto w-full"
    />
  );
}

// ---------- View ----------

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
        {blocks.map((block, index) => {
          const position = block.image?.position ?? "bottom";
          const image = block.image && (
            <BlockImage
              image={block.image}
              priority={index === 0}
              preview={preview}
            />
          );

          return (
            <section key={index} className={ALIGN_CLS[block.align ?? "left"]}>
              {position === "top" && image}
              {block.subtitle && (
                <h2 className="text-2xl font-semibold mb-2">{block.subtitle}</h2>
              )}
              {position === "middle" && image}
              <div
                className={BODY_CLS}
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
              {position === "bottom" && image}
            </section>
          );
        })}
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
