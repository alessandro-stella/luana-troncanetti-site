"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import ArticleView from "@/components/ArticleView";
import { thumbUrl, withTransform } from "@/lib/media-shared";
import type {
  Align,
  ArticleInputDto,
  ImagePosition,
  MediaItem,
} from "@/lib/types";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import {
  ActionResult,
  ArticleForm,
  ArticleItem,
  Block,
  btnCls,
  btnGhostCls,
  EMPTY_BLOCK,
  inputCls,
  SectionItem,
  TabProps,
} from "@/lib/admin/shared";
import {
  ACCEPT,
  uploadPendingImages,
  validateImageFile,
} from "@/lib/admin/upload";
import { collectBlobUrls, isBlobUrl, stripDeadBlobs } from "@/lib/admin/blobs";
import RadioRow from "@/components/admin/RadioRow";
import RelatedPicker from "@/components/admin/RelatedPicker";
import { renderPreview } from "@/lib/admin/previewMarkdown";
import MarkdownField from "@/components/admin/MarkdownField";

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

const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "left", label: "Sinistra" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Destra" },
  { value: "justify", label: "Giustificato" },
];

const POSITION_OPTIONS: { value: ImagePosition; label: string }[] = [
  { value: "top", label: "Sopra il titolo" },
  { value: "middle", label: "Tra titolo e testo" },
  { value: "bottom", label: "Sotto il testo" },
];

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
      align: b.align,
      image: b.imageUrl.trim()
        ? {
            url: b.imageUrl.trim(),
            alt: b.imageAlt.trim() || undefined,
            position: b.imagePosition,
          }
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
  const uid = useId();
  const deferred = useDeferredValue(form);

  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileIndex = useRef<number | null>(null);

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

  function chooseFile(index: number) {
    fileIndex.current = index;
    fileInput.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    const index = fileIndex.current;
    fileIndex.current = null;
    if (!file || index === null) return;

    const error = validateImageFile(file);
    if (error) {
      notify("error", error);
      return;
    }

    setBlock(index, { imageUrl: files.add(file) });
  }

  function pickFromGallery(media: MediaItem) {
    const index = pickerIndex;
    setPickerIndex(null);
    if (index !== null) setBlock(index, { imageUrl: media.url });
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
        html: renderPreview(b.body),
        align: b.align,
        image: b.imageUrl.trim()
          ? {
              url: isBlobUrl(b.imageUrl)
                ? b.imageUrl
                : withTransform(b.imageUrl, "f_auto,q_auto,w_1200"),
              alt: b.imageAlt,
              position: b.imagePosition,
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
                  placeholder="Titolo del blocco (facoltativo)"
                  value={b.subtitle}
                  onChange={(e) => setBlock(i, { subtitle: e.target.value })}
                />

                <MarkdownField
                  value={b.body}
                  onChange={(body) => setBlock(i, { body })}
                  rows={8}
                  placeholder="Testo del blocco: seleziona una parte per formattarla"
                />

                <RadioRow
                  legend="Allineamento del blocco"
                  name={`${uid}-align-${i}`}
                  value={b.align}
                  options={ALIGN_OPTIONS}
                  onChange={(align) => setBlock(i, { align })}
                />

                <div className="space-y-2 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Immagine:</span>
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => chooseFile(i)}
                    >
                      Carica dal computer
                    </button>
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => setPickerIndex(i)}
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
                    <>
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            isBlobUrl(b.imageUrl)
                              ? b.imageUrl
                              : thumbUrl(b.imageUrl)
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

                      <input
                        className={inputCls}
                        placeholder="Testo alternativo dell'immagine"
                        value={b.imageAlt}
                        onChange={(e) =>
                          setBlock(i, { imageAlt: e.target.value })
                        }
                      />

                      <RadioRow
                        legend="Posizione dell'immagine"
                        name={`${uid}-position-${i}`}
                        value={b.imagePosition}
                        options={POSITION_OPTIONS}
                        onChange={(imagePosition) =>
                          setBlock(i, { imagePosition })
                        }
                      />
                    </>
                  )}
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

            <RelatedPicker
              articles={linkable}
              sections={sections}
              selected={form.relatedIds}
              onToggle={toggleRelated}
            />

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

      {pickerIndex !== null && (
        <MediaPickerModal
          onPick={pickFromGallery}
          onClose={() => setPickerIndex(null)}
        />
      )}
    </div>
  );
}
