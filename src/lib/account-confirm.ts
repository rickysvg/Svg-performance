import { dayKey } from "@/lib/timezone";

export function isDeleteConfirmation(input: string, email: string) {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return trimmed === "DELETE" || trimmed.toLowerCase() === email.trim().toLowerCase();
}

export function accountExportFilename(date = new Date(), timeZone = "UTC") {
  return `svg-performance-data-${dayKey(date, timeZone)}.json`;
}
