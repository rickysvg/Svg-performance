import fs from "node:fs";
import path from "node:path";
import type { QuestionType } from "@/lib/coach/router";

const KB_DIR = path.join(process.cwd(), "content/coach-savage");
const EXPERT_DIR = path.join(process.cwd(), "content/coach-kb");
const CORE_FILES = ["COACHING_GUIDE.md", "safety.md"];
/** Retrieved notes stay near 2k tokens. Core guide is separate. */
const RETRIEVAL_CHAR_BUDGET = 8000;
const RETRIEVAL_MAX_DOCS = 5;
const RETRIEVAL_MIN_DOCS = 3;

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
    return "Knowledge base folder is empty.";
  }
  return files
    .map((name) => {
      const body = readFileSafe(name) ?? "";
      return `## ${name}\n${body}`;
    })
    .join("\n\n");
}

export function loadCoreKnowledge(): string {
  return CORE_FILES.map((name) => {
    const body = readFileSafe(name);
    if (!body) return "";
    return `## ${name}\n${body}`;
  })
    .filter(Boolean)
    .join("\n\n");
}

type KbDoc = {
  id: string;
  art: string[];
  type: string[];
  level: string[];
  body: string;
  haystack: string;
};

const STOP = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "around",
  "before",
  "can",
  "does",
  "during",
  "for",
  "from",
  "have",
  "how",
  "into",
  "just",
  "not",
  "off",
  "out",
  "should",
  "that",
  "the",
  "them",
  "then",
  "there",
  "they",
  "this",
  "under",
  "what",
  "when",
  "where",
  "with",
  "without",
  "would",
  "your",
  "but",
  "its",
  "his",
  "her",
  "was",
  "has",
  "had",
  "did",
  "any",
  "all",
  "per",
  "via",
  "you",
]);

let docCache: KbDoc[] | null = null;

function parseList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function parseFrontmatter(raw: string) {
  if (!raw.startsWith("---")) return { meta: {} as Record<string, string>, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { meta: {} as Record<string, string>, body: raw };
  const meta: Record<string, string> = {};
  for (const line of raw.slice(3, end).split("\n")) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    meta[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return { meta, body: raw.slice(end + 4).replace(/^\n/, "") };
}

function walkMarkdown(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkMarkdown(full, rel));
    else if (entry.name.endsWith(".md")) found.push(rel);
  }
  return found;
}

export function listExpertKnowledgeFiles(): string[] {
  return walkMarkdown(EXPERT_DIR).sort();
}

export function loadExpertDocs(): KbDoc[] {
  if (docCache) return docCache;
  docCache = listExpertKnowledgeFiles().map((rel) => {
    const raw = fs.readFileSync(path.join(EXPERT_DIR, rel), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const art = parseList(meta.art);
    const type = parseList(meta.type);
    const level = parseList(meta.level);
    return {
      id: rel,
      art: art.length ? art : ["all"],
      type: type.length ? type : ["general"],
      level: level.length ? level : ["all"],
      body: body.trim(),
      haystack: `${rel} ${art.join(" ")} ${type.join(" ")} ${body}`.toLowerCase(),
    };
  });
  return docCache;
}

export function clearExpertDocCache() {
  docCache = null;
}

function keywords(message: string) {
  return [
    ...new Set(
      message
        .toLowerCase()
        .split(/[^a-z0-9+]+/)
        .filter((word) => word.length >= 3 && !STOP.has(word)),
    ),
  ];
}

export type KnowledgeQuery = {
  primary: QuestionType;
  secondary?: QuestionType[];
  art?: string;
  message?: string;
  level?: string;
};

export function rankExpertDocs(query: KnowledgeQuery) {
  const words = keywords(query.message ?? "");
  const level = (query.level || "").toLowerCase();
  return loadExpertDocs()
    .map((doc) => {
      let score = 0;
      const typeHit = doc.type.includes(query.primary) || doc.type.includes("all");
      if (typeHit) score += 6;
      else score -= 3;
      for (const extra of query.secondary ?? []) {
        if (doc.type.includes(extra)) score += 3;
      }
      if (query.art) {
        const artHit = doc.art.includes(query.art.toLowerCase());
        if (artHit && typeHit) score += 5;
        else if (artHit || doc.art.includes("all")) score += 1;
        else if (!doc.art.includes("general")) score -= 2;
      } else if (doc.art.includes("all")) {
        score += 1;
      }
      if (doc.level.includes("all") || (level && doc.level.includes(level))) score += 1;
      let hits = 0;
      for (const word of words) {
        const pattern = new RegExp(`\\b${word}s?\\b`, "i");
        if (pattern.test(doc.haystack)) hits += 1;
      }
      score += Math.min(8, hits);
      return { doc, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
}

export function retrieveCoachKnowledge(query: KnowledgeQuery): string {
  const ranked = rankExpertDocs(query);
  const picked: KbDoc[] = [];
  let chars = 0;
  for (const row of ranked) {
    if (picked.length >= RETRIEVAL_MAX_DOCS) break;
    const room = RETRIEVAL_CHAR_BUDGET - chars;
    if (room < 400 && picked.length >= RETRIEVAL_MIN_DOCS) break;
    const body = row.doc.body.length > room ? row.doc.body.slice(0, room) : row.doc.body;
    if (!body.trim()) continue;
    picked.push({ ...row.doc, body });
    chars += body.length;
    if (chars >= RETRIEVAL_CHAR_BUDGET) break;
  }
  if (picked.length === 0) return "";
  return picked.map((doc) => `## coach-kb/${doc.id}\n${doc.body}`).join("\n\n");
}
