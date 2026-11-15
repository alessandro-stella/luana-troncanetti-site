// ---------- Cloudinary URL helpers ----------

const UPLOAD_SEGMENT = "/image/upload/";

export function withTransform(url: string, transform: string) {
  if (!url.includes(UPLOAD_SEGMENT)) return url;
  return url.replace(UPLOAD_SEGMENT, `${UPLOAD_SEGMENT}${transform}/`);
}

export function thumbUrl(url: string) {
  return withTransform(url, "c_fill,w_240,h_240,f_auto,q_auto");
}

export function optimizeHtmlImages(html: string) {
  return html
    .replace(
      /(src=["']https:\/\/res\.cloudinary\.com\/[^/"']+\/image\/upload\/)(v\d+\/)/gi,
      "$1f_auto,q_auto,w_1200/$2",
    )
    .replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy"');
}
