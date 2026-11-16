"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSelectionAnchor, type Anchor } from "@/lib/admin/caret";
import { toggleMark, type Mark } from "@/lib/admin/markdownFormat";
import { inputCls } from "@/lib/admin/shared";

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
};

const BUTTONS: { mark: Mark; label: ReactNode; title: string }[] = [
  { mark: "bold", label: <strong>B</strong>, title: "Grassetto (Ctrl+B)" },
  { mark: "italic", label: <em>I</em>, title: "Corsivo (Ctrl+I)" },
  { mark: "underline", label: <u>U</u>, title: "Sottolineato (Ctrl+U)" },
  { mark: "strike", label: <s>S</s>, title: "Barrato" },
];

const SHORTCUTS: Record<string, Mark> = {
  b: "bold",
  i: "italic",
  u: "underline",
};

const HINT =
  "**grassetto** · *corsivo* · ~~barrato~~ · ++sottolineato++ · [testo](https://…) · - elenco · > citazione · riga vuota = nuovo paragrafo";

export default function MarkdownField({
  value,
  onChange,
  rows = 8,
  placeholder,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<{ start: number; end: number } | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // ---------- Toolbar position ----------

  const refresh = useCallback(() => {
    const el = ref.current;
    if (
      !el ||
      document.activeElement !== el ||
      el.selectionStart === el.selectionEnd
    ) {
      setAnchor(null);
      return;
    }
    setAnchor(getSelectionAnchor(el));
  }, []);

  // ---------- Formatting ----------

  const apply = useCallback(
    (mark: Mark) => {
      const el = ref.current;
      if (!el) return;

      const edit = toggleMark(
        el.value,
        el.selectionStart,
        el.selectionEnd,
        mark,
      );
      if (edit.value === el.value) return;

      pending.current = { start: edit.start, end: edit.end };
      onChange(edit.value);
    },
    [onChange],
  );

  useEffect(() => {
    const el = ref.current;
    const selection = pending.current;
    if (!el || !selection) return;

    pending.current = null;
    el.focus();
    el.setSelectionRange(selection.start, selection.end);
    requestAnimationFrame(refresh);
  }, [value, refresh]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    const mark = SHORTCUTS[e.key.toLowerCase()];
    if (!mark) return;
    e.preventDefault();
    apply(mark);
  }

  // ---------- Render ----------

  const left = anchor
    ? Math.min(Math.max(anchor.left, 80), Math.max(anchor.width - 80, 80))
    : 0;

  return (
    <div className="space-y-1">
      <div className="relative">
        {anchor && (
          <div
            role="toolbar"
            aria-label="Formattazione del testo"
            className="absolute z-10 flex gap-1 rounded border bg-white p-1 text-gray-900 shadow"
            style={{
              top: anchor.top - 44,
              left,
              transform: "translateX(-50%)",
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {BUTTONS.map((b) => (
              <button
                key={b.mark}
                type="button"
                title={b.title}
                aria-label={b.title}
                onClick={() => apply(b.mark)}
                className="h-8 w-8 rounded hover:bg-gray-200"
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={ref}
          className={`${inputCls} leading-relaxed`}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={refresh}
          onKeyUp={refresh}
          onMouseUp={refresh}
          onScroll={refresh}
          onBlur={() => setAnchor(null)}
          onKeyDown={onKeyDown}
        />
      </div>

      <p className="text-xs text-gray-500">{HINT}</p>
    </div>
  );
}
