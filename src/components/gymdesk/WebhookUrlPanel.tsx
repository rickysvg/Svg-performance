"use client";

import { CopyButton } from "@/components/gymdesk/CopyButton";

export function WebhookUrlPanel({
  urls,
  secretConfigured,
}: {
  urls: { event: string; label: string; url: string }[];
  secretConfigured: boolean;
}) {
  return (
    <section id="webhooks" className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg">Gymdesk webhook URLs</h2>
      <p className="text-sm text-muted">
        Paste one URL per Marketing Automation “Send Webhook” step. The app never writes to
        Gymdesk. Secret is shown only here.
      </p>
      {!secretConfigured ? (
        <p className="text-sm text-danger">
          GYMDESK_WEBHOOK_SECRET is missing. URLs below use a placeholder.
        </p>
      ) : null}
      <ul className="space-y-3">
        {urls.map((row) => (
          <li key={row.event} className="rounded-xl border border-line bg-background p-3">
            <p className="text-sm font-medium">{row.label}</p>
            <p className="mt-1 break-all font-mono text-xs">{row.url}</p>
            <div className="mt-2">
              <CopyButton value={row.url} label="Copy URL" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
