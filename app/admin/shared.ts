import type { Dispatch, SetStateAction } from "react";

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
  imageUrl: string;
  imageAlt: string;
};

export type Draft = {
  section: { name: string; slug: string; description: string };
  article: {
    sectionSlug: string;
    slug: string;
    title: string;
    subtitle: string;
    blocks: Block[];
    relatedIds: string[];
  };
};

export type Tab = "sections" | "articles";
export type UiState = { tab: Tab };

export type ActionResult = { ok: true } | { ok: false; error: string };

export type TabProps = {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  pending: boolean;
  password: string;
  requirePassword: () => boolean;
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
  imageUrl: "",
  imageAlt: "",
};

export const EMPTY_DRAFT: Draft = {
  section: { name: "", slug: "", description: "" },
  article: {
    sectionSlug: "",
    slug: "",
    title: "",
    subtitle: "",
    blocks: [EMPTY_BLOCK],
    relatedIds: [],
  },
};

export const EMPTY_UI: UiState = { tab: "articles" };

export const DRAFT_KEY = "admin-draft-v2";
export const UI_KEY = "admin-ui-v1";

// ---------- Styles ----------

export const inputCls = "w-full border rounded px-3 py-2";
export const btnCls =
  "px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50";
export const btnGhostCls =
  "px-3 py-1 rounded border text-sm disabled:opacity-50";
