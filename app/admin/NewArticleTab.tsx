"use client";

import type { Dispatch, SetStateAction } from "react";
import { createArticle } from "@/lib/actions";
import ArticleEditor from "./ArticleEditor";
import {
  EMPTY_FORM,
  type ArticleForm,
  type ArticleItem,
  type SectionItem,
  type TabProps,
} from "@/lib/admin/shared";

type Props = TabProps & {
  sections: SectionItem[];
  articles: ArticleItem[];
};

export default function NewArticleTab({
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
  const setForm: Dispatch<SetStateAction<ArticleForm>> = (update) =>
    setDraft((d) => ({
      ...d,
      article: typeof update === "function" ? update(d.article) : update,
    }));

  return (
    <ArticleEditor
      heading="Nuovo articolo"
      form={draft.article}
      setForm={setForm}
      sections={sections}
      articles={articles}
      submitLabel="Salva come bozza"
      successText="Bozza salvata: pubblicala dalla sezione Modifica articoli"
      save={(input) => createArticle(password, input)}
      onSaved={() => setForm(EMPTY_FORM)}
      pending={pending}
      password={password}
      requirePassword={requirePassword}
      notify={notify}
      files={files}
      run={run}
    />
  );
}
