"use client";

import { useCallback, useEffect, useState } from "react";

export function useSessionDraft<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) setValue({ ...initial, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, [key, initial]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, ready]);

  const clear = useCallback(() => setValue(initial), [initial]);

  return { value, setValue, clear, ready } as const;
}
