import type { ArticleForm } from "./shared";

// ---------- Patterns ----------

const BLOB_RE = /blob:[^\s"'<>)]+/g;
const BLOB_IMG_RE = /<img\b[^>]*\bsrc=["'](blob:[^"']+)["'][^>]*>/gi;

export const isBlobUrl = (url: string) => url.startsWith("blob:");

// ---------- Collect ----------

export function collectBlobUrls(form: ArticleForm): string[] {
  const found = new Set<string>();

  for (const b of form.blocks) {
    if (isBlobUrl(b.imageUrl)) found.add(b.imageUrl);
    for (const url of b.body.match(BLOB_RE) ?? []) found.add(url);
  }

  return [...found];
}

// ---------- Replace after upload ----------

export function applyUploads(
  form: ArticleForm,
  uploaded: Map<string, { url: string }>,
): ArticleForm {
  return {
    ...form,
    blocks: form.blocks.map((b) => {
      let body = b.body;
      for (const [blob, media] of uploaded) {
        body = body.split(blob).join(media.url);
      }

      const cover = uploaded.get(b.imageUrl);
      return cover ? { ...b, body, imageUrl: cover.url } : { ...b, body };
    }),
  };
}

// ---------- Remove images lost after a reload ----------

export function stripDeadBlobs(
  form: ArticleForm,
  isLive: (url: string) => boolean,
): ArticleForm {
  return {
    ...form,
    blocks: form.blocks.map((b) => {
      const coverDead = isBlobUrl(b.imageUrl) && !isLive(b.imageUrl);

      return {
        ...b,
        body: b.body.replace(BLOB_IMG_RE, (tag, url: string) =>
          isLive(url) ? tag : "",
        ),
        ...(coverDead ? { imageUrl: "", imageAlt: "" } : {}),
      };
    }),
  };
}
