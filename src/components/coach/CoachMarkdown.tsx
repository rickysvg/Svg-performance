import { parseCoachMarkdown, type CoachInline } from "@/lib/coach/markdown";

function InlineRun({ inlines }: { inlines: CoachInline[] }) {
  return (
    <>
      {inlines.map((part, index) => {
        if (part.type === "strong") return <strong key={index}>{part.text}</strong>;
        if (part.type === "em") return <em key={index}>{part.text}</em>;
        if (part.type === "code") {
          return (
            <code key={index} className="rounded bg-background px-1 py-0.5 text-[0.85em]">
              {part.text}
            </code>
          );
        }
        if (part.type === "link") {
          return (
            <a
              key={index}
              href={part.href}
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {part.text}
            </a>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

export function CoachMarkdown({ text }: { text: string }) {
  const blocks = parseCoachMarkdown(text);
  if (blocks.length === 0) return null;
  return (
    <div className="mt-2 space-y-2" data-coach-markdown>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = block.level === 2 ? "h3" : "h4";
          return (
            <Tag key={index} className="font-display text-base uppercase leading-tight">
              <InlineRun inlines={block.inlines} />
            </Tag>
          );
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index} className={`space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineRun inlines={item} />
                </li>
              ))}
            </Tag>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={index} className="overflow-x-auto rounded-xl bg-background p-3 text-xs">
              <code>{block.text}</code>
            </pre>
          );
        }
        return (
          <p key={index}>
            <InlineRun inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
