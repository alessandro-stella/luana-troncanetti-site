"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteMedia, diagnoseCloudinary } from "@/lib/media-actions";
import type { DiagnosticStep, MediaItem } from "@/lib/types";
import { useMediaList } from "@/hooks/useMediaList";
import {
  ACCEPT,
  MAX_BATCH,
  uploadFiles,
  validateImageFile,
} from "@/lib/admin/upload";
import { btnCls, btnGhostCls } from "@/lib/admin/shared";
import MediaGrid from "@/components/admin/MediaGrid";

type Props = { password: string };

type Staged = { key: number; file: File; preview: string; error?: string };
type Status = { type: "ok" | "error"; text: string } | null;

function makeTestImage(): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.getContext("2d")?.fillRect(0, 0, 1, 1);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("canvas.toBlob ha restituito null"));
        return;
      }
      resolve(new File([blob], "diagnostica-test.png", { type: "image/png" }));
    }, "image/png");
  });
}

export default function GalleryTab({ password }: Props) {
  const list = useMediaList();
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [log, setLog] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [steps, setSteps] = useState<DiagnosticStep[] | null>(null);

  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const stagedRef = useRef<Staged[]>([]);

  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(
    () => () =>
      stagedRef.current.forEach((s) => URL.revokeObjectURL(s.preview)),
    [],
  );

  const append = useCallback((line: string) => {
    const time = new Date().toLocaleTimeString("it-IT");
    setLog((prev) => [...prev, `${time}  ${line}`]);
  }, []);

  // ---------- Step 1: choose files (nothing is uploaded) ----------

  function stage(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    console.log("After check!");

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

    if (input.current) input.current.value = "";

    if (next.length > 0) setStaged((prev) => [...prev, ...next]);
    setStatus(
      errors.length > 0 ? { type: "error", text: errors.join(" · ") } : null,
    );
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
    setLog([]);
    try {
      const res = await uploadFiles(
        password,
        staged.map((s) => s.file),
        append,
      );
      if (!res.ok) {
        setStatus({ type: "error", text: res.error });
        setLogOpen(true);
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

      if (failed.size > 0) setLogOpen(true);
      setStatus(
        failed.size > 0
          ? {
              type: "error",
              text: `${added.length} caricate, ${failed.size} non riuscite: controlla gli errori e riprova.`,
            }
          : {
              type: "ok",
              text: `${added.length} immagini caricate in galleria`,
            },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      append(`ECCEZIONE: ${message}`);
      setLogOpen(true);
      setStatus({ type: "error", text: `Errore imprevisto: ${message}` });
    } finally {
      setBusy(false);
    }
  }

  // ---------- Delete ----------

  async function remove(item: MediaItem) {
    if (!confirm("Eliminare l'immagine dalla galleria e da Cloudinary?"))
      return;
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
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ type: "error", text: `Errore imprevisto: ${message}` });
    } finally {
      setBusy(false);
    }
  }

  // ---------- Diagnostics ----------

  async function checkConfig() {
    setBusy(true);
    setSteps(null);
    append("Controllo della configurazione sul server…");
    try {
      const res = await diagnoseCloudinary();
      if (!res.ok) {
        append(`ERRORE: ${res.error}`);
        return;
      }
      setSteps(res.steps);
      res.steps.forEach((s) =>
        append(`${s.ok ? "OK    " : "ERRORE"} ${s.name}: ${s.detail}`),
      );
    } catch (e) {
      append(`ECCEZIONE: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function testUpload() {
    if (!password) {
      append("ERRORE: inserisci la password di conferma in alto");
      return;
    }

    setBusy(true);
    append("--- Prova di upload (immagine 1×1, poi eliminata) ---");
    try {
      const file = await makeTestImage();
      const res = await uploadFiles(password, [file], append);
      if (!res.ok) return;

      const outcome = res.outcomes[0];
      if (!outcome.ok) {
        append(`Prova fallita: ${outcome.error}`);
        return;
      }

      append("Upload e registrazione riusciti: elimino l'immagine di prova…");
      const del = await deleteMedia(password, outcome.media.id);
      if (del.ok) {
        append("Immagine di prova eliminata. Il percorso completo funziona.");
      } else {
        append(`Eliminazione non riuscita: ${del.error}`);
        list.prepend([{ id: outcome.media.id, url: outcome.media.url }]);
      }
    } catch (e) {
      append(`ECCEZIONE: ${e instanceof Error ? e.message : String(e)}`);
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
                  <p
                    className="truncate text-xs text-gray-500"
                    title={s.file.name}
                  >
                    {s.file.name} ·{" "}
                    {Math.max(1, Math.round(s.file.size / 1024))} KB
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
              ? "Operazione in corso…"
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

        <details
          className="rounded border p-3"
          open={logOpen}
          onToggle={(e) => setLogOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium">
            Diagnostica e dettagli tecnici
          </summary>

          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={btnGhostCls}
                onClick={() => void checkConfig()}
              >
                Controlla la configurazione
              </button>
              <button
                type="button"
                disabled={busy}
                className={btnGhostCls}
                onClick={() => void testUpload()}
              >
                Prova di upload (1×1)
              </button>
              <button
                type="button"
                disabled={log.length === 0}
                className={btnGhostCls}
                onClick={() =>
                  void navigator.clipboard.writeText(log.join("\n"))
                }
              >
                Copia il log
              </button>
              <button
                type="button"
                disabled={log.length === 0 && !steps}
                className={btnGhostCls}
                onClick={() => {
                  setLog([]);
                  setSteps(null);
                }}
              >
                Svuota
              </button>
            </div>

            {steps && (
              <ul className="space-y-1 text-sm">
                {steps.map((s) => (
                  <li
                    key={s.name}
                    className={s.ok ? "text-green-700" : "text-red-600"}
                  >
                    {s.ok ? "✓" : "✗"} {s.name}: {s.detail}
                  </li>
                ))}
              </ul>
            )}

            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border p-3 text-xs">
              {log.length > 0
                ? log.join("\n")
                : "Il log comparirà qui durante un upload o una prova."}
            </pre>
          </div>
        </details>
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
