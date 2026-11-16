import type { ArticleForm } from "./shared";

export const isBlobUrl = (url: string) => url.startsWith("blob:");

// ---------- Collect ----------

export function collectBlobUrls(form: ArticleForm): string[] {
  const found = new Set<string>();

  for (const b of form.blocks) {
    if (isBlobUrl(b.imageUrl)) found.add(b.imageUrl);
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
      const media = uploaded.get(b.imageUrl);
      return media ? { ...b, imageUrl: media.url } : b;
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
    blocks: form.blocks.map((b) =>
      isBlobUrl(b.imageUrl) && !isLive(b.imageUrl)
        ? { ...b, imageUrl: "", imageAlt: "" }
        : b,
    ),
  };
}
