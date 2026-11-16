import type { Dispatch, SetStateAction } from "react";
import { getUploadSignature, saveMediaBatch } from "@/lib/media-actions";
import type { SavedMedia } from "@/lib/types";
import { applyUploads, collectBlobUrls } from "./blobs";
import type { ArticleForm } from "./shared";
import type { PendingFiles } from "./usePendingFiles";

// ---------- Constants ----------

export const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH = 20;

type CloudinaryResponse = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  error?: { message: string };
};

export type UploadOutcome =
  | { file: File; ok: true; media: SavedMedia }
  | { file: File; ok: false; error: string };

type Uploaded = { file: File; data: CloudinaryResponse };

export type LogFn = (line: string) => void;

// ---------- Validation ----------

export function validateImageFile(file: File): string | null {
  if (!ACCEPT.split(",").includes(file.type)) {
    return `${file.name}: formato non supportato (${file.type || "tipo sconosciuto"})`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: supera i ${MAX_FILE_BYTES / 1024 / 1024} MB`;
  }
  return null;
}

// ---------- Direct upload to Cloudinary + gallery registration ----------

export async function uploadFiles(
  password: string,
  files: File[],
  log: LogFn = () => {},
): Promise<
  { ok: true; outcomes: UploadOutcome[] } | { ok: false; error: string }
> {
  if (files.length > MAX_BATCH) {
    return { ok: false, error: `Massimo ${MAX_BATCH} immagini per volta` };
  }

  log("Richiesta della firma al server…");
  const sig = await getUploadSignature(password);
  if (!sig.ok) {
    log(`ERRORE firma: ${sig.error}`);
    return sig;
  }
  log(`Firma ottenuta · cloud «${sig.cloudName}» · cartella «${sig.folder}»`);

  const settled = await Promise.all(
    files.map(async (file): Promise<UploadOutcome | Uploaded> => {
      const label = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB, ${file.type})`;
      log(`Upload di ${label}…`);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", sig.apiKey);
        form.append("timestamp", String(sig.timestamp));
        form.append("signature", sig.signature);
        form.append("folder", sig.folder);
        form.append("allowed_formats", sig.allowedFormats);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
          { method: "POST", body: form },
        );
        const data = (await res.json().catch(() => null)) as CloudinaryResponse | null;

        if (!res.ok || !data) {
          const message = data?.error?.message ?? "risposta non valida";
          log(`${file.name} → HTTP ${res.status} · ERRORE: ${message}`);
          return { file, ok: false, error: `HTTP ${res.status}: ${message}` };
        }

        log(`${file.name} → HTTP ${res.status} · OK · public_id «${data.public_id}»`);
        return { file, data };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`${file.name} → ERRORE di rete: ${message} (controlla la scheda Rete degli strumenti del browser)`);
        return { file, ok: false, error: `Errore di rete: ${message}` };
      }
    }),
  );

  const uploaded = settled.filter((s): s is Uploaded => "data" in s);

  if (uploaded.length === 0) {
    return { ok: true, outcomes: settled as UploadOutcome[] };
  }

  const payload = uploaded.map(({ file, data }) => ({
    url: data.secure_url,
    publicId: data.public_id,
    originalName: file.name,
    width: data.width,
    height: data.height,
    format: data.format,
    bytes: data.bytes,
  }));

  log(`Registrazione di ${payload.length} immagini in galleria…`);
  let saved = await saveMediaBatch(password, payload);
  if (!saved.ok) {
    log(`ERRORE registrazione: ${saved.error} · nuovo tentativo…`);
    saved = await saveMediaBatch(password, payload);
  }

  if (!saved.ok) {
    log(`ERRORE registrazione: ${saved.error}`);
    return {
      ok: false,
      error: `Immagini caricate su Cloudinary ma non registrate in galleria (${saved.error}).`,
    };
  }
  log("Registrazione completata");

  const byPublicId = new Map(saved.items.map((m) => [m.publicId, m]));

  const outcomes: UploadOutcome[] = settled.map((s) => {
    if ("ok" in s) return s;
    const media = byPublicId.get(s.data.public_id);
    return media
      ? { file: s.file, ok: true, media }
      : { file: s.file, ok: false, error: "Registrazione non riuscita" };
  });

  return { ok: true, outcomes };
}

// ---------- Upload the local images of an article form ----------

export async function uploadPendingImages(
  password: string,
  form: ArticleForm,
  files: PendingFiles,
  setForm: Dispatch<SetStateAction<ArticleForm>>,
): Promise<{ ok: true; form: ArticleForm } | { ok: false; error: string }> {
  const blobs = collectBlobUrls(form);
  if (blobs.length === 0) return { ok: true, form };

  if (blobs.some((url) => !files.has(url))) {
    return {
      ok: false,
      error:
        "Alcune immagini locali non sono più disponibili: rimuovile con il pulsante giallo o riselezionale",
    };
  }

  const res = await uploadFiles(
    password,
    blobs.map((url) => files.get(url)!),
  );
  if (!res.ok) return res;

  const uploaded = new Map<string, SavedMedia>();
  const failed: string[] = [];

  res.outcomes.forEach((o, i) => {
    if (o.ok) uploaded.set(blobs[i], o.media);
    else failed.push(`${o.file.name} (${o.error})`);
  });

  let next = form;
  if (uploaded.size > 0) {
    next = applyUploads(form, uploaded);
    setForm((f) => applyUploads(f, uploaded));
    uploaded.forEach((_, blob) => files.release(blob));
  }

  if (failed.length > 0) {
    return {
      ok: false,
      error: `Upload non riuscito: ${failed.join(", ")}. Le altre immagini sono state caricate: riprova.`,
    };
  }

  return { ok: true, form: next };
}
