"use client";

/* eslint-disable @next/next/no-img-element */

import { thumbUrl } from "@/lib/media-shared";
import type { MediaItem } from "@/lib/types";
import { btnGhostCls } from "./shared";

type Props = {
  items: MediaItem[];
  onPick?: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
  busy?: boolean;
};

export default function MediaGrid({
  items,
  onPick,
  onDelete,
  busy = false,
}: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => {
        const thumb = (
          <img
            src={thumbUrl(item.url)}
            alt=""
            width={240}
            height={240}
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
        );

        return (
          <li key={item.id} className="space-y-1">
            {onPick ? (
              <button
                type="button"
                onClick={() => onPick(item)}
                className="block w-full overflow-hidden rounded border hover:border-blue-500"
              >
                {thumb}
              </button>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded border hover:border-blue-500"
              >
                {thumb}
              </a>
            )}

            {onDelete && (
              <button
                type="button"
                disabled={busy}
                className={btnGhostCls}
                onClick={() => onDelete(item)}
              >
                Elimina
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
