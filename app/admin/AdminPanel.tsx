"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions";
import { useSessionDraft } from "./useSessionDraft";
import { usePendingFiles } from "./usePendingFiles";
import SectionsTab from "./SectionsTab";
import NewArticleTab from "./NewArticleTab";
import GalleryTab from "./GalleryTab";
import EditArticlesTab from "./EditArticlesTab";
import {
  DRAFT_KEY,
  EMPTY_DRAFT,
  EMPTY_UI,
  UI_KEY,
  btnGhostCls,
  inputCls,
  isDirty,
  type ActionResult,
  type ArticleItem,
  type Draft,
  type SectionItem,
  type Tab,
  type UiState,
} from "./shared";

const TABS: { id: Tab; label: string }[] = [
  { id: "sections", label: "Sezioni" },
  { id: "new", label: "Nuovo articolo" },
  { id: "media", label: "Galleria" },
  { id: "edit", label: "Modifica articoli" },
];

export default function AdminPanel({
  sections,
  articles,
}: {
  sections: SectionItem[];
  articles: ArticleItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [visited, setVisited] = useState<Tab[]>([]);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const files = usePendingFiles();

  const {
    value: draft,
    setValue: setDraft,
    ready: draftReady,
  } = useSessionDraft<Draft>(DRAFT_KEY, EMPTY_DRAFT);
  const {
    value: ui,
    setValue: setUi,
    ready: uiReady,
  } = useSessionDraft<UiState>(UI_KEY, EMPTY_UI);

  const ready = draftReady && uiReady;
  const dirty = ready && isDirty(draft);

  // ---------- Effects ----------

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => () => files.releaseAll(), [files]);

  // ---------- Helpers ----------

  const notify = (type: "ok" | "error", text: string) => {
    setMessage({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function selectTab(tab: Tab) {
    setMessage(null);
    setVisited((v) => (v.includes(tab) ? v : [...v, tab]));
    setUi({ tab });
  }

  function requirePassword() {
    if (password) return true;
    notify("error", "Inserisci la password di conferma");
    return false;
  }

  function run(
    task: () => Promise<ActionResult>,
    successText: string,
    onSuccess?: () => void,
  ) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await task();
        if (!res.ok) {
          notify("error", res.error);
          return;
        }
        onSuccess?.();
        notify("ok", successText);
        router.refresh();
      } catch {
        notify("error", "Errore imprevisto");
      }
    });
  }

  function handleLogout() {
    if (
      dirty &&
      !confirm(
        "Hai modifiche non salvate: uscendo verranno cancellate. Continuare?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      await logout();
      files.releaseAll();
      setDraft(EMPTY_DRAFT);
      setPassword("");
      router.refresh();
    });
  }

  if (!ready) return <p className="text-gray-500">Caricamento…</p>;

  const tabProps = {
    draft,
    setDraft,
    pending,
    password,
    requirePassword,
    notify,
    files,
    run,
  };

  const panes: Record<Tab, ReactNode> = {
    sections: <SectionsTab {...tabProps} sections={sections} />,
    new: <NewArticleTab {...tabProps} sections={sections} articles={articles} />,
    media: <GalleryTab password={password} />,
    edit: (
      <EditArticlesTab {...tabProps} sections={sections} articles={articles} />
    ),
  };

  // ---------- Render ----------

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Admin</h1>
        <div className="flex items-end gap-3">
          <label className="text-sm">
            Password di conferma
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <button
            type="button"
            onClick={handleLogout}
            disabled={pending}
            className={btnGhostCls}
          >
            Esci
          </button>
        </div>
      </header>

      {message && (
        <p
          role="status"
          className={message.type === "ok" ? "text-green-700" : "text-red-600"}
        >
          {message.text}
        </p>
      )}

      {dirty && (
        <p className="text-sm text-amber-600">
          Le bozze di testo restano in questa scheda dopo il reload, non dopo la
          chiusura. Le immagini scelte dal computer non sopravvivono al reload.
        </p>
      )}

      <nav className="flex flex-wrap gap-2 border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={ui.tab === t.id}
            onClick={() => selectTab(t.id)}
            className={`px-4 py-2 -mb-px border-b-2 ${
              ui.tab === t.id
                ? "border-blue-600 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {TABS.map(({ id }) =>
        ui.tab === id || visited.includes(id) ? (
          <div key={id} role="tabpanel" hidden={ui.tab !== id}>
            {panes[id]}
          </div>
        ) : null,
      )}
    </div>
  );
}
