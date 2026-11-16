"use client";

import { useMemo, useState } from "react";
import {
  btnGhostCls,
  inputCls,
  type ArticleItem,
  type SectionItem,
} from "@/lib/admin/shared";

type Props = {
  articles: ArticleItem[];
  sections: SectionItem[];
  selected: string[];
  onToggle: (id: string) => void;
  max?: number;
};

export default function RelatedPicker({
  articles,
  sections,
  selected,
  onToggle,
  max = 10,
}: Props) {
  const [sectionSlug, setSectionSlug] = useState("");
  const [query, setQuery] = useState("");

  const byId = useMemo(
    () => new Map(articles.map((a) => [a.id, a])),
    [articles],
  );
  const q = query.trim().toLowerCase();
  const filtering = sectionSlug !== "" || q !== "";
  const full = selected.length >= max;

  const results = useMemo(
    () =>
      filtering
        ? articles.filter(
            (a) =>
              (!sectionSlug || a.sectionSlug === sectionSlug) &&
              (!q || a.title.toLowerCase().includes(q)),
          )
        : [],
    [articles, sectionSlug, q, filtering],
  );

  return (
    <fieldset className="space-y-3 border rounded p-3">
      <legend className="px-1 text-sm text-gray-500">
        Vedi anche ({selected.length}/{max})
      </legend>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const a = byId.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
              >
                <span>
                  {a ? a.title : "Articolo non trovato"}
                  {a && (
                    <span className="text-gray-500"> · {a.sectionName}</span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Rimuovi ${a?.title ?? "articolo"} dai collegati`}
                  className="text-gray-500 hover:text-red-600"
                  onClick={() => onToggle(id)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className={inputCls}
          value={sectionSlug}
          onChange={(e) => setSectionSlug(e.target.value)}
          aria-label="Sezione degli articoli da collegare"
        >
          <option value="">— scegli la sezione —</option>
          {sections.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className={inputCls}
          placeholder="Cerca per titolo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!filtering ? (
        <p className="text-sm text-gray-500">
          Scegli una sezione o cerca per titolo per vedere gli articoli.
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun articolo trovato.</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-auto">
          {results.map((a) => {
            const checked = selected.includes(a.id);
            return (
              <li key={a.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => onToggle(a.id)}
                  />
                  <span>
                    {a.title}{" "}
                    <span className="text-gray-500">
                      ({a.sectionName}
                      {a.status !== "published" ? ", bozza" : ""})
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {full && (
        <p className="text-xs text-amber-600">
          Hai raggiunto il massimo di {max} articoli collegati.
        </p>
      )}

      <p className="text-xs text-gray-500">
        Le bozze compaiono in Vedi anche solo dopo essere state pubblicate.
      </p>

      {selected.length > 0 && (
        <button
          type="button"
          className={btnGhostCls}
          onClick={() => selected.forEach((id) => onToggle(id))}
        >
          Rimuovi tutti
        </button>
      )}
    </fieldset>
  );
}
