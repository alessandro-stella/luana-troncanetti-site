"use client";

import { useEffect } from "react";
import type { MediaItem } from "@/lib/types";
import MediaGrid from "./MediaGrid";
import { useMediaList } from "./useMediaList";
import { btnGhostCls } from "./shared";

type Props = {
  onPick: (item: MediaItem) => void;
  onClose: () => void;
};

export default function MediaPickerModal({ onPick, onClose }: Props) {
  const list = useMediaList();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scegli un'immagine dalla galleria"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-4xl space-y-4 overflow-auto rounded bg-white p-6 text-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Scegli un&apos;immagine</h2>
          <button type="button" className={btnGhostCls} onClick={onClose}>
            Chiudi
          </button>
        </div>

        {list.error && <p className="text-sm text-red-600">{list.error}</p>}

        {!list.loading && list.items.length === 0 && !list.error && (
          <p className="text-gray-500">
            La galleria è vuota. Carica le immagini dalla sezione Galleria.
          </p>
        )}

        <MediaGrid items={list.items} onPick={onPick} />

        {list.loading && <p className="text-gray-500">Caricamento…</p>}

        {list.hasMore && !list.loading && (
          <button type="button" className={btnGhostCls} onClick={list.loadMore}>
            Mostra altre
          </button>
        )}
      </div>
    </div>
  );
}
