"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  deleteArticle,
  loadArticleForEdit,
  publishArticle,
  unpublishArticle,
  updateArticle,
} from "@/lib/actions";
import ArticleEditor from "./ArticleEditor";
import { collectBlobUrls } from "./blobs";
import {
  EMPTY_EDIT,
  btnGhostCls,
  formFromDto,
  inputCls,
  type ActionResult,
  type ArticleForm,
  type ArticleItem,
  type SectionItem,
  type TabProps,
} from "./shared";

type Props = TabProps & {
  sections: SectionItem[];
  articles: ArticleItem[];
};

export default function EditArticlesTab({
  sections,
  articles,
  draft,
  setDraft,
  pending,
  password,
  requirePassword,
  notify,
  files,
  run,
}: Props) {
  const edit = draft.edit;
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const setForm: Dispatch<SetStateAction<ArticleForm>> = (update) =>
    setDraft((d) => ({
      ...d,
      edit: {
        ...d.edit,
        form: typeof update === "function" ? update(d.edit.form) : update,
      },
    }));

  // ---------- Open / close ----------

  async function open(id: string) {
    setLoadingId(id);
    try {
      const res = await loadArticleForEdit(id);
      if (!res.ok) {
        notify("error", res.error);
        return;
      }
      const form = formFromDto(res.article);
      setDraft((d) => ({
        ...d,
        edit: { id, baseline: JSON.stringify(form), form },
      }));
    } catch {
      notify("error", "Errore imprevisto");
    } finally {
      setLoadingId(null);
    }
  }

  function close() {
    const changed = JSON.stringify(edit.form) !== edit.baseline;
    if (changed && !confirm("Scartare le modifiche non salvate?")) return;

    collectBlobUrls(edit.form).forEach((url) => files.release(url));
    setDraft((d) => ({ ...d, edit: EMPTY_EDIT }));
  }

  // ---------- List actions ----------

  function listAction(fn: () => Promise<ActionResult>, text: string) {
    if (!requirePassword()) return;
    run(fn, text);
  }

  // ---------- Editing view ----------

  if (edit.id) {
    const current = articles.find((a) => a.id === edit.id);

    return (
      <ArticleEditor
        heading={`Modifica: ${current?.title ?? edit.form.title}`}
        headerSlot={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className={btnGhostCls} onClick={close}>
              Torna all&apos;elenco
            </button>
            <span
              className={
                current?.status === "published"
                  ? "text-green-700"
                  : "text-gray-500"
              }
            >
              {current?.status === "published" ? "pubblicato" : "bozza"}
            </span>
            {current?.status === "published" && (
              <a
                href={`/${current.sectionSlug}/${current.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline"
              >
                Apri la pagina
              </a>
            )}
          </div>
        }
        form={edit.form}
        setForm={setForm}
        sections={sections}
        articles={articles}
        excludeId={edit.id}
        submitLabel="Salva modifiche"
        successText="Modifiche salvate"
        save={(input) => updateArticle(password, edit.id!, input)}
        onSaved={(saved) =>
          setDraft((d) => ({
            ...d,
            edit: { ...d.edit, baseline: JSON.stringify(saved) },
          }))
        }
        pending={pending}
        password={password}
        requirePassword={requirePassword}
        notify={notify}
        files={files}
        run={run}
      />
    );
  }

  // ---------- List view ----------

  const q = query.trim().toLowerCase();
  const visible = q
    ? articles.filter((a) =>
        `${a.title} ${a.slug} ${a.sectionName}`.toLowerCase().includes(q),
      )
    : articles;

  return (
    <section className="max-w-4xl space-y-4">
      <h2 className="text-2xl font-semibold">Modifica articoli</h2>
      <p className="text-sm text-gray-500">
        Scegli un articolo, pubblicato o in bozza, per modificarlo o eliminarlo.
      </p>

      <input
        className={inputCls}
        placeholder="Cerca per titolo, slug o sezione"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {articles.length === 0 ? (
        <p className="text-gray-500">Nessun articolo.</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500">Nessun articolo corrisponde alla ricerca.</p>
      ) : (
        <ul className="divide-y border rounded">
          {visible.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <span>
                {a.title}{" "}
                <span className="text-gray-500">
                  /{a.sectionSlug}/{a.slug}
                </span>{" "}
                <span
                  className={
                    a.status === "published"
                      ? "text-green-700 text-sm"
                      : "text-gray-500 text-sm"
                  }
                >
                  {a.status === "published" ? "pubblicato" : "bozza"}
                </span>
              </span>

              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={pending || loadingId !== null}
                  className={btnGhostCls}
                  onClick={() => void open(a.id)}
                >
                  {loadingId === a.id ? "Apertura…" : "Modifica"}
                </button>

                {a.status === "published" ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={btnGhostCls}
                    onClick={() =>
                      listAction(
                        () => unpublishArticle(password, a.id),
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
                      listAction(
                        () => publishArticle(password, a.id),
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
                    if (!confirm(`Eliminare "${a.title}"?`)) return;
                    listAction(
                      () => deleteArticle(password, a.id),
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
  );
}
