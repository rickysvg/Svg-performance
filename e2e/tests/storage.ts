import fs from "fs";
import path from "path";

/**
 * Playwright storageState for the QA test member.
 * Lives outside `results/` so the Actions upload (reports and screenshots only)
 * cannot publish the httpOnly session cookie. Gitignored via `/e2e/.auth`.
 */
export const STORAGE = path.resolve(__dirname, "../.auth/member.json");

export function prepareStorage() {
  fs.mkdirSync(path.dirname(STORAGE), { recursive: true });
}
