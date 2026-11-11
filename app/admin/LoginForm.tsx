"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/actions";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await login(password);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setPassword("");
        router.refresh();
      } catch {
        setError("Errore imprevisto");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Accesso</h1>

      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full border rounded px-3 py-2"
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending || !password}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        {pending ? "Verifica…" : "Entra"}
      </button>
    </form>
  );
}
