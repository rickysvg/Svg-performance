import type { GymdeskStatus } from "@/lib/gymdesk/config";

export type StatusMapResult = {
  status: GymdeskStatus | "unknown";
  activeLike: boolean;
};

export function mapGymdeskStatus(raw: string): StatusMapResult {
  const value = raw.trim().toLowerCase();
  if (!value) return { status: "unknown", activeLike: false };
  if (value === "active" || value === "member" || value.includes("active member")) {
    return { status: "active", activeLike: true };
  }
  if (value === "frozen" || value === "freeze" || value.includes("frozen")) {
    return { status: "frozen", activeLike: true };
  }
  if (
    value === "canceled" ||
    value === "cancelled" ||
    value === "expired" ||
    value.includes("cancel") ||
    value.includes("expir")
  ) {
    return { status: "canceled", activeLike: false };
  }
  if (value === "visitor" || value === "trial" || value.includes("visitor")) {
    return { status: "visitor", activeLike: false };
  }
  if (
    value === "pending" ||
    value === "website signup" ||
    value.includes("website signup") ||
    value.includes("pending")
  ) {
    return { status: "pending", activeLike: false };
  }
  return { status: "unknown", activeLike: false };
}

export function statusFromWebhookEvent(event: string): GymdeskStatus {
  if (event === "frozen") return "frozen";
  if (event === "canceled" || event === "expired") return "canceled";
  return "active";
}
