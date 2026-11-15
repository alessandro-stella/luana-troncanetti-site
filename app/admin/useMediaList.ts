"use client";

import { useCallback, useEffect, useState } from "react";
import { listMedia } from "@/lib/media-actions";
import type { MediaItem } from "@/lib/types";

export function useMediaList() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await listMedia();
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
        } else {
          setItems(res.items);
          setCursor(res.nextCursor);
        }
      } catch {
        if (!cancelled) setError("Errore imprevisto");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listMedia(cursor);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch {
      setError("Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  const prepend = useCallback((added: MediaItem[]) => {
    setItems((prev) => {
      const ids = new Set(added.map((m) => m.id));
      return [...added, ...prev.filter((m) => !ids.has(m.id))];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return {
    items,
    loading,
    error,
    hasMore: cursor !== null,
    loadMore,
    prepend,
    remove,
  };
}
