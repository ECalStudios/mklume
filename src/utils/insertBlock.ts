export type BlockType =
  | "heading"
  | "note"
  | "info"
  | "tip"
  | "warning"
  | "danger"
  | "details"
  | "tabs"
  | "grid-cards"
  | "button"
  | "table"
  | "code"
  | "image"
  | "link"
  | "divider"
  | "front-matter"
  | "quote"
  | "bullet-list"
  | "numbered-list"
  | "task-list"
  | "definition-list"
  | "success"
  | "question"
  | "failure"
  | "bug"
  | "example"
  | "abstract"
  | "icon";

export interface InsertResult {
  newContent: string;
  cursorStart: number;
  cursorEnd: number;
}

function indent(text: string): string {
  return text.split("\n").map((l) => "    " + l).join("\n");
}

function ensureNewline(content: string, pos: number): string {
  if (pos === 0) return "";
  if (content[pos - 1] === "\n") return "";
  return "\n";
}

export function insertBlock(
  type: BlockType,
  content: string,
  selStart: number,
  selEnd: number,
): InsertResult {
  const selected = content.substring(selStart, selEnd);
  const has = selected.length > 0;
  const pre = ensureNewline(content, selStart);
  const base = selStart + pre.length;

  let block: string;
  let cStart: number;
  let cEnd: number;

  switch (type) {
    case "heading": {
      const text = has ? selected : "Heading";
      block = `${pre}\n## ${text}\n\n`;
      cStart = base + 4;
      cEnd = cStart + text.length;
      break;
    }

    case "note": {
      const body = has ? indent(selected) : "    Your note here.";
      block = `${pre}\n!!! note "Note"\n${body}\n\n`;
      cStart = base + 11;
      cEnd = cStart + 4;
      break;
    }

    case "info": {
      const body = has ? indent(selected) : "    Information here.";
      block = `${pre}\n!!! info "Info"\n${body}\n\n`;
      cStart = base + 11;
      cEnd = cStart + 4;
      break;
    }

    case "tip": {
      const body = has ? indent(selected) : "    Your tip here.";
      block = `${pre}\n!!! tip "Tip"\n${body}\n\n`;
      cStart = base + 10;
      cEnd = cStart + 3;
      break;
    }

    case "warning": {
      const body = has ? indent(selected) : "    Warning details here.";
      block = `${pre}\n!!! warning "Warning"\n${body}\n\n`;
      cStart = base + 15;
      cEnd = cStart + 7;
      break;
    }

    case "danger": {
      const body = has ? indent(selected) : "    Critical issue here.";
      block = `${pre}\n!!! danger "Danger"\n${body}\n\n`;
      cStart = base + 13;
      cEnd = cStart + 6;
      break;
    }

    case "details": {
      const body = has ? indent(selected) : "    Hidden content here.";
      block = `${pre}\n??? info "Click to expand"\n${body}\n\n`;
      cStart = base + 11;
      cEnd = cStart + 15;
      break;
    }

    case "tabs": {
      block =
        `${pre}\n` +
        `=== "Tab 1"\n\n` +
        `    ${has ? selected : "Content for Tab 1."}\n\n` +
        `=== "Tab 2"\n\n` +
        `    Content for Tab 2.\n\n`;
      cStart = base + 6;
      cEnd = cStart + 5;
      break;
    }

    case "grid-cards": {
      block =
        `${pre}\n` +
        `<div class="grid cards" markdown>\n\n` +
        `-   :material-book-open-page-variant: **${has ? selected : "Card Title"}**\n\n` +
        `    ---\n\n` +
        `    Card description here.\n\n` +
        `    [Read more](index.md)\n\n` +
        `-   :material-rocket-launch: **Second Card**\n\n` +
        `    ---\n\n` +
        `    Another card description.\n\n` +
        `    [Learn more](getting-started.md)\n\n` +
        `</div>\n\n`;
      cStart = base + 78;
      cEnd = cStart + (has ? selected.length : 10);
      break;
    }

    case "button": {
      const text = has ? selected : "Open page";
      block = `${pre}\n[${text}](index.md){ .md-button .md-button--primary }\n\n`;
      cStart = base + 2;
      cEnd = cStart + text.length;
      break;
    }

    case "table": {
      block =
        `${pre}\n` +
        "| Column 1 | Column 2 | Column 3 |\n" +
        "| -------- | -------- | -------- |\n" +
        "| Cell     | Cell     | Cell     |\n" +
        "| Cell     | Cell     | Cell     |\n\n";
      cStart = base + 3;
      cEnd = cStart + 8;
      break;
    }

    case "code": {
      const body = has ? selected : "code here";
      block = `${pre}\n\`\`\`\n${body}\n\`\`\`\n\n`;
      if (has) {
        cStart = base + 5 + body.length + 5;
        cEnd = cStart;
      } else {
        cStart = base + 5;
        cEnd = cStart + body.length;
      }
      break;
    }

    case "image": {
      const alt = has ? selected : "alt text";
      block = `${pre}![${alt}](url)`;
      cStart = base + 2 + alt.length + 2;
      cEnd = cStart + 3;
      break;
    }

    case "link": {
      const text = has ? selected : "link text";
      block = `[${text}](url)`;
      cStart = selStart + 1 + text.length + 2;
      cEnd = cStart + 3;
      break;
    }

    case "divider": {
      block = `${pre}\n---\n\n`;
      cStart = base + 5;
      cEnd = cStart;
      break;
    }

    case "front-matter": {
      const fm =
        `---\ntitle: ${has ? selected : "Page Title"}\n` +
        `description: A short description.\n` +
        `icon: material/book-open-page-variant\n---\n\n`;
      const newContent = fm + content;
      return {
        newContent,
        cursorStart: 10,
        cursorEnd: 10 + (has ? selected.length : 10),
      };
    }

    case "quote": {
      const text = has ? selected.split("\n").map((l: string) => `> ${l}`).join("\n") : "> Quote text here.";
      block = `${pre}\n${text}\n\n`;
      cStart = base + 3;
      cEnd = cStart + (has ? selected.length : 16);
      break;
    }

    case "bullet-list": {
      block = `${pre}\n- ${has ? selected : "First item"}\n- Second item\n- Third item\n\n`;
      cStart = base + 3;
      cEnd = cStart + (has ? selected.length : 10);
      break;
    }

    case "numbered-list": {
      block = `${pre}\n1. ${has ? selected : "First item"}\n2. Second item\n3. Third item\n\n`;
      cStart = base + 4;
      cEnd = cStart + (has ? selected.length : 10);
      break;
    }

    case "task-list": {
      block = `${pre}\n- [ ] ${has ? selected : "Todo item"}\n- [ ] Another task\n- [x] Done item\n\n`;
      cStart = base + 7;
      cEnd = cStart + (has ? selected.length : 9);
      break;
    }

    case "definition-list": {
      block = `${pre}\n${has ? selected : "Term"}\n:   Definition text here.\n\n`;
      cStart = base + 1;
      cEnd = cStart + (has ? selected.length : 4);
      break;
    }

    case "success": {
      const body = has ? indent(selected) : "    Success message here.";
      block = `${pre}\n!!! success "Success"\n${body}\n\n`;
      cStart = base + 14;
      cEnd = cStart + 7;
      break;
    }

    case "question": {
      const body = has ? indent(selected) : "    Question or FAQ here.";
      block = `${pre}\n!!! question "Question"\n${body}\n\n`;
      cStart = base + 15;
      cEnd = cStart + 8;
      break;
    }

    case "failure": {
      const body = has ? indent(selected) : "    Failure description here.";
      block = `${pre}\n!!! failure "Failure"\n${body}\n\n`;
      cStart = base + 14;
      cEnd = cStart + 7;
      break;
    }

    case "bug": {
      const body = has ? indent(selected) : "    Bug description here.";
      block = `${pre}\n!!! bug "Bug"\n${body}\n\n`;
      cStart = base + 10;
      cEnd = cStart + 3;
      break;
    }

    case "example": {
      const body = has ? indent(selected) : "    Example content here.";
      block = `${pre}\n!!! example "Example"\n${body}\n\n`;
      cStart = base + 14;
      cEnd = cStart + 7;
      break;
    }

    case "abstract": {
      const body = has ? indent(selected) : "    Abstract summary here.";
      block = `${pre}\n!!! abstract "Abstract"\n${body}\n\n`;
      cStart = base + 15;
      cEnd = cStart + 8;
      break;
    }

    case "icon": {
      block = `:material-book-open-page-variant:`;
      cStart = selStart + 1;
      cEnd = selStart + block.length - 1;
      break;
    }

    default: {
      block = "";
      cStart = selStart;
      cEnd = selEnd;
    }
  }

  const newContent = content.substring(0, selStart) + block + content.substring(selEnd);
  return { newContent, cursorStart: cStart, cursorEnd: cEnd };
}
