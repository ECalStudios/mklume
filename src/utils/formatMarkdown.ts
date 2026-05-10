/**
 * Inline formatting helpers for the Markdown textarea editor.
 * Each function wraps or toggles formatting around the current selection.
 */

interface FormatResult {
  newContent: string;
  selStart: number;
  selEnd: number;
}

/**
 * Wrap selection with `before` and `after` markers, or unwrap if already wrapped.
 */
function toggleWrap(
  content: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string,
): FormatResult {
  const selected = content.substring(selStart, selEnd);

  // Check if already wrapped — unwrap
  const bLen = before.length;
  const aLen = after.length;
  const preStart = selStart - bLen;
  const postEnd = selEnd + aLen;

  if (
    preStart >= 0 &&
    postEnd <= content.length &&
    content.substring(preStart, selStart) === before &&
    content.substring(selEnd, postEnd) === after
  ) {
    // Unwrap
    const newContent =
      content.substring(0, preStart) + selected + content.substring(postEnd);
    return { newContent, selStart: preStart, selEnd: preStart + selected.length };
  }

  // Also check if selection includes the markers
  if (
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length >= bLen + aLen
  ) {
    const inner = selected.substring(bLen, selected.length - aLen);
    const newContent =
      content.substring(0, selStart) + inner + content.substring(selEnd);
    return { newContent, selStart, selEnd: selStart + inner.length };
  }

  // Wrap
  const wrapped = before + (selected || "text") + after;
  const newContent =
    content.substring(0, selStart) + wrapped + content.substring(selEnd);
  const newSelStart = selStart + bLen;
  const newSelEnd = selected ? newSelStart + selected.length : newSelStart + 4; // "text"
  return { newContent, selStart: newSelStart, selEnd: newSelEnd };
}

export function toggleBold(content: string, selStart: number, selEnd: number): FormatResult {
  return toggleWrap(content, selStart, selEnd, "**", "**");
}

export function toggleItalic(content: string, selStart: number, selEnd: number): FormatResult {
  return toggleWrap(content, selStart, selEnd, "*", "*");
}

export function toggleInlineCode(content: string, selStart: number, selEnd: number): FormatResult {
  return toggleWrap(content, selStart, selEnd, "`", "`");
}

export function toggleStrikethrough(content: string, selStart: number, selEnd: number): FormatResult {
  return toggleWrap(content, selStart, selEnd, "~~", "~~");
}

export function insertLink(content: string, selStart: number, selEnd: number): FormatResult {
  const selected = content.substring(selStart, selEnd);
  const linkText = selected || "link text";
  const md = `[${linkText}](url)`;
  const newContent = content.substring(0, selStart) + md + content.substring(selEnd);
  // Select "url" for quick editing
  const urlStart = selStart + linkText.length + 3; // [text](
  return { newContent, selStart: urlStart, selEnd: urlStart + 3 };
}

export function insertImage(content: string, selStart: number, selEnd: number): FormatResult {
  const selected = content.substring(selStart, selEnd);
  const altText = selected || "alt text";
  const md = `![${altText}](image.png)`;
  const newContent = content.substring(0, selStart) + md + content.substring(selEnd);
  // Select "image.png" for quick editing
  const pathStart = selStart + altText.length + 4; // ![text](
  return { newContent, selStart: pathStart, selEnd: pathStart + 9 };
}

export function insertHeading(content: string, selStart: number, selEnd: number, level: number): FormatResult {
  const prefix = "#".repeat(level) + " ";
  // Find line start
  const lineStart = content.lastIndexOf("\n", selStart - 1) + 1;
  const lineEnd = content.indexOf("\n", selEnd);
  const actualEnd = lineEnd === -1 ? content.length : lineEnd;
  const line = content.substring(lineStart, actualEnd);

  // Remove existing heading prefix if present
  const stripped = line.replace(/^#{1,6}\s*/, "");
  const newLine = prefix + stripped;
  const newContent = content.substring(0, lineStart) + newLine + content.substring(actualEnd);
  return {
    newContent,
    selStart: lineStart + prefix.length,
    selEnd: lineStart + newLine.length,
  };
}

export function insertFootnote(content: string, _selStart: number, selEnd: number): FormatResult {
  // Insert footnote reference at cursor, and footnote definition at end
  const ref = `[^1]`;
  const def = `\n\n[^1]: Footnote text`;
  const newContent =
    content.substring(0, selEnd) + ref + content.substring(selEnd) + def;
  // Select "1" in ref for renaming
  return { newContent, selStart: selEnd + 2, selEnd: selEnd + 3 };
}
