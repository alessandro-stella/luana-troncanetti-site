"use client";

import { useDeferredValue, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  createArticle,
  publishArticle,
  unpublishArticle,
  deleteArticle,
} from "@/lib/actions";
import ArticleView from "@/components/ArticleView";
import {
  EMPTY_BLOCK,
  EMPTY_DRAFT,
  btnCls,
  btnGhostCls,
  inputCls,
  type ActionResult,
  type ArticleItem,
  type Block,
  type Draft,
  type SectionItem,
  type TabProps,
} from "./shared";

type Props = TabProps & {
  sections: SectionItem[];
  articles: ArticleItem[];
};

export default function ArticlesTab({
  sections,
  articles,
  draft,
  setDraft,
  pending,
  password,
  requirePassword,
  run,
}: Props) {
  const a = draft.article;
  const deferred = useDeferredValue(a);

  // ---------- Draft helpers ----------

  const setArticle = (patch: Partial<Draft["article"]>) =>
    setDraft((d) => ({ ...d, article: { ...d.article, ...patch } }));

  const setBlock = (index: number, patch: Partial<Block>) =>
    setDraft((d) => ({
      ...d,
      article: {
        ...d.article,
        blocks: d.article.blocks.map((b, i) =>
          i === index ? { ...b, ...patch } : b,
        ),
      },
    }));

  const addBlock = () =>
    setDraft((d) => ({
      ...d,
      article: { ...d.article, blocks: [...d.article.blocks, EMPTY_BLOCK] },
    }));

  const removeBlock = (index: number) =>
    setDraft((d) => ({
      ...d,
      article: {
        ...d.article,
        blocks: d.article.blocks.filter((_, i) => i !== index),
      },
    }));

  const toggleRelated = (id: string) =>
    setDraft((d) => {
      const current = d.article.relatedIds;
      const relatedIds = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...d, article: { ...d.article, relatedIds } };
    });

  // ---------- Preview ----------

  const preview = useMemo(() => {
    const byId = new Map(articles.map((x) => [x.id, x]));

    return {
      title: deferred.title,
      subtitle: deferred.subtitle,
      blocks: deferred.blocks.map((b) => ({
        subtitle: b.subtitle,
        body: DOMPurify.sanitize(b.body),
        image: b.imageUrl.trim()
          ? { url: b.imageUrl.trim(), alt: b.imageAlt }
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

  // ---------- Actions ----------

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirePassword()) return;
    run(
      () =>
        createArticle(password, {
          sectionSlug: a.sectionSlug,
          slug: a.slug,
          title: a.title,
          subtitle: a.subtitle,
          relatedIds: a.relatedIds,
          sections: a.blocks.map((b) => ({
            subtitle: b.subtitle.trim() || undefined,
            body: b.body,
            image: b.imageUrl.trim()
              ? { url: b.imageUrl.trim(), alt: b.imageAlt.trim() || undefined }
              : undefined,
          })),
        }),
      "Articolo salvato come bozza: pubblicalo dall'elenco",
      () => setArticle(EMPTY_DRAFT.article),
    );
  }

  function articleAction(fn: () => Promise<ActionResult>, text: string) {
    if (!requirePassword()) return;
    run(fn, text);
  }

  // ---------- Render ----------

  return (
    <div className="space-y-12">
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Nuovo articolo</h2>

          <form onSubmit={submit} className="space-y-4">
            <select
              className={inputCls}
              value={a.sectionSlug}
              onChange={(e) => setArticle({ sectionSlug: e.target.value })}
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
              value={a.title}
              onChange={(e) => setArticle({ title: e.target.value })}
            />
            <textarea
              className={inputCls}
              rows={2}
              maxLength={300}
              placeholder="Sottotitolo / breve descrizione (facoltativo)"
              value={a.subtitle}
              onChange={(e) => setArticle({ subtitle: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="slug (es. il-mio-primo-racconto)"
              value={a.slug}
              onChange={(e) => setArticle({ slug: e.target.value })}
            />

            {a.blocks.map((b, i) => (
              <fieldset key={i} className="space-y-2 border rounded p-3">
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
                  className={`${inputCls} font-mono`}
                  rows={8}
                  placeholder="Testo (HTML)"
                  value={b.body}
                  onChange={(e) => setBlock(i, { body: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    placeholder="URL immagine (facoltativo)"
                    value={b.imageUrl}
                    onChange={(e) => setBlock(i, { imageUrl: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="Testo alternativo"
                    value={b.imageAlt}
                    onChange={(e) => setBlock(i, { imageAlt: e.target.value })}
                  />
                </div>
                {a.blocks.length > 1 && (
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
              {articles.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nessun articolo da collegare.
                </p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto">
                  {articles.map((x) => (
                    <li key={x.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={a.relatedIds.includes(x.id)}
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
                + Aggiungi blocco
              </button>
              <button type="submit" disabled={pending} className={btnCls}>
                Salva come bozza
              </button>
            </div>
          </form>
        </section>

        <aside className="max-h-[calc(100vh-2rem)] overflow-auto rounded border p-6 lg:sticky lg:top-4">
          <p className="mb-4 text-xs uppercase tracking-wide text-gray-500">
            Anteprima
          </p>
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

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Articoli</h2>

        {articles.length === 0 ? (
          <p className="text-gray-500">Nessun articolo.</p>
        ) : (
          <ul className="divide-y border rounded">
            {articles.map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span>
                  {x.title}{" "}
                  <span className="text-gray-500">
                    /{x.sectionSlug}/{x.slug}
                  </span>{" "}
                  <span
                    className={
                      x.status === "published"
                        ? "text-green-700 text-sm"
                        : "text-gray-500 text-sm"
                    }
                  >
                    {x.status === "published" ? "pubblicato" : "bozza"}
                  </span>
                </span>

                <span className="flex gap-2">
                  {x.status === "published" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={btnGhostCls}
                      onClick={() =>
                        articleAction(
                          () => unpublishArticle(password, x.id),
                          "Articolo ritirato",
                        )
                      }
                    >
                      Ritira
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className={btnGhostCls}
                      onClick={() =>
                        articleAction(
                          () => publishArticle(password, x.id),
                          "Articolo pubblicato",
                        )
                      }
                    >
                      Pubblica
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    className={btnGhostCls}
                    onClick={() => {
                      if (!confirm(`Eliminare "${x.title}"?`)) return;
                      articleAction(
                        () => deleteArticle(password, x.id),
                        "Articolo eliminato",
                      );
                    }}
                  >
                    Elimina
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
