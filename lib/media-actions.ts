"use server";

import { isObjectIdOrHexString } from "mongoose";
import { dbConnect } from "@/lib/db";
import { checkWriteAccess, hasValidSession } from "@/lib/auth";
import {
  describeError,
  destroyImage,
  isCloudinaryUrl,
  runCloudinaryChecks,
  signUpload,
} from "@/lib/cloudinary";
import { getMediaPage, isMediaInUse } from "@/lib/queries";
import { Media } from "@/models/Media";
import type { DiagnosticStep, MediaItem, SavedMedia } from "@/lib/types";

// ---------- Types and constants ----------

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type MediaInput = {
  url: string;
  publicId: string;
  originalName?: string;
  width: number;
  height: number;
  format?: string;
  bytes?: number;
};

const MAX_BATCH = 20;
const SESSION_EXPIRED = "Sessione scaduta: effettua di nuovo l'accesso";

function failure(context: string, e: unknown) {
  console.error(`[media] ${context}`, e);
  return { ok: false as const, error: `${context}: ${describeError(e)}` };
}

// ---------- Upload signature ----------

export async function getUploadSignature(password: string) {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false as const, error: denied };

  try {
    return { ok: true as const, ...signUpload() };
  } catch (e) {
    return failure("Firma Cloudinary non generata", e);
  }
}

// ---------- Gallery ----------

export async function saveMediaBatch(
  password: string,
  items: MediaInput[],
): Promise<Result<{ items: SavedMedia[] }>> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BATCH) {
    return { ok: false, error: "Elenco di immagini non valido" };
  }

  try {
    for (const m of items) {
      if (!isCloudinaryUrl(m.url)) {
        return {
          ok: false,
          error: `L'URL non appartiene al tuo account Cloudinary (${m.url.slice(0, 70)})`,
        };
      }
      if (!m.publicId || !m.url.includes(m.publicId)) {
        return { ok: false, error: "L'ID dell'immagine non corrisponde al suo URL" };
      }
    }

    await dbConnect();

    await Media.bulkWrite(
      items.map((m) => ({
        updateOne: {
          filter: { publicId: m.publicId },
          update: {
            $setOnInsert: {
              url: m.url,
              publicId: m.publicId,
              originalName: (m.originalName ?? "").slice(0, 200),
              width: Math.round(m.width),
              height: Math.round(m.height),
              format: m.format,
              bytes: m.bytes,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
    );

    const docs = await Media.find({
      publicId: { $in: items.map((m) => m.publicId) },
    })
      .select("url publicId")
      .sort({ _id: -1 })
      .lean();

    return {
      ok: true,
      items: docs.map((d) => ({
        id: String(d._id),
        url: d.url,
        publicId: d.publicId,
      })),
    };
  } catch (e) {
    return failure("Registrazione in galleria non riuscita", e);
  }
}

export async function listMedia(
  cursor?: string,
): Promise<Result<{ items: MediaItem[]; nextCursor: string | null }>> {
  if (!(await hasValidSession())) return { ok: false, error: SESSION_EXPIRED };

  try {
    const page = await getMediaPage(cursor);
    return { ok: true, ...page };
  } catch (e) {
    return failure("Lettura della galleria non riuscita", e);
  }
}

export async function deleteMedia(
  password: string,
  id: string,
): Promise<Result> {
  const denied = await checkWriteAccess(password);
  if (denied) return { ok: false, error: denied };

  if (!isObjectIdOrHexString(id)) {
    return { ok: false, error: "Immagine non trovata" };
  }

  try {
    await dbConnect();

    const media = await Media.findById(id).lean();
    if (!media) return { ok: false, error: "Immagine non trovata" };

    if (await isMediaInUse(media.publicId)) {
      return {
        ok: false,
        error: "L'immagine è usata in almeno un articolo: rimuovila da lì prima",
      };
    }

    const done = await destroyImage(media.publicId);
    if (!done) {
      return { ok: false, error: "Cloudinary non ha confermato l'eliminazione" };
    }

    await Media.deleteOne({ _id: media._id });
    return { ok: true };
  } catch (e) {
    return failure("Eliminazione non riuscita", e);
  }
}

// ---------- Diagnostics ----------

export async function diagnoseCloudinary(): Promise<
  Result<{ steps: DiagnosticStep[] }>
> {
  if (!(await hasValidSession())) return { ok: false, error: SESSION_EXPIRED };

  const steps = await runCloudinaryChecks();

  try {
    await dbConnect();
    const count = await Media.estimatedDocumentCount();
    steps.push({
      name: "Database",
      ok: true,
      detail: `Raggiungibile, ${count} immagini registrate`,
    });
  } catch (e) {
    steps.push({ name: "Database", ok: false, detail: describeError(e) });
  }

  return { ok: true, steps };
}
