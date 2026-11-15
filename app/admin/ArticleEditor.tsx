"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import DOMPurify from "dompurify";
import ArticleView from "@/components/ArticleView";
import { thumbUrl, withTransform } from "@/lib/media-shared";
import type { ArticleInputDto, MediaItem } from "@/lib/types";
import MediaPickerModal from "./MediaPickerModal";
import { ACCEPT, uploadPendingImages, validateImageFile } from "./upload";
import { collectBlobUrls, isBlobUrl, stripDeadBlobs } from "./blobs";
import {
  EMPTY_BLOCK,
  btnCls,
  btnGhostCls,
  inputCls,
  type ActionResult,
  type ArticleForm,
  type ArticleItem,
  type Block,
  type SectionItem,
  type TabProps,
} from "./shared";

type Props = Pick<
  TabProps,
  "pending" | "password" | "requirePassword" | "notify" | "files" | "run"
> & {
  heading: string;
  headerSlot?: ReactNode;
  form: ArticleForm;
  setForm: Dispatch<SetStateAction<ArticleForm>>;
  sections: SectionItem[];
  articles: ArticleItem[];
  excludeId?: string | null;
  submitLabel: string;
  successText: string;
  save: (input: ArticleInputDto) => Promise<ActionResult>;
  onSaved?: (saved: ArticleForm) => void;
};

type Target = { index: number; kind: "cover" | "body" };

const PREVIEW_URI =
  /^(?:(?:https?|blob|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

function toInput(form: ArticleForm): ArticleInputDto {
  return {
    sectionSlug: form.sectionSlug,
    slug: form.slug,
    title: form.title,
    subtitle: form.subtitle,
    relatedIds: form.relatedIds,
    sections: form.blocks.map((b) => ({
      subtitle: b.subtitle.trim() || undefined,
      body: b.body,
      image: b.imageUrl.trim()
        ? { url: b.imageUrl.trim(), alt: b.imageAlt.trim() || undefined }
        : undefined,
    })),
  };
}

export default function ArticleEditor({
  heading,
  headerSlot,
  form,
  setForm,
  sections,
  articles,
  excludeId = null,
  submitLabel,
  successText,
  save,
  onSaved,
  pending,
  password,
  requirePassword,
  notify,
  files,
  run,
}: Props) {
  const deferred = useDeferredValue(form);

  const [picker, setPicker] = useState<Target | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<Target | null>(null);
  const bodyRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const linkable = useMemo(
    () => articles.filter((x) => x.id !== excludeId),
    [articles, excludeId],
  );

  // ---------- Form helpers ----------

  const setField = (patch: Partial<ArticleForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  const setBlock = (index: number, patch: Partial<Block>) =>
    setForm((f) => ({
      ...f,
      blocks: f.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));

  const addBlock = () =>
    setForm((f) => ({ ...f, blocks: [...f.blocks, EMPTY_BLOCK] }));

  const removeBlock = (index: number) =>
    setForm((f) => ({ ...f, blocks: f.blocks.filter((_, i) => i !== index) }));

  const toggleRelated = (id: string) =>
    setForm((f) => ({
      ...f,
      relatedIds: f.relatedIds.includes(id)
        ? f.relatedIds.filter((x) => x !== id)
        : [...f.relatedIds, id],
    }));

  // ---------- Images ----------

  function insertIntoBody(index: number, html: string) {
    const el = bodyRefs.current[index];
    const current = form.blocks[index]?.body ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;

    setBlock(index, {
      body: current.slice(0, start) + html + current.slice(end),
    });
  }

  function chooseFile(target: Target) {
    fileTarget.current = target;
    fileInput.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    const target = fileTarget.current;
    fileTarget.current = null;
    if (!file || !target) return;

    const error = validateImageFile(file);
    if (error) {
      notify("error", error);
      return;
    }

    const url = files.add(file);
    if (target.kind === "cover") {
      setBlock(target.index, { imageUrl: url });
    } else {
      insertIntoBody(target.index, `<img src="${url}" alt="">`);
    }
  }

  function pickFromGallery(media: MediaItem) {
    const target = picker;
    setPicker(null);
    if (!target) return;

    if (target.kind === "cover") {
      setBlock(target.index, { imageUrl: media.url });
    } else {
      insertIntoBody(target.index, `<img src="${media.url}" alt="">`);
    }
  }

  const deadBlobs = collectBlobUrls(form).filter((url) => !files.has(url));

  // ---------- Preview ----------

  const preview = useMemo(() => {
    const byId = new Map(articles.map((x) => [x.id, x]));

    return {
      title: deferred.title,
      subtitle: deferred.subtitle,
      blocks: deferred.blocks.map((b) => ({
        subtitle: b.subtitle,
        body: DOMPurify.sanitize(b.body, { ALLOWED_URI_REGEXP: PREVIEW_URI }),
        image: b.imageUrl.trim()
          ? {
              url: isBlobUrl(b.imageUrl)
                ? b.imageUrl
                : withTransform(b.imageUrl, "f_auto,q_auto,w_1200"),
              alt: b.imageAlt,
            }
          : undefined,
      })),
      related: deferred.relatedIds
        .map((id) => byId.get(id))
        .filter((x): x is ArticleItem => !!x && x.status === "published")
        .map((x) => ({ title: x.title, href: `/${x.sectionSlug}/${x.slug}` })),
    };
  }, [deferred, articles]);

  const previewEmpty =
    !deferred.title &&
    !deferred.subtitle &&
    deferred.blocks.every((b) => !b.subtitle && !b.body && !b.imageUrl);

  // ---------- Save ----------

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirePassword()) return;

    let saved = form;

    run(
      async () => {
        const prepared = await uploadPendingImages(
          password,
          form,
          files,
          setForm,
        );
        if (!prepared.ok) return prepared;

        saved = prepared.form;
        return save(toInput(prepared.form));
      },
      successText,
      () => onSaved?.(saved),
    );
  }

  // ---------- Render ----------

  return (
    <div>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={onFileChosen}
      />

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">{heading}</h2>
          {headerSlot}

          {deadBlobs.length > 0 && (
            <div className="space-y-2 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                {deadBlobs.length === 1
                  ? "1 immagine scelta dal computer non è più disponibile"
                  : `${deadBlobs.length} immagini scelte dal computer non sono più disponibili`}{" "}
                perché la pagina è stata ricaricata. Riselezionale oppure
                rimuovile.
              </p>
              <button
                type="button"
                className={btnGhostCls}
                onClick={() =>
                  setForm((f) => stripDeadBlobs(f, (url) => files.has(url)))
                }
              >
                Rimuovi immagini perse
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <select
              className={inputCls}
              value={form.sectionSlug}
              onChange={(e) => setField({ sectionSlug: e.target.value })}
            >
              <option value="">— scegli la sezione —</option>
              {sections.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              className={inputCls}
              placeholder="Titolo"
              value={form.title}
              onChange={(e) => setField({ title: e.target.value })}
            />
            <textarea
              className={inputCls}
              rows={2}
              maxLength={300}
              placeholder="Sottotitolo / breve descrizione (facoltativo)"
              value={form.subtitle}
              onChange={(e) => setField({ subtitle: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="slug (es. il-mio-primo-racconto)"
              value={form.slug}
              onChange={(e) => setField({ slug: e.target.value })}
            />

            {form.blocks.map((b, i) => (
              <fieldset key={i} className="space-y-3 border rounded p-3">
                <legend className="px-1 text-sm text-gray-500">
                  Blocco {i + 1}
                </legend>

                <input
                  className={inputCls}
                  placeholder="Sottotitolo del blocco (facoltativo)"
                  value={b.subtitle}
                  onChange={(e) => setBlock(i, { subtitle: e.target.value })}
                />

                <textarea
                  ref={(el) => {
                    bodyRefs.current[i] = el;
                  }}
                  className={`${inputCls} font-mono`}
                  rows={8}
                  placeholder="Testo (HTML)"
                  value={b.body}
                  onChange={(e) => setBlock(i, { body: e.target.value })}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Immagine nel testo:
                  </span>
                  <button
                    type="button"
                    className={btnGhostCls}
                    onClick={() => chooseFile({ index: i, kind: "body" })}
                  >
                    Carica dal computer
                  </button>
                  <button
                    type="button"
                    className={btnGhostCls}
                    onClick={() => setPicker({ index: i, kind: "body" })}
                  >
                    Scegli dalla galleria
                  </button>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Immagine del blocco:
                    </span>
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => chooseFile({ index: i, kind: "cover" })}
                    >
                      Carica dal computer
                    </button>
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => setPicker({ index: i, kind: "cover" })}
                    >
                      Scegli dalla galleria
                    </button>
                    {b.imageUrl && (
                      <button
                        type="button"
                        className={btnGhostCls}
                        onClick={() =>
                          setBlock(i, { imageUrl: "", imageAlt: "" })
                        }
                      >
                        Rimuovi immagine
                      </button>
                    )}
                  </div>

                  {b.imageUrl && (
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          isBlobUrl(b.imageUrl) ? b.imageUrl : thumbUrl(b.imageUrl)
                        }
                        alt=""
                        className="h-16 w-16 rounded object-cover"
                      />
                      <span className="text-xs text-gray-500">
                        {isBlobUrl(b.imageUrl)
                          ? "Dal computer: verrà caricata al salvataggio"
                          : "Dalla galleria"}
                      </span>
                    </div>
                  )}

                  <input
                    className={inputCls}
                    placeholder="Testo alternativo dell'immagine"
                    value={b.imageAlt}
                    onChange={(e) => setBlock(i, { imageAlt: e.target.value })}
                  />
                </div>

                {form.blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    className={btnGhostCls}
                  >
                    Rimuovi blocco
                  </button>
                )}
              </fieldset>
            ))}

            <fieldset className="space-y-2 border rounded p-3">
              <legend className="px-1 text-sm text-gray-500">Vedi anche</legend>
              {linkable.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nessun articolo da collegare.
                </p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto">
                  {linkable.map((x) => (
                    <li key={x.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.relatedIds.includes(x.id)}
                          onChange={() => toggleRelated(x.id)}
                        />
                        <span>
                          {x.title}{" "}
                          <span className="text-gray-500">
                            ({x.sectionName}
                            {x.status !== "published" ? ", bozza" : ""})
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-500">
                Le bozze compaiono in Vedi anche solo dopo essere state
                pubblicate.
              </p>
            </fieldset>

            <div className="flex gap-3">
              <button type="button" onClick={addBlock} className={btnGhostCls}>
                Aggiungi blocco
              </button>
              <button type="submit" disabled={pending} className={btnCls}>
                {pending ? "Salvataggio…" : submitLabel}
              </button>
            </div>
          </form>
        </section>

        <aside className="max-h-[calc(100vh-2rem)] overflow-auto rounded border p-6 lg:sticky lg:top-4">
          <p className="mb-4 text-xs text-gray-500">Anteprima</p>
          {previewEmpty ? (
            <p className="text-gray-500">
              Comincia a scrivere: l’anteprima apparirà qui.
            </p>
          ) : (
            <div
              onClickCapture={(e) => {
                if ((e.target as HTMLElement).closest("a")) e.preventDefault();
              }}
            >
              <ArticleView preview {...preview} />
            </div>
          )}
        </aside>
      </div>

      {picker && (
        <MediaPickerModal
          onPick={pickFromGallery}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
