"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions";
import { useSessionDraft } from "./useSessionDraft";
import SectionsTab from "./SectionsTab";
import ArticlesTab from "./ArticlesTab";
import {
  DRAFT_KEY,
  EMPTY_DRAFT,
  EMPTY_UI,
  UI_KEY,
  btnGhostCls,
  inputCls,
  type ActionResult,
  type ArticleItem,
  type Draft,
  type SectionItem,
  type Tab,
  type UiState,
} from "./shared";

const TABS: { id: Tab; label: string }[] = [
  { id: "sections", label: "Sezioni" },
  { id: "articles", label: "Articoli" },
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
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

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
  const dirty = ready && JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function selectTab(tab: Tab) {
    setMessage(null);
    setUi({ tab });
  }

  function requirePassword() {
    if (password) return true;
    setMessage({ type: "error", text: "Inserisci la password di conferma" });
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
          setMessage({ type: "error", text: res.error });
          return;
        }
        onSuccess?.();
        setMessage({ type: "ok", text: successText });
        router.refresh();
      } catch {
        setMessage({ type: "error", text: "Errore imprevisto" });
      }
    });
  }

  function handleLogout() {
    if (
      dirty &&
      !confirm(
        "Hai una bozza non salvata: uscendo verrà cancellata. Continuare?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      await logout();
      setDraft(EMPTY_DRAFT);
      setPassword("");
      router.refresh();
    });
  }

  if (!ready) return <p className="text-gray-500">Caricamento…</p>;

  const tabProps = { draft, setDraft, pending, password, requirePassword, run };

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
          Bozza locale salvata in questa scheda: sopravvive al reload, non alla
          chiusura.
        </p>
      )}

      <nav className="flex gap-2 border-b" role="tablist">
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

      {ui.tab === "sections" ? (
        <SectionsTab {...tabProps} sections={sections} />
      ) : (
        <ArticlesTab {...tabProps} sections={sections} articles={articles} />
      )}
    </div>
  );
}
