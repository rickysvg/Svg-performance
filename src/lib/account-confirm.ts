export function isDeleteConfirmation(input: string, email: string) {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return trimmed === "DELETE" || trimmed.toLowerCase() === email.trim().toLowerCase();
}

export function accountExportFilename(date = new Date()) {
  return `svg-performance-data-${date.toISOString().slice(0, 10)}.json`;
}
