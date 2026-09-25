"use client";

import { useState } from "react";
import Link from "next/link";

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
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent text-2xl font-semibold leading-none text-black"
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}
