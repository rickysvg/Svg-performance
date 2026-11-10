"use client";

import { useState } from "react";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid="copy-access-code"
      className="min-h-11 rounded-full border border-[#2a3124] px-4 text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          const area = document.createElement("textarea");
          area.value = code;
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }
        setCopied(true);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
