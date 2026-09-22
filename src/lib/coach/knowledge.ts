import fs from "node:fs";
import path from "node:path";

const KB_DIR = path.join(process.cwd(), "content/coach-savage");

const EXCLUDE = new Set(["README.md", "INTERVIEW.md"]);
const PREFERRED = [
  "COACHING_GUIDE.md",
  "DEMO-seeds.md",
  "safety.md",
  "principles.md",
  "beginner.md",
];

function readFileSafe(name: string) {
  const full = path.join(KB_DIR, name);
  if (!fs.existsSync(full)) {
    return null;
  }
  return fs.readFileSync(full, "utf8");
}

export function listRuntimeKnowledgeFiles(): string[] {
  if (!fs.existsSync(KB_DIR)) {
    return [];
  }
  const onDisk = fs
    .readdirSync(KB_DIR)
    .filter((name) => name.endsWith(".md") && !EXCLUDE.has(name));
  const preferred = PREFERRED.filter((name) => onDisk.includes(name));
  const rest = onDisk
    .filter((name) => !PREFERRED.includes(name))
    .sort();
  return [...preferred, ...rest];
}

export function loadKnowledgeBase(): string {
  const files = listRuntimeKnowledgeFiles();
  if (files.length === 0) {
    return "DEMO knowledge base folder is empty.";
  }
  return files
    .map((name) => {
      const body = readFileSafe(name) ?? "";
      return `## ${name}\n${body}`;
    })
    .join("\n\n");
}
