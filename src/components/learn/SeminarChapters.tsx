"use client";

import { useState } from "react";
import { formatTimestamp } from "@/lib/seminar-playback";
import { useSeminarPlayback } from "@/components/learn/SeminarPlayer";

function PlayGlyph() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-black" aria-hidden>
      <svg viewBox="0 0 12 12" className="ml-0.5 h-3 w-3">
        <path d="M3 2.2v7.6L10 6z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function SeminarChapters() {
  const { model, activeClipId, activeChapterStart, playClip, playChapter, watchUrl } =
    useSeminarPlayback();
  const [chaptersOpen, setChaptersOpen] = useState(model.clips.length === 0);

  return (
    <div className="space-y-6">
      {model.clips.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted">Techniques</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {model.clips.map((clip) => {
              const active = clip.id === activeClipId;
              return (
                <li key={clip.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => playClip(clip)}
                    className={`flex min-h-11 w-full items-center gap-3 border-l-4 px-3 py-2 text-left ${
                      active ? "border-accent bg-black" : "border-transparent"
                    }`}
                  >
                    <span className="shrink-0 rounded-full bg-accent px-2 py-1 text-xs text-black">
                      {formatTimestamp(clip.startSeconds)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${active ? "text-white" : ""}`}>
                        {clip.technique}
                      </span>
                      <span className={`mt-0.5 block text-xs ${active ? "text-white/70" : "text-muted"}`}>
                        {clip.notes}
                      </span>
                    </span>
                    <PlayGlyph />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {model.chapters.length > 0 ? (
        <section>
          <details
            open={chaptersOpen}
            onToggle={(event) => setChaptersOpen(event.currentTarget.open)}
            className="rounded-2xl border border-line"
          >
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm">
              Chapters
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {model.chapters.map((chapter) => {
                const active =
                  activeClipId == null && activeChapterStart === chapter.startSeconds;
                return (
                  <li key={`${chapter.startSeconds}-${chapter.label}`}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => playChapter(chapter.startSeconds)}
                      className={`flex min-h-11 w-full items-center gap-3 border-l-4 px-3 py-2 text-left ${
                        active ? "border-accent bg-black text-white" : "border-transparent"
                      }`}
                    >
                      <span className="w-16 shrink-0 text-sm tabular-nums">{chapter.timestamp}</span>
                      <span className="text-sm">{chapter.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        </section>
      ) : null}

      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="touch-target inline-flex items-center rounded-full border border-line px-5 text-sm"
      >
        Watch on YouTube
      </a>
    </div>
  );
}
