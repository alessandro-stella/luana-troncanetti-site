import DOMPurify from "dompurify";
import { MARKDOWN_TAGS, parseMarkdown } from "@/lib/markdown";
import { optimizeHtmlImages } from "@/lib/media-shared";

// ---------- Markdown to safe HTML (admin preview, runs in the browser) ----------

const ALLOWED_URI =
  /^(?:(?:https?|blob|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

export function renderPreview(source: string): string {
  const html = DOMPurify.sanitize(parseMarkdown(source), {
    ALLOWED_TAGS: MARKDOWN_TAGS,
    ALLOWED_ATTR: ["href", "title", "src", "alt"],
    ALLOWED_URI_REGEXP: ALLOWED_URI,
  });

  return optimizeHtmlImages(html);
}
