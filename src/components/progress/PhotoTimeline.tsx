"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteProgressPhotoAction } from "@/app/actions/body-metrics";

export type TimelinePhoto = {
  id: string;
  src: string;
  dateLabel: string;
  caption: string;
};

export function PhotoTimeline({ photos }: { photos: TimelinePhoto[] }) {
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(id: string) {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  const compareHref =
    picked.length === 2 ? `/progress/photos?a=${picked[0]}&b=${picked[1]}` : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Pick two dates to compare.</p>
        {compareHref ? (
          <Link
            href={compareHref}
            className="inline-flex min-h-11 items-center rounded-full bg-[#CBF805] px-4 text-sm text-black"
          >
            Compare
          </Link>
        ) : null}
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {photos.map((photo) => {
          const selected = picked.indexOf(photo.id);
          return (
            <li key={photo.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              <button
                type="button"
                onClick={() => toggle(photo.id)}
                aria-pressed={selected >= 0}
                className="block w-full text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.caption || `Progress photo ${photo.dateLabel}`}
                  className="aspect-square w-full object-cover"
                />
                <span className="flex items-center justify-between gap-2 px-2 py-2">
                  <span className="text-sm font-semibold">{photo.dateLabel}</span>
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                      selected >= 0 ? "bg-[#CBF805] text-black" : "bg-black/10 text-muted"
                    }`}
                  >
                    {selected >= 0 ? selected + 1 : "Pick"}
                  </span>
                </span>
              </button>
              <form action={deleteProgressPhotoAction}>
                <input type="hidden" name="photoId" value={photo.id} />
                <input type="hidden" name="next" value="/progress/photos" />
                <button type="submit" className="min-h-11 w-full border-t border-line text-sm text-danger">
                  Delete
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
