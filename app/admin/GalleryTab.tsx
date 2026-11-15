"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { deleteMedia } from "@/lib/media-actions";
import type { MediaItem } from "@/lib/types";
import MediaGrid from "./MediaGrid";
import { useMediaList } from "./useMediaList";
import {
  ACCEPT,
  MAX_BATCH,
  uploadFiles,
  validateImageFile,
} from "./upload";
import { btnCls, btnGhostCls } from "./shared";

type Props = { password: string };

type Staged = { key: number; file: File; preview: string; error?: string };
type Status = { type: "ok" | "error"; text: string } | null;

export default function GalleryTab({ password }: Props) {
  const list = useMediaList();
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const stagedRef = useRef<Staged[]>([]);

  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(
    () => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.preview)),
    [],
  );

  // ---------- Step 1: choose files (nothing is uploaded) ----------

  function stage(fileList: FileList | null) {
    if (input.current) input.current.value = "";
    if (!fileList || fileList.length === 0) return;

    const errors: string[] = [];
    const next: Staged[] = [];

    for (const file of Array.from(fileList)) {
      if (staged.length + next.length >= MAX_BATCH) {
        errors.push(`Massimo ${MAX_BATCH} immagini per volta`);
        break;
      }
      const error = validateImageFile(file);
      if (error) {
        errors.push(error);
        continue;
      }
      next.push({
        key: counter.current++,
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (next.length > 0) setStaged((prev) => [...prev, ...next]);
    setStatus(errors.length > 0 ? { type: "error", text: errors.join(" · ") } : null);
  }

  function unstage(key: number) {
    const target = staged.find((s) => s.key === key);
    if (target) URL.revokeObjectURL(target.preview);
    setStaged((prev) => prev.filter((s) => s.key !== key));
  }

  function discardAll() {
    staged.forEach((s) => URL.revokeObjectURL(s.preview));
    setStaged([]);
    setStatus(null);
  }

  // ---------- Step 2: confirm the upload ----------

  async function confirmUpload() {
    if (staged.length === 0) return;
    if (!password) {
      setStatus({ type: "error", text: "Inserisci la password di conferma" });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const res = await uploadFiles(
        password,
        staged.map((s) => s.file),
      );
      if (!res.ok) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      const done = new Set<number>();
      const failed = new Map<number, string>();
      const added: MediaItem[] = [];

      res.outcomes.forEach((o, i) => {
        const key = staged[i].key;
        if (o.ok) {
          done.add(key);
          added.push({ id: o.media.id, url: o.media.url });
        } else {
          failed.set(key, o.error);
        }
      });

      staged
        .filter((s) => done.has(s.key))
        .forEach((s) => URL.revokeObjectURL(s.preview));
      setStaged((prev) =>
        prev
          .filter((s) => !done.has(s.key))
          .map((s) => ({ ...s, error: failed.get(s.key) })),
      );
      list.prepend(added);

      setStatus(
        failed.size > 0
          ? {
              type: "error",
              text: `${added.length} caricate, ${failed.size} non riuscite: controlla gli errori e riprova.`,
            }
          : { type: "ok", text: `${added.length} immagini caricate in galleria` },
      );
    } catch {
      setStatus({ type: "error", text: "Errore imprevisto" });
    } finally {
      setBusy(false);
    }
  }

  // ---------- Delete ----------

  async function remove(item: MediaItem) {
    if (!confirm("Eliminare l'immagine dalla galleria e da Cloudinary?")) return;
    if (!password) {
      setStatus({ type: "error", text: "Inserisci la password di conferma" });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const res = await deleteMedia(password, item.id);
      if (!res.ok) {
        setStatus({ type: "error", text: res.error });
        return;
      }
      list.remove(item.id);
      setStatus({ type: "ok", text: "Immagine eliminata" });
    } catch {
      setStatus({ type: "error", text: "Errore imprevisto" });
    } finally {
      setBusy(false);
    }
  }

  // ---------- Render ----------

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Carica nuove immagini</h2>

        <div className="space-y-3">
          <h3 className="font-medium">1. Scegli le immagini</h3>
          <p className="text-sm text-gray-500">
            Le immagini restano sul tuo computer finché non confermi.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              className={btnGhostCls}
              onClick={() => input.current?.click()}
            >
              Scegli immagini
            </button>
            {staged.length > 0 && (
              <button
                type="button"
                disabled={busy}
                className={btnGhostCls}
                onClick={discardAll}
              >
                Annulla selezione
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => stage(e.target.files)}
          />

          {staged.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {staged.map((s) => (
                <li key={s.key} className="space-y-1">
                  <img
                    src={s.preview}
                    alt=""
                    className="aspect-square w-full rounded border object-cover"
                  />
                  <p className="truncate text-xs text-gray-500" title={s.file.name}>
                    {s.file.name} · {Math.max(1, Math.round(s.file.size / 1024))} KB
                  </p>
                  {s.error && <p className="text-xs text-red-600">{s.error}</p>}
                  <button
                    type="button"
                    disabled={busy}
                    className={btnGhostCls}
                    onClick={() => unstage(s.key)}
                  >
                    Rimuovi
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">2. Conferma il caricamento</h3>
          <button
            type="button"
            disabled={busy || staged.length === 0}
            className={btnCls}
            onClick={() => void confirmUpload()}
          >
            {busy
              ? "Caricamento…"
              : staged.length > 0
                ? `Carica ${staged.length} ${staged.length === 1 ? "immagine" : "immagini"} in galleria`
                : "Carica in galleria"}
          </button>
        </div>

        {status && (
          <p
            role="status"
            className={status.type === "ok" ? "text-green-700" : "text-red-600"}
          >
            {status.text}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Immagini caricate</h2>

        {list.error && <p className="text-sm text-red-600">{list.error}</p>}

        {!list.loading && list.items.length === 0 && !list.error && (
          <p className="text-gray-500">Nessuna immagine in galleria.</p>
        )}

        <MediaGrid items={list.items} onDelete={remove} busy={busy} />

        {list.loading && <p className="text-gray-500">Caricamento…</p>}

        {list.hasMore && !list.loading && (
          <button type="button" className={btnGhostCls} onClick={list.loadMore}>
            Mostra altre
          </button>
        )}
      </section>
    </div>
  );
}
