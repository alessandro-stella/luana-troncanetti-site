"use client";

import { createSection, deleteSection } from "@/lib/actions";
import {
  EMPTY_DRAFT,
  btnCls,
  btnGhostCls,
  inputCls,
  type Draft,
  type SectionItem,
  type TabProps,
} from "./shared";

type Props = TabProps & { sections: SectionItem[] };

export default function SectionsTab({
  sections,
  draft,
  setDraft,
  pending,
  password,
  requirePassword,
  run,
}: Props) {
  const s = draft.section;

  const setSection = (patch: Partial<Draft["section"]>) =>
    setDraft((d) => ({ ...d, section: { ...d.section, ...patch } }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requirePassword()) return;
    run(
      () =>
        createSection(password, {
          name: s.name,
          slug: s.slug,
          description: s.description,
        }),
      "Sezione creata",
      () => setSection(EMPTY_DRAFT.section),
    );
  }

  function remove(section: SectionItem) {
    if (!confirm(`Eliminare la sezione "${section.name}"?`)) return;
    if (!requirePassword()) return;
    run(() => deleteSection(password, section.id), "Sezione eliminata");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Nuova sezione</h2>

      <form onSubmit={submit} className="space-y-3">
        <input
          className={inputCls}
          placeholder="Nome"
          value={s.name}
          onChange={(e) => setSection({ name: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="slug (es. racconti-brevi)"
          value={s.slug}
          onChange={(e) => setSection({ slug: e.target.value })}
        />
        <textarea
          className={inputCls}
          rows={2}
          placeholder="Descrizione (facoltativa)"
          value={s.description}
          onChange={(e) => setSection({ description: e.target.value })}
        />
        <button type="submit" disabled={pending} className={btnCls}>
          Crea sezione
        </button>
      </form>

      <h2 className="text-2xl font-semibold">Sezioni esistenti</h2>

      {sections.length === 0 ? (
        <p className="text-gray-500">Nessuna sezione.</p>
      ) : (
        <ul className="divide-y border rounded">
          {sections.map((section) => (
            <li
              key={section.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <span>
                {section.name}{" "}
                <span className="text-gray-500">/{section.slug}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                className={btnGhostCls}
                onClick={() => remove(section)}
              >
                Elimina
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
