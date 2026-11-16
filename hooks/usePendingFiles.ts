"use client";

import { useMemo, useRef } from "react";

export type PendingFiles = {
  add: (file: File) => string;
  get: (blobUrl: string) => File | undefined;
  has: (blobUrl: string) => boolean;
  release: (blobUrl: string) => void;
  releaseAll: () => void;
};

export function usePendingFiles(): PendingFiles {
  const map = useRef(new Map<string, File>());

  return useMemo(
    () => ({
      add(file) {
        const url = URL.createObjectURL(file);
        map.current.set(url, file);
        return url;
      },
      get: (url) => map.current.get(url),
      has: (url) => map.current.has(url),
      release(url) {
        if (map.current.delete(url)) URL.revokeObjectURL(url);
      },
      releaseAll() {
        for (const url of map.current.keys()) URL.revokeObjectURL(url);
        map.current.clear();
      },
    }),
    [],
  );
}
