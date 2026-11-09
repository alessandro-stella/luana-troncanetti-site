import sanitizeHtml from "sanitize-html";

export function sanitizeBody(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h3",
      "h4",
      "blockquote",
    ]),
  });
}
