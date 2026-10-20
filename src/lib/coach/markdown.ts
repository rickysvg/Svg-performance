export type CoachInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type CoachListItem = {
  inlines: CoachInline[];
  children?: CoachBlock[];
};

export type CoachBlock =
  | { type: "paragraph"; inlines: CoachInline[] }
  | { type: "heading"; level: 2 | 3; inlines: CoachInline[] }
  | { type: "list"; ordered: boolean; start?: number; items: CoachListItem[] }
  | { type: "code"; text: string };

const SAFE_LINK = /^https?:\/\//i;
const NUMBERED = /^\s*(\d+)\.\s+/;
const BULLET = /^\s*[-*]\s+/;

/** Coach replies are markdown. Render tokens in React; never inject HTML. */
export function parseCoachMarkdown(source: string): CoachBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: CoachBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trimStart().startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      const marks = heading[1]?.length ?? 2;
      blocks.push({
        type: "heading",
        level: marks <= 2 ? 2 : 3,
        inlines: parseCoachInlines(heading[2] ?? ""),
      });
      index += 1;
      continue;
    }
    if (BULLET.test(line)) {
      const parsed = parseBulletList(lines, index);
      blocks.push(parsed.block);
      index = parsed.index;
      continue;
    }
    if (NUMBERED.test(line)) {
      const parsed = parseOrderedList(lines, index);
      blocks.push(parsed.block);
      index = parsed.index;
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() && !blockStart(lines[index] ?? "")) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", inlines: parseCoachInlines(paragraph.join(" ")) });
  }
  return blocks;
}

function parseOrderedList(lines: string[], startIndex: number) {
  const items: CoachListItem[] = [];
  let index = startIndex;
  const start = itemNumber(lines[index] ?? "");
  while (index < lines.length) {
    const current = lines[index] ?? "";
    if (!current.trim()) {
      const next = nextContent(lines, index + 1);
      if (next && (NUMBERED.test(next.line) || BULLET.test(next.line))) {
        index = next.index;
        continue;
      }
      break;
    }
    if (NUMBERED.test(current)) {
      items.push({ inlines: parseCoachInlines(current.replace(NUMBERED, "")) });
      index += 1;
      continue;
    }
    if (BULLET.test(current) && items.length > 0) {
      const nested = parseBulletList(lines, index);
      const last = items[items.length - 1]!;
      last.children = [...(last.children ?? []), nested.block];
      index = nested.index;
      continue;
    }
    break;
  }
  return {
    block: { type: "list" as const, ordered: true, start, items },
    index,
  };
}

function parseBulletList(lines: string[], startIndex: number) {
  const items: CoachListItem[] = [];
  let index = startIndex;
  while (index < lines.length && BULLET.test(lines[index] ?? "")) {
    items.push({ inlines: parseCoachInlines((lines[index] ?? "").replace(BULLET, "")) });
    index += 1;
  }
  return {
    block: { type: "list" as const, ordered: false, items },
    index,
  };
}

function nextContent(lines: string[], index: number) {
  let look = index;
  while (look < lines.length && !(lines[look] ?? "").trim()) look += 1;
  if (look >= lines.length) return null;
  return { index: look, line: lines[look] ?? "" };
}

function itemNumber(line: string) {
  const value = Number(NUMBERED.exec(line)?.[1] ?? "1");
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function blockStart(line: string) {
  return /^(```|#{1,3}\s+)/.test(line.trim()) || BULLET.test(line) || NUMBERED.test(line);
}

export function parseCoachInlines(input: string): CoachInline[] {
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__(?:(?!__).)+__)|(\*[^*\n]+\*)|(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const out: CoachInline[] = [];
  let last = 0;
  for (const match of input.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ type: "text", text: input.slice(last, at) });
    const token = match[0];
    if (token.startsWith("`")) out.push({ type: "code", text: token.slice(1, -1) });
    else if (token.startsWith("**") || token.startsWith("__")) {
      out.push({ type: "strong", text: token.slice(2, -2) });
    } else if (token.startsWith("*")) out.push({ type: "em", text: token.slice(1, -1) });
    else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (link && SAFE_LINK.test(link[2] ?? "")) {
        out.push({ type: "link", text: link[1] ?? "", href: link[2] ?? "" });
      } else out.push({ type: "text", text: token });
    }
    last = at + token.length;
  }
  if (last < input.length) out.push({ type: "text", text: input.slice(last) });
  return out.filter((part) => part.type !== "text" || part.text.length > 0);
}
