"use client";

import { useState } from "react";
import Link from "next/link";

function PlusGlyph() {
  return (
    <svg
      data-plus-glyph
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden
      className="block"
    >
      <rect x="7" y="2.5" width="2" height="11" rx="1" fill="currentColor" />
      <rect x="2.5" y="7" width="11" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <rect
        x="2.5"
        y="7"
        width="11"
        height="2"
        rx="1"
        fill="currentColor"
        transform="rotate(45 8 8)"
      />
      <rect
        x="2.5"
        y="7"
        width="11"
        height="2"
        rx="1"
        fill="currentColor"
        transform="rotate(-45 8 8)"
      />
    </svg>
  );
}

export function QuickAddFab() {
  const [open, setOpen] = useState(false);

  return (
    <div
      data-quick-add-fab
      className="pointer-events-none absolute bottom-0 left-14 top-0 z-30 flex items-center"
    >
      {open ? (
        <div className="pointer-events-auto absolute bottom-full left-0 mb-2 w-52 overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
          <Link
            href="/training"
            className="block border-b border-line px-4 py-3 text-sm hover:bg-accent/10"
            onClick={() => setOpen(false)}
          >
            Log workout
          </Link>
          <Link
            href="/nutrition"
            className="block border-b border-line px-4 py-3 text-sm hover:bg-accent/10"
            onClick={() => setOpen(false)}
          >
            Log food
          </Link>
          <Link
            href="/progress"
            className="block border-b border-line px-4 py-3 text-sm hover:bg-accent/10"
            onClick={() => setOpen(false)}
          >
            Log metric or photo
          </Link>
          <Link
            href="/heart"
            className="block px-4 py-3 text-sm hover:bg-accent/10"
            onClick={() => setOpen(false)}
          >
            Log heart rate
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close quick add" : "Quick add"}
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent p-0 text-black"
      >
        {open ? <CloseGlyph /> : <PlusGlyph />}
      </button>
    </div>
  );
}
