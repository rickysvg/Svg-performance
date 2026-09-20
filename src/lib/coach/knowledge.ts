import fs from "node:fs";
import path from "node:path";

const KB_DIR = path.join(process.cwd(), "content/coach-savage");

export function loadKnowledgeBase(): string {
  if (!fs.existsSync(KB_DIR)) {
    return "DEMO knowledge base folder is empty.";
  }
  const files = fs
    .readdirSync(KB_DIR)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort();
  if (files.length === 0) {
    return "DEMO knowledge base has no guide stubs yet.";
  }
  return files
    .map((name) => {
      const body = fs.readFileSync(path.join(KB_DIR, name), "utf8");
      return `## ${name}\n${body}`;
    })
    .join("\n\n");
}
