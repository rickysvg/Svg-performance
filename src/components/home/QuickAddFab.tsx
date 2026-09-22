"use client";

import { useState } from "react";
import Link from "next/link";

export function QuickAddFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed right-4 bottom-24 z-30 sm:right-8">
      {open ? (
        <div className="pointer-events-auto mb-3 w-52 overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
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
            className="block px-4 py-3 text-sm hover:bg-accent/10"
            onClick={() => setOpen(false)}
          >
            Log metric or photo
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close quick add" : "Quick add"}
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-semibold text-black shadow-lg"
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}
