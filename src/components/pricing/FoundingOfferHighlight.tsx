"use client";

import { createContext, useContext } from "react";

const FoundingOfferContext = createContext<string | null>(null);

export function FoundingOfferProvider({
  line,
  children,
}: {
  line: string | null;
  children: React.ReactNode;
}) {
  return <FoundingOfferContext.Provider value={line}>{children}</FoundingOfferContext.Provider>;
}

export function useFoundingOfferLine() {
  return useContext(FoundingOfferContext);
}

/** Lime founding line. Pass `line` outside the member shell; otherwise the provider supplies it. */
export function FoundingOfferHighlight({
  line,
  marker = "offer",
  className = "mt-3",
}: {
  line?: string | null;
  marker?: "price" | "offer";
  className?: string;
}) {
  const fromContext = useFoundingOfferLine();
  const text = line === undefined ? fromContext : line;
  if (!text) return null;
  const data = marker === "price" ? { "data-founding-price": "" } : { "data-founding-offer": "" };
  return (
    <p
      {...data}
      className={`rounded-xl bg-accent px-3 py-2 text-sm font-semibold leading-snug text-black ${className}`}
    >
      {text}
    </p>
  );
}
