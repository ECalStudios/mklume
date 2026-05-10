import { ICON_SHORTCODE_REGEX } from "./iconShortcodes";

/**
 * Pre-process MkDocs Material syntax into HTML blocks for preview.
 * Handles admonitions, details, content tabs, Material buttons,
 * grid cards, definition lists, and kbd shortcuts.
 *
 * Icon shortcodes are NOT converted here — they are handled at the
 * React component level in MarkdownPreview via text-node interception.
 */
export function preprocessAdmonitions(markdown: string): string {
  let result = processGridCards(markdown);
  result = processAdmonitions(result);
  result = processTabs(result);
  result = processButtons(result);
  result = processDefinitionLists(result);
  result = processKbd(result);
  return result;
}

// ── Grid Cards ──────────────────────────────────────────

function processGridCards(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (
      trimmed === '<div class="grid cards" markdown>' ||
      trimmed === "<div class='grid cards' markdown>"
    ) {
      i++;
      const cards: {
        icon: string;
        title: string;
        desc: string;
        linkLabel: string;
        linkUrl: string;
      }[] = [];

      while (i < lines.length && lines[i].trim() !== "</div>") {
        const lt = lines[i].trim();
        if (lt === "" || lt === "---") {
          i++;
          continue;
        }

        if (lt.startsWith("- ") || lt.startsWith("-\t")) {
          const cardLine = lt.replace(/^-\s+/, "");
          let icon = "";
          let title = "";

          const iconTitleMatch = cardLine.match(
            /^(:[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*:)\s+\*\*([^*]+)\*\*/,
          );
          const titleOnlyMatch = cardLine.match(/^\*\*([^*]+)\*\*/);

          if (iconTitleMatch) {
            icon = iconTitleMatch[1];
            title = iconTitleMatch[2];
          } else if (titleOnlyMatch) {
            title = titleOnlyMatch[1];
          } else {
            title = cardLine.replace(/\*\*/g, "");
          }

          i++;
          let desc = "";
          let linkLabel = "";
          let linkUrl = "";

          while (i < lines.length) {
            const bodyLine = lines[i].trim();
            if (bodyLine === "</div>") break;
            if (bodyLine.startsWith("- ") && !lines[i].startsWith("    "))
              break;
            if (bodyLine === "" || bodyLine === "---") {
              i++;
              continue;
            }
            const lm = bodyLine.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (lm) {
              linkLabel = lm[1];
              linkUrl = lm[2];
              i++;
              continue;
            }
            if (desc) desc += " ";
            desc += bodyLine;
            i++;
          }

          cards.push({ icon, title, desc, linkLabel, linkUrl });
          continue;
        }
        i++;
      }
      if (i < lines.length) i++;

      if (cards.length > 0) {
        result.push("");
        result.push('<div class="grid-cards-preview">');
        for (const card of cards) {
          // Leave icon shortcode as plain text — React component layer handles rendering
          const iconText = card.icon ? `${card.icon} ` : "";
          const linkHtml =
            card.linkLabel && card.linkUrl
              ? `<a class="grid-card-link" href="${card.linkUrl}">${card.linkLabel}</a>`
              : "";

          result.push(`<div class="grid-card-preview">`);
          result.push(
            `<div class="grid-card-header"><strong>${iconText}${card.title}</strong></div>`,
          );
          if (card.desc)
            result.push(`<p class="grid-card-desc">${card.desc}</p>`);
          if (linkHtml) result.push(linkHtml);
          result.push(`</div>`);
        }
        result.push("</div>");
        result.push("");
      }
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result.join("\n");
}

// ── Definition Lists ────────────────────────────────────

function processDefinitionLists(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (
      i + 1 < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("|") &&
      lines[i + 1].match(/^:\s{3,}/)
    ) {
      result.push("");
      result.push('<dl class="def-list-preview">');
      while (i < lines.length) {
        const term = lines[i].trim();
        if (term === "" || term.startsWith("|")) break;
        if (i + 1 >= lines.length || !lines[i + 1].match(/^:\s{3,}/)) break;
        result.push(`<dt>${term}</dt>`);
        i++;
        while (i < lines.length && lines[i].match(/^:\s{3,}/)) {
          result.push(`<dd>${lines[i].replace(/^:\s{3,}/, "")}</dd>`);
          i++;
        }
        while (i < lines.length && lines[i].trim() === "") i++;
      }
      result.push("</dl>");
      result.push("");
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result.join("\n");
}

// ── KBD / Keyboard Shortcuts ────────────────────────────

function processKbd(markdown: string): string {
  return markdown.replace(
    /\+\+([a-zA-Z0-9+]+)\+\+/g,
    (_match, keys: string) => {
      return keys
        .split("+")
        .map(
          (k: string) =>
            `<kbd>${k.charAt(0).toUpperCase() + k.slice(1)}</kbd>`,
        )
        .join("+");
    },
  );
}

// ── Admonitions & Details ────────────────────────────────

function processAdmonitions(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(
      /^(\?\?\?\+?|!!!)\s+(\w+)(?:\s+"([^"]*)")?/,
    );

    if (!match) {
      result.push(lines[i]);
      i++;
      continue;
    }

    const [, marker, admonType, title] = match;
    const isCollapsible = marker.startsWith("???");
    const displayTitle =
      title || admonType.charAt(0).toUpperCase() + admonType.slice(1);

    i++;

    const contentLines: string[] = [];
    while (i < lines.length) {
      if (lines[i].startsWith("    ")) {
        contentLines.push(lines[i].slice(4));
        i++;
      } else if (lines[i].trim() === "") {
        if (i + 1 < lines.length && lines[i + 1].startsWith("    ")) {
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

    const content = contentLines.join("\n").trim();

    if (isCollapsible) {
      result.push("");
      result.push(`<details class="admonition admonition-${admonType}">`);
      result.push(
        `<summary class="admonition-title">${displayTitle}</summary>`,
      );
      result.push("");
      result.push(content);
      result.push("");
      result.push("</details>");
      result.push("");
    } else {
      result.push("");
      result.push(`<div class="admonition admonition-${admonType}">`);
      result.push(`<p class="admonition-title">${displayTitle}</p>`);
      result.push("");
      result.push(content);
      result.push("");
      result.push("</div>");
      result.push("");
    }
  }

  return result.join("\n");
}

// ── Content Tabs ─────────────────────────────────────────

function processTabs(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const tabMatch = lines[i].match(/^===\s+"([^"]+)"/);

    if (!tabMatch) {
      result.push(lines[i]);
      i++;
      continue;
    }

    const tabs: { title: string; content: string[] }[] = [];

    while (i < lines.length) {
      const m = lines[i].match(/^===\s+"([^"]+)"/);
      if (!m) break;

      const tabTitle = m[1];
      i++;
      const tabContent: string[] = [];

      while (i < lines.length) {
        if (lines[i].startsWith("    ")) {
          tabContent.push(lines[i].slice(4));
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
            tabContent.push("");
            i++;
          } else {
            i++;
            break;
          }
        } else {
          break;
        }
      }

      tabs.push({ title: tabTitle, content: tabContent });
    }

    if (tabs.length > 0) {
      result.push("");
      result.push(`<div class="md-tabs-preview">`);
      result.push(
        `<div class="md-tabs-bar">${tabs.map((t, idx) => `<span class="md-tab${idx === 0 ? " active" : ""}">${t.title}</span>`).join("")}</div>`,
      );
      result.push(`<div class="md-tab-content">`);
      result.push("");
      result.push(tabs[0].content.join("\n").trim());
      result.push("");
      result.push("</div>");
      result.push("</div>");
      result.push("");
    }
  }

  return result.join("\n");
}

// ── Material Buttons ─────────────────────────────────────

function processButtons(markdown: string): string {
  return markdown.replace(
    /\[([^\]]+)\]\(([^)]+)\)\{\s*\.md-button[^}]*\}/g,
    (_match, label: string, url: string) => {
      // Leave icon shortcodes in label as-is — React handles them
      return `<a class="md-button-preview" href="${url}">${label}</a>`;
    },
  );
}

// Re-export for use by other modules
export { ICON_SHORTCODE_REGEX };
