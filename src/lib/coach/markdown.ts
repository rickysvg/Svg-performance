export type CoachInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type CoachBlock =
  | { type: "paragraph"; inlines: CoachInline[] }
  | { type: "heading"; level: 2 | 3; inlines: CoachInline[] }
  | { type: "list"; ordered: boolean; items: CoachInline[][] }
  | { type: "code"; text: string };

const SAFE_LINK = /^https?:\/\//i;

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
    if (/^\s*[-*]\s+/.test(line)) {
      const items: CoachInline[][] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push(parseCoachInlines((lines[index] ?? "").replace(/^\s*[-*]\s+/, "")));
        index += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: CoachInline[][] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        if (!current.trim()) {
          let look = index + 1;
          while (look < lines.length && !(lines[look] ?? "").trim()) look += 1;
          if (look < lines.length && /^\s*\d+\.\s+/.test(lines[look] ?? "")) {
            index = look;
            continue;
          }
          break;
        }
        if (!/^\s*\d+\.\s+/.test(current)) break;
        items.push(parseCoachInlines(current.replace(/^\s*\d+\.\s+/, "")));
        index += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
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

function blockStart(line: string) {
  return /^(```|#{1,3}\s+)/.test(line.trim()) || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
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
