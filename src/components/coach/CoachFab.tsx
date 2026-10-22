"use client";

import Link from "next/link";
import { useEffect } from "react";

export function CoachFab({
  name,
  thumb,
  raised = false,
  locked = false,
}: {
  name: string;
  thumb: string;
  raised?: boolean;
  locked?: boolean;
}) {
  useEffect(() => {
    let timer = 0;
    const onScroll = () => {
      document.documentElement.dataset.coachScrolling = "1";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        delete document.documentElement.dataset.coachScrolling;
      }, 220);
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.clearTimeout(timer);
      delete document.documentElement.dataset.coachScrolling;
    };
  }, []);

  return (
    <Link
      href="/coach"
      data-coach-fab
      data-coach-fab-raised={raised ? "" : undefined}
      data-coach-fab-locked={locked ? "1" : undefined}
      aria-label={
        locked
          ? `SVG Coach chat is in Pro. Your coach is ${name}.`
          : `Open SVG Coach. Your coach is ${name}.`
      }
      className="coach-fab"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt="" width={96} height={96} className="coach-fab-photo" />
      {locked ? (
        <span
          aria-hidden
          className="absolute -right-1 -bottom-1 rounded-full bg-black px-1 text-[8px] font-bold uppercase leading-4 text-[#CBF805] ring-1 ring-[#CBF805]"
        >
          Pro
        </span>
      ) : null}
    </Link>
  );
}
