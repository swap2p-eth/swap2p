import * as React from "react";

type MarkdownBlock =
  | { type: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; content: string }
  | { type: "paragraph"; content: string }
  | { type: "list"; items: string[] }
  | { type: "hr" };

type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: InlineNode[] }
  | { type: "br" };

const INLINE_PATTERN_SOURCE = String.raw`(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|_([^_]+)_|` + "`([^`]+)`)";

function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.split(/\r?\n/);

  let paragraphBuffer = "";
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.trim().length > 0) {
      blocks.push({ type: "paragraph", content: paragraphBuffer.trimEnd() });
      paragraphBuffer = "";
    }
  };

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: "list", items: listBuffer });
      listBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();
    const isHeading = trimmed.startsWith("#");
    const isListItem = trimmed.startsWith("- ");
    const isDivider = /^-{3,}$/.test(trimmed);

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    if (isHeading) {
      flushParagraph();
      flushList();

      const depth = Math.min(6, trimmed.match(/^#+/)?.[0].length ?? 1);
      const content = trimmed.slice(depth).trim();
      blocks.push({ type: "heading", depth: depth as 1 | 2 | 3 | 4 | 5 | 6, content });
      continue;
    }

    if (isDivider) {
      flushParagraph();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }

    if (isListItem) {
      flushParagraph();
      const itemContent = trimmed.replace(/^-+\s*/, "");
      listBuffer.push(itemContent);
      continue;
    }

    const hasHardBreak = /\s{2,}$/.test(line);
    const normalized = hasHardBreak ? line.replace(/\s+$/, "") + "\n" : line;

    if (paragraphBuffer.length > 0) {
      paragraphBuffer += hasHardBreak ? normalized : ` ${normalized}`;
    } else {
      paragraphBuffer = normalized;
    }
  }

  flushParagraph();
  flushList();

  return blocks;
}

function parseInline(content: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = new RegExp(INLINE_PATTERN_SOURCE, "g");

  const segments = content.split("\n");
  segments.forEach((segment, index) => {
    if (segment.length > 0) {
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(segment)) !== null) {
        if (match.index > lastIndex) {
          nodes.push({ type: "text", value: segment.slice(lastIndex, match.index) });
        }

        if (match[2] && match[3]) {
          nodes.push({
            type: "link",
            href: match[3],
            children: parseInline(match[2])
          });
        } else if (match[4]) {
          nodes.push({
            type: "strong",
            children: parseInline(match[4])
          });
        } else if (match[5]) {
          nodes.push({
            type: "em",
            children: parseInline(match[5])
          });
        } else if (match[6]) {
          nodes.push({
            type: "code",
            value: match[6]
          });
        }

        lastIndex = (match.index ?? 0) + match[0].length;
      }

      if (lastIndex < segment.length) {
        nodes.push({ type: "text", value: segment.slice(lastIndex) });
      }
    }

    if (index < segments.length - 1) {
      nodes.push({ type: "br" });
    }
  });

  return nodes;
}

function renderInline(nodes: InlineNode[]): React.ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <React.Fragment key={index}>{node.value}</React.Fragment>;
      case "strong":
        return (
          <strong key={index} className="font-semibold text-foreground">
            {renderInline(node.children)}
          </strong>
        );
      case "em":
        return (
          <em key={index} className="italic text-foreground/80">
            {renderInline(node.children)}
          </em>
        );
      case "code":
        return (
          <code
            key={index}
            className="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-sm text-foreground"
          >
            {node.value}
          </code>
        );
      case "link":
        return (
          <a
            key={index}
            href={node.href}
            className="text-primary underline-offset-4 transition hover:text-primary/80 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {renderInline(node.children)}
          </a>
        );
      case "br":
        return <br key={index} />;
      default:
        return null;
    }
  });
}

export function MarkdownContent({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

  return (
    <div className="flex flex-col gap-6 text-base leading-7 text-foreground/85">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = (`h${block.depth}` as const);
          const className = getHeadingClassName(block.depth);
          return (
            <HeadingTag key={index} className={className}>
              {renderInline(parseInline(block.content))}
            </HeadingTag>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={index} className="text-foreground/80">
              {renderInline(parseInline(block.content))}
            </p>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5 text-foreground/80 marker:text-muted-foreground">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(parseInline(item))}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "hr") {
          return (
            <hr key={index} className="border-border/60" />
          );
        }

        return null;
      })}
    </div>
  );
}

function getHeadingClassName(depth: number) {
  switch (depth) {
    case 1:
      return "text-3xl font-semibold text-foreground";
    case 2:
      return "pt-6 text-2xl font-semibold text-foreground";
    case 3:
      return "pt-4 text-xl font-semibold text-foreground";
    default:
      return "pt-4 text-lg font-semibold text-foreground";
  }
}
