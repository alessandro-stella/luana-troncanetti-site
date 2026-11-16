import type { Dispatch, SetStateAction } from "react";
import type { Align, ArticleEditDto, ImagePosition } from "@/lib/types";
import type { PendingFiles } from "./usePendingFiles";

// ---------- Types ----------

export type SectionItem = { id: string; name: string; slug: string };

export type ArticleItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  sectionName: string;
  sectionSlug: string;
};

export type Block = {
  subtitle: string;
  body: string;
  align: Align;
  imageUrl: string;
  imageAlt: string;
  imagePosition: ImagePosition;
};

export type ArticleForm = {
  sectionSlug: string;
  slug: string;
  title: string;
  subtitle: string;
  blocks: Block[];
  relatedIds: string[];
};

export type EditState = {
  id: string | null;
  baseline: string;
  form: ArticleForm;
};

export type Draft = {
  section: { name: string; slug: string; description: string };
  article: ArticleForm;
  edit: EditState;
};

export type Tab = "sections" | "new" | "media" | "edit";
export type UiState = { tab: Tab };

export type ActionResult = { ok: true } | { ok: false; error: string };

export type TabProps = {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  pending: boolean;
  password: string;
  requirePassword: () => boolean;
  notify: (type: "ok" | "error", text: string) => void;
  files: PendingFiles;
  run: (
    task: () => Promise<ActionResult>,
    successText: string,
    onSuccess?: () => void,
  ) => void;
};

// ---------- Defaults ----------

export const EMPTY_BLOCK: Block = {
  subtitle: "",
  body: "",
  align: "left",
  imageUrl: "",
  imageAlt: "",
  imagePosition: "middle",
};

export const EMPTY_FORM: ArticleForm = {
  sectionSlug: "",
  slug: "",
  title: "",
  subtitle: "",
  blocks: [EMPTY_BLOCK],
  relatedIds: [],
};

export const EMPTY_EDIT: EditState = {
  id: null,
  baseline: "",
  form: EMPTY_FORM,
};

export const EMPTY_DRAFT: Draft = {
  section: { name: "", slug: "", description: "" },
  article: EMPTY_FORM,
  edit: EMPTY_EDIT,
};

export const EMPTY_UI: UiState = { tab: "new" };

export const DRAFT_KEY = "admin-draft-v5";
export const UI_KEY = "admin-ui-v2";

// ---------- Helpers ----------

export function isDirty(d: Draft) {
  const editing =
    d.edit.id !== null && JSON.stringify(d.edit.form) !== d.edit.baseline;

  return (
    editing ||
    JSON.stringify(d.section) !== JSON.stringify(EMPTY_DRAFT.section) ||
    JSON.stringify(d.article) !== JSON.stringify(EMPTY_FORM)
  );
}

export function formFromDto(dto: ArticleEditDto): ArticleForm {
  return {
    sectionSlug: dto.sectionSlug,
    slug: dto.slug,
    title: dto.title,
    subtitle: dto.subtitle,
    blocks: dto.blocks.length > 0 ? dto.blocks : [EMPTY_BLOCK],
    relatedIds: dto.relatedIds,
  };
}

// ---------- Styles ----------

export const inputCls = "w-full border rounded px-3 py-2";
export const btnCls =
  "px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50";
export const btnGhostCls =
  "px-3 py-1 rounded border text-sm disabled:opacity-50";
