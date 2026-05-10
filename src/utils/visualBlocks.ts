/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

/**
 * Visual editor block parser and serializer.
 *
 * Converts Markdown ↔ structured VisualBlock[] for the WYSIWYG editor.
 * Markdown is the source of truth — blocks that the parser doesn't
 * recognize are preserved as raw Markdown blocks so nothing is lost
 * during round-trips.
 */

import type {
  VisualBlock,
  ListItem,
  GridCard,
  TabItem,
  DefItem,
} from "../types/project";

let nextId = 0;
function uid(): string {
  return `vb_${++nextId}_${Date.now().toString(36)}`;
}

// ── Markdown → Blocks ────────────────────────────────

export function markdownToBlocks(md: string): VisualBlock[] {
  nextId = 0;
  const blocks: VisualBlock[] = [];
  const lines = md.split("\n");
  let i = 0;

  // Front matter
  if (lines[0] === "---") {
    const endIdx = lines.indexOf("---", 1);
    if (endIdx > 0) {
      blocks.push({
        id: uid(),
        type: "frontmatter",
        raw: lines.slice(0, endIdx + 1).join("\n"),
      });
      i = endIdx + 1;
      while (i < lines.length && lines[i].trim() === "") i++;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line — skip
    if (trimmed === "") {
      i++;
      continue;
    }

    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ id: uid(), type: "divider" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        id: uid(),
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Image (standalone line)
    const imgMatch = trimmed.match(
      /^!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]*)")?\)$/,
    );
    if (imgMatch) {
      blocks.push({
        id: uid(),
        type: "image",
        alt: imgMatch[1],
        src: imgMatch[2],
        title: imgMatch[3] || "",
      });
      i++;
      continue;
    }

    // Code fence
    const fenceMatch = line.match(/^(`{3,}|~{3,})(\w*)/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = fenceMatch[2] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({
        id: uid(),
        type: "code",
        language: lang,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // Admonition (MkDocs: !!! or ???)
    const admoMatch = trimmed.match(
      /^(!!!|\?\?\?\+?)\s+(\w+)(?:\s+"([^"]*)")?$/,
    );
    if (admoMatch) {
      const collapsible = admoMatch[1].startsWith("???");
      const kind = admoMatch[2];
      const title = admoMatch[3] ?? capitalize(kind);
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length) {
        if (lines[i].match(/^    .+/) || lines[i].trim() === "") {
          bodyLines.push(lines[i].replace(/^    /, ""));
          i++;
        } else {
          break;
        }
      }
      while (
        bodyLines.length > 0 &&
        bodyLines[bodyLines.length - 1].trim() === ""
      ) {
        bodyLines.pop();
      }
      blocks.push({
        id: uid(),
        type: "admonition",
        kind,
        title,
        body: bodyLines.join("\n"),
        collapsible,
      });
      continue;
    }

    // Content tabs (=== "Label")
    const tabMatch = trimmed.match(/^===\s+"([^"]+)"/);
    if (tabMatch) {
      const tabs: TabItem[] = [];
      while (i < lines.length) {
        const tm = lines[i].match(/^===\s+"([^"]+)"/);
        if (!tm) break;
        const label = tm[1];
        i++;
        const contentLines: string[] = [];
        while (i < lines.length) {
          if (lines[i].startsWith("    ")) {
            contentLines.push(lines[i].slice(4));
            i++;
          } else if (lines[i].trim() === "") {
            if (
              i + 1 < lines.length &&
              (lines[i + 1].startsWith("    ") ||
                lines[i + 1].match(/^===\s+"/))
            ) {
              if (lines[i + 1].match(/^===\s+"/)) {
                i++;
                break;
              }
              contentLines.push("");
              i++;
            } else {
              i++;
              break;
            }
          } else {
            break;
          }
        }
        tabs.push({ label, content: contentLines.join("\n").trim() });
      }
      if (tabs.length > 0) {
        blocks.push({ id: uid(), type: "content-tabs", tabs });
      }
      continue;
    }

    // Grid cards (<div class="grid cards" markdown>)
    if (
      trimmed === '<div class="grid cards" markdown>' ||
      trimmed === "<div class='grid cards' markdown>"
    ) {
      const parsed = parseGridCards(lines, i);
      if (parsed) {
        blocks.push({
          id: uid(),
          type: "grid-cards",
          cards: parsed.cards,
        });
        i = parsed.endIndex;
        continue;
      }
    }

    // Button: [Label](url){ .md-button ... }
    const btnMatch = trimmed.match(
      /^\[([^\]]+)\]\(([^)]+)\)\{\s*\.md-button([^}]*)\}$/,
    );
    if (btnMatch) {
      blocks.push({
        id: uid(),
        type: "button",
        label: btnMatch[1],
        url: btnMatch[2],
        primary: btnMatch[3].includes("--primary"),
        icon: "",
      });
      i++;
      continue;
    }

    // Quote block (> ...)
    if (trimmed.startsWith("> ") || trimmed === ">") {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const ql = lines[i];
        if (ql.startsWith("> ")) {
          quoteLines.push(ql.slice(2));
          i++;
        } else if (ql.trim() === ">") {
          quoteLines.push("");
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        id: uid(),
        type: "quote",
        text: quoteLines.join("\n"),
      });
      continue;
    }

    // Task list (- [ ] or - [x])
    if (/^- \[[ xX]\] /.test(trimmed)) {
      const items: ListItem[] = [];
      while (i < lines.length && /^- \[[ xX]\] /.test(lines[i].trim())) {
        const m = lines[i].trim().match(/^- \[([xX ])\] (.*)$/);
        if (m) {
          items.push({
            text: m[2],
            checked: m[1].toLowerCase() === "x",
          });
        }
        i++;
      }
      blocks.push({ id: uid(), type: "task-list", items });
      continue;
    }

    // Unordered list (- or * at start)
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: ListItem[] = [];
      const bullet = trimmed[0];
      while (i < lines.length) {
        const ul = lines[i];
        const ulTrimmed = ul.trim();
        if (ulTrimmed.startsWith(bullet + " ")) {
          items.push({ text: ulTrimmed.slice(2) });
          i++;
        } else if (ul.startsWith("  ") && items.length > 0) {
          items[items.length - 1].text += "\n" + ul.trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({ id: uid(), type: "unordered-list", items });
      continue;
    }

    // Ordered list (1. 2. etc.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const ol = lines[i];
        const olTrimmed = ol.trim();
        const olMatch = olTrimmed.match(/^\d+\.\s+(.*)$/);
        if (olMatch) {
          items.push({ text: olMatch[1] });
          i++;
        } else if (ol.startsWith("  ") && items.length > 0) {
          items[items.length - 1].text += "\n" + ol.trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({ id: uid(), type: "ordered-list", items });
      continue;
    }

    // Definition list (term followed by :   definition)
    if (
      i + 1 < lines.length &&
      trimmed !== "" &&
      !trimmed.startsWith("|") &&
      lines[i + 1].match(/^:\s{3,}/)
    ) {
      const defs: DefItem[] = [];
      while (i < lines.length) {
        const term = lines[i].trim();
        if (term === "" || term.startsWith("|")) break;
        if (i + 1 >= lines.length || !lines[i + 1].match(/^:\s{3,}/)) break;
        i++;
        const defLines: string[] = [];
        while (i < lines.length && lines[i].match(/^:\s{3,}/)) {
          defLines.push(lines[i].replace(/^:\s{3,}/, ""));
          i++;
        }
        defs.push({ term, definition: defLines.join("\n") });
        while (i < lines.length && lines[i].trim() === "") i++;
      }
      if (defs.length > 0) {
        blocks.push({ id: uid(), type: "definition-list", items: defs });
        continue;
      }
    }

    // Table (starts with |)
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({
        id: uid(),
        type: "table",
        raw: tableLines.join("\n"),
      });
      continue;
    }

    // Paragraph: accumulate non-blank, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i];
      const pTrimmed = pLine.trim();
      if (pTrimmed === "") break;
      if (/^#{1,6}\s/.test(pLine)) break;
      if (/^(`{3,}|~{3,})/.test(pLine)) break;
      if (/^(!!!|\?\?\?\+?)\s/.test(pTrimmed)) break;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(pTrimmed)) break;
      if (/^!\[/.test(pTrimmed) && /\]\([^)]+\)$/.test(pTrimmed)) break;
      if (pTrimmed.startsWith("|") && pTrimmed.endsWith("|")) break;
      if (/^===\s+"/.test(pTrimmed)) break;
      if (/^>\s/.test(pTrimmed) || pTrimmed === ">") break;
      if (/^[-*+]\s+/.test(pTrimmed)) break;
      if (/^\d+\.\s+/.test(pTrimmed)) break;
      if (/^- \[[ xX]\] /.test(pTrimmed)) break;
      if (/^\[.+\]\(.+\)\{.*\.md-button/.test(pTrimmed)) break;
      if (
        pTrimmed === '<div class="grid cards" markdown>' ||
        pTrimmed === "<div class='grid cards' markdown>"
      )
        break;
      paraLines.push(pLine);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        id: uid(),
        type: "paragraph",
        text: paraLines.join("\n"),
      });
    }
  }

  return blocks;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Grid Cards Parser ───────────────────────────────

function parseGridCards(
  lines: string[],
  startIndex: number,
): { cards: GridCard[]; endIndex: number } | null {
  let i = startIndex + 1; // skip opening div
  const cards: GridCard[] = [];

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "</div>") {
      i++;
      return { cards, endIndex: i };
    }
    if (trimmed === "") {
      i++;
      continue;
    }

    // Card starts with -   or -  (list item)
    if (trimmed.startsWith("- ") || trimmed.startsWith("-\t")) {
      const cardContent = trimmed.replace(/^-\s+/, "");
      let icon = "";
      let title = "";

      // Parse icon + bold title: :icon: **Title**
      const iconTitleMatch = cardContent.match(
        /^(:[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*:)\s+\*\*([^*]+)\*\*$/,
      );
      const titleOnlyMatch = cardContent.match(/^\*\*([^*]+)\*\*$/);

      if (iconTitleMatch) {
        icon = iconTitleMatch[1];
        title = iconTitleMatch[2];
      } else if (titleOnlyMatch) {
        title = titleOnlyMatch[1];
      } else {
        title = cardContent.replace(/\*\*/g, "");
      }

      i++;
      let description = "";
      let linkLabel = "";
      let linkUrl = "";

      // Collect card body (indented lines)
      while (i < lines.length) {
        const bodyLine = lines[i].trim();
        if (bodyLine === "</div>") break;
        if (
          bodyLine.startsWith("- ") &&
          !lines[i].startsWith("    ")
        )
          break;
        if (bodyLine === "" || bodyLine === "---") {
          i++;
          continue;
        }
        // Link: [Label](url)
        const linkMatch = bodyLine.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          linkLabel = linkMatch[1];
          linkUrl = linkMatch[2];
          i++;
          continue;
        }
        if (description) description += "\n";
        description += bodyLine;
        i++;
      }

      cards.push({ icon, title, description, linkLabel, linkUrl });
      continue;
    }
    i++;
  }

  // If we reached end of file without </div>, treat as raw
  return null;
}

// ── Blocks → Markdown ────────────────────────────────

export function blocksToMarkdown(blocks: VisualBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "frontmatter":
        parts.push(block.raw);
        parts.push("");
        break;

      case "heading":
        parts.push(`${"#".repeat(block.level)} ${block.text}`);
        parts.push("");
        break;

      case "paragraph":
        parts.push(block.text);
        parts.push("");
        break;

      case "image":
        if (block.title) {
          parts.push(`![${block.alt}](${block.src} "${block.title}")`);
        } else {
          parts.push(`![${block.alt}](${block.src})`);
        }
        parts.push("");
        break;

      case "admonition": {
        const marker = block.collapsible ? "???" : "!!!";
        const titlePart =
          block.title && block.title !== capitalize(block.kind)
            ? ` "${block.title}"`
            : "";
        parts.push(`${marker} ${block.kind}${titlePart}`);
        const bodyLines = block.body.split("\n");
        for (const line of bodyLines) {
          parts.push(`    ${line}`);
        }
        parts.push("");
        break;
      }

      case "code":
        parts.push("```" + block.language);
        parts.push(block.code);
        parts.push("```");
        parts.push("");
        break;

      case "table":
        parts.push(block.raw);
        parts.push("");
        break;

      case "divider":
        parts.push("---");
        parts.push("");
        break;

      case "raw":
        parts.push(block.markdown);
        parts.push("");
        break;

      case "quote":
        for (const qLine of block.text.split("\n")) {
          parts.push(qLine ? `> ${qLine}` : ">");
        }
        parts.push("");
        break;

      case "unordered-list":
        for (const item of block.items) {
          parts.push(`- ${item.text}`);
        }
        parts.push("");
        break;

      case "ordered-list":
        block.items.forEach((item, idx) => {
          parts.push(`${idx + 1}. ${item.text}`);
        });
        parts.push("");
        break;

      case "task-list":
        for (const item of block.items) {
          parts.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
        }
        parts.push("");
        break;

      case "definition-list":
        for (const item of block.items) {
          parts.push(item.term);
          for (const dLine of item.definition.split("\n")) {
            parts.push(`:   ${dLine}`);
          }
          parts.push("");
        }
        break;

      case "grid-cards": {
        parts.push('<div class="grid cards" markdown>');
        parts.push("");
        for (const card of block.cards) {
          const iconPart = card.icon ? `${card.icon} ` : "";
          parts.push(`-   ${iconPart}**${card.title}**`);
          parts.push("");
          parts.push("    ---");
          parts.push("");
          if (card.description) {
            for (const dLine of card.description.split("\n")) {
              parts.push(`    ${dLine}`);
            }
            parts.push("");
          }
          if (card.linkLabel && card.linkUrl) {
            parts.push(`    [${card.linkLabel}](${card.linkUrl})`);
            parts.push("");
          }
        }
        parts.push("</div>");
        parts.push("");
        break;
      }

      case "content-tabs":
        for (const tab of block.tabs) {
          parts.push(`=== "${tab.label}"`);
          for (const tLine of tab.content.split("\n")) {
            parts.push(`    ${tLine}`);
          }
          parts.push("");
        }
        break;

      case "button": {
        const iconPart = block.icon ? `${block.icon} ` : "";
        const classes = block.primary
          ? ".md-button .md-button--primary"
          : ".md-button";
        parts.push(
          `[${iconPart}${block.label}](${block.url}){ ${classes} }`,
        );
        parts.push("");
        break;
      }
    }
  }

  let result = parts.join("\n");
  result = result.replace(/\n{3,}$/g, "\n");
  if (!result.endsWith("\n")) result += "\n";
  return result;
}
