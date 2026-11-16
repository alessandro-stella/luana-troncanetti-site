import "server-only";
import sanitizeHtml from "sanitize-html";
import { cloudinaryUrlPrefix } from "@/lib/cloudinary";
import { MARKDOWN_TAGS, parseMarkdown } from "@/lib/markdown";
import { optimizeHtmlImages } from "@/lib/media-shared";

// ---------- Markdown to safe HTML (public pages) ----------

export function renderMarkdown(source: string): string {
  const prefix = cloudinaryUrlPrefix();

  const html = sanitizeHtml(parseMarkdown(source), {
    allowedTags: MARKDOWN_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    transformTags: {
      a: (tagName, attribs) =>
        /^https?:/i.test(attribs.href ?? "")
          ? {
              tagName,
              attribs: { ...attribs, rel: "noopener noreferrer", target: "_blank" },
            }
          : { tagName, attribs },
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" && !(frame.attribs.src ?? "").startsWith(prefix),
  });

  return optimizeHtmlImages(html);
}
