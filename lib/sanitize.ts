import sanitizeHtml from "sanitize-html";
import { cloudinaryUrlPrefix } from "@/lib/cloudinary";

export function sanitizeBody(html: string) {
  const prefix = cloudinaryUrlPrefix();

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h3",
      "h4",
      "blockquote",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemesByTag: { img: ["https"] },
    exclusiveFilter: (frame) =>
      frame.tag === "img" && !(frame.attribs.src ?? "").startsWith(prefix),
  });
}
