/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import type {
  VisualBlock,
  ListItem,
  GridCard,
  TabItem,
  DefItem,
} from "../../types/project";
import { markdownToBlocks, blocksToMarkdown } from "../../utils/visualBlocks";
import IconPicker from "./IconPicker";
import IconShortcode from "../common/IconShortcode";
import { ICON_SHORTCODE_REGEX } from "../../utils/iconShortcodes";
import { resolveDocsAsset, isExternalUrl } from "../../utils/pathResolver";
import { convertFileSrc } from "@tauri-apps/api/core";

interface VisualEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  docsDir: string;
  pageRelativePath: string;
}

type AddBlockType =
  | "heading"
  | "paragraph"
  | "quote"
  | "divider"
  | "unordered-list"
  | "ordered-list"
  | "task-list"
  | "definition-list"
  | "admonition"
  | "details"
  | "image"
  | "button"
  | "grid-cards"
  | "content-tabs"
  | "table"
  | "code"
  | "frontmatter"
  | "raw";

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) autoGrow(ref.current);
  }, [value]);
  return ref;
}

const INLINE_RE = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|:(material|fontawesome|simple|octicons|emoji)-[a-zA-Z0-9-]+:)/g;

function renderInlineMarkdown(text: string): ReactNode {
  INLINE_RE.lastIndex = 0;
  if (!INLINE_RE.test(text)) {
    INLINE_RE.lastIndex = 0;
    return text;
  }
  INLINE_RE.lastIndex = 0;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const re = new RegExp(INLINE_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const full = match[0];
    if (match[2] !== undefined) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(<code key={key++} className="visual-inline-code">{match[4]}</code>);
    } else if (ICON_SHORTCODE_REGEX.test(full)) {
      ICON_SHORTCODE_REGEX.lastIndex = 0;
      parts.push(<IconShortcode key={key++} shortcode={full} size={16} />);
    } else {
      parts.push(full);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function VisualEditor({ content, onChange, docsDir, pageRelativePath }: VisualEditorProps) {
  const [blocks, setBlocks] = useState<VisualBlock[]>(() =>
    markdownToBlocks(content),
  );
  const lastContentRef = useRef(content);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [slashFilter, setSlashFilter] = useState("");

  // Drag state
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragYRef = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (content !== lastContentRef.current) {
      setBlocks(markdownToBlocks(content));
      lastContentRef.current = content;
    }
  }, [content]);

  const commit = useCallback(
    (updated: VisualBlock[]) => {
      setBlocks(updated);
      const md = blocksToMarkdown(updated);
      lastContentRef.current = md;
      onChange(md);
    },
    [onChange],
  );

  function updateBlock(id: string, patch: Partial<VisualBlock>) {
    const updated = blocks.map((b) =>
      b.id === id ? { ...b, ...patch } : b,
    ) as VisualBlock[];
    commit(updated);
  }

  function deleteBlock(id: string) {
    commit(blocks.filter((b) => b.id !== id));
  }

  function moveBlock(id: string, direction: "up" | "down") {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    commit(copy);
  }

  function duplicateBlock(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const original = blocks[idx];
    const clone = {
      ...JSON.parse(JSON.stringify(original)),
      id: `vb_dup_${Date.now().toString(36)}`,
    };
    const copy = [...blocks];
    copy.splice(idx + 1, 0, clone);
    commit(copy);
  }

  function convertToRaw(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const block = blocks[idx];
    const md = blocksToMarkdown([block]).trim();
    const updated = blocks.map((b) =>
      b.id === id
        ? { id: b.id, type: "raw" as const, markdown: md }
        : b,
    );
    commit(updated as VisualBlock[]);
  }

  function insertNewBlock(type: AddBlockType, afterIndex: number) {
    const id = `vb_new_${Date.now().toString(36)}`;
    let newBlock: VisualBlock;

    switch (type) {
      case "heading":
        newBlock = { id, type: "heading", level: 2, text: "New Heading" };
        break;
      case "paragraph":
        newBlock = { id, type: "paragraph", text: "New paragraph text." };
        break;
      case "quote":
        newBlock = { id, type: "quote", text: "Quote text here." };
        break;
      case "divider":
        newBlock = { id, type: "divider" };
        break;
      case "unordered-list":
        newBlock = {
          id,
          type: "unordered-list",
          items: [{ text: "First item" }, { text: "Second item" }],
        };
        break;
      case "ordered-list":
        newBlock = {
          id,
          type: "ordered-list",
          items: [{ text: "First item" }, { text: "Second item" }],
        };
        break;
      case "task-list":
        newBlock = {
          id,
          type: "task-list",
          items: [
            { text: "Todo item", checked: false },
            { text: "Done item", checked: true },
          ],
        };
        break;
      case "definition-list":
        newBlock = {
          id,
          type: "definition-list",
          items: [{ term: "Term", definition: "Definition text" }],
        };
        break;
      case "admonition":
        newBlock = {
          id,
          type: "admonition",
          kind: "note",
          title: "Note",
          body: "Content here.",
          collapsible: false,
        };
        break;
      case "details":
        newBlock = {
          id,
          type: "admonition",
          kind: "info",
          title: "Click to expand",
          body: "Hidden content here.",
          collapsible: true,
        };
        break;
      case "image":
        newBlock = { id, type: "image", alt: "alt text", src: "", title: "" };
        break;
      case "button":
        newBlock = {
          id,
          type: "button",
          label: "Button",
          url: "index.md",
          primary: true,
          icon: "",
        };
        break;
      case "grid-cards":
        newBlock = {
          id,
          type: "grid-cards",
          cards: [
            {
              icon: ":material-book-open-page-variant:",
              title: "Card Title",
              description: "Card description.",
              linkLabel: "Read more",
              linkUrl: "index.md",
            },
          ],
        };
        break;
      case "content-tabs":
        newBlock = {
          id,
          type: "content-tabs",
          tabs: [
            { label: "Tab 1", content: "Content for Tab 1." },
            { label: "Tab 2", content: "Content for Tab 2." },
          ],
        };
        break;
      case "table":
        newBlock = {
          id,
          type: "table",
          raw: "| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |",
        };
        break;
      case "code":
        newBlock = { id, type: "code", language: "", code: "" };
        break;
      case "frontmatter":
        newBlock = {
          id,
          type: "frontmatter",
          raw: '---\ntitle: Page Title\ndescription: ""\n---',
        };
        break;
      case "raw":
        newBlock = { id, type: "raw", markdown: "" };
        break;
    }

    const copy = [...blocks];
    copy.splice(afterIndex + 1, 0, newBlock);
    commit(copy);
    setAddMenuOpen(false);
    setAddMenuIndex(null);
  }

  function openAddMenu(afterIndex: number) {
    setAddMenuIndex(afterIndex);
    setAddMenuOpen(true);
  }

  // Slash command: open inline menu when "/" typed in empty paragraph
  function handleSlashTrigger(blockId: string, filterText: string) {
    setSlashBlockId(blockId);
    setSlashFilter(filterText);
  }

  function handleSlashSelect(type: AddBlockType) {
    if (slashBlockId === null) return;
    const idx = blocks.findIndex((b) => b.id === slashBlockId);
    if (idx < 0) return;
    // Remove the slash paragraph, insert the new block at that position
    const copy = blocks.filter((b) => b.id !== slashBlockId);
    const id = `vb_new_${Date.now().toString(36)}`;
    let newBlock: VisualBlock;
    // Reuse the same switch as insertNewBlock for the new block
    switch (type) {
      case "heading": newBlock = { id, type: "heading", level: 2, text: "New Heading" }; break;
      case "paragraph": newBlock = { id, type: "paragraph", text: "" }; break;
      case "quote": newBlock = { id, type: "quote", text: "Quote text here." }; break;
      case "divider": newBlock = { id, type: "divider" }; break;
      case "unordered-list": newBlock = { id, type: "unordered-list", items: [{ text: "" }] }; break;
      case "ordered-list": newBlock = { id, type: "ordered-list", items: [{ text: "" }] }; break;
      case "task-list": newBlock = { id, type: "task-list", items: [{ text: "", checked: false }] }; break;
      case "definition-list": newBlock = { id, type: "definition-list", items: [{ term: "", definition: "" }] }; break;
      case "admonition": newBlock = { id, type: "admonition", kind: "note", title: "Note", body: "Content here.", collapsible: false }; break;
      case "details": newBlock = { id, type: "admonition", kind: "info", title: "Click to expand", body: "Hidden content here.", collapsible: true }; break;
      case "image": newBlock = { id, type: "image", alt: "alt text", src: "", title: "" }; break;
      case "button": newBlock = { id, type: "button", label: "Button", url: "index.md", primary: true, icon: "" }; break;
      case "grid-cards": newBlock = { id, type: "grid-cards", cards: [{ icon: ":material-book-open-page-variant:", title: "Card Title", description: "Card description.", linkLabel: "Read more", linkUrl: "index.md" }] }; break;
      case "content-tabs": newBlock = { id, type: "content-tabs", tabs: [{ label: "Tab 1", content: "Content for Tab 1." }, { label: "Tab 2", content: "Content for Tab 2." }] }; break;
      case "table": newBlock = { id, type: "table", raw: "| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |" }; break;
      case "code": newBlock = { id, type: "code", language: "", code: "" }; break;
      case "frontmatter": newBlock = { id, type: "frontmatter", raw: '---\ntitle: Page Title\ndescription: ""\n---' }; break;
      case "raw": newBlock = { id, type: "raw", markdown: "" }; break;
    }
    copy.splice(idx, 0, newBlock);
    commit(copy);
    setSlashBlockId(null);
    setSlashFilter("");
    setSelectedBlockId(id);
  }

  function handleSlashClose() {
    if (slashBlockId) {
      // Clear the slash text from the paragraph
      updateBlock(slashBlockId, { text: "" });
    }
    setSlashBlockId(null);
    setSlashFilter("");
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape closes menus
      if (e.key === "Escape") {
        if (slashBlockId) { handleSlashClose(); return; }
        if (addMenuOpen) { setAddMenuOpen(false); setAddMenuIndex(null); return; }
        setSelectedBlockId(null);
        return;
      }

      // Don't interfere with text inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      if (!selectedBlockId) return;

      // Alt+Up / Alt+Down: move block
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        moveBlock(selectedBlockId, e.key === "ArrowUp" ? "up" : "down");
        return;
      }

      // Ctrl+D: duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        duplicateBlock(selectedBlockId);
        return;
      }

      // Delete/Backspace: delete block (only when not editing)
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const idx = blocks.findIndex((b) => b.id === selectedBlockId);
        deleteBlock(selectedBlockId);
        // Select adjacent block
        if (blocks.length > 1) {
          const nextIdx = Math.min(idx, blocks.length - 2);
          setSelectedBlockId(blocks[nextIdx === idx ? (idx > 0 ? idx - 1 : idx + 1) : nextIdx].id);
        } else {
          setSelectedBlockId(null);
        }
        return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  // Drag handlers
  function handleDragStart(blockId: string, clientY: number) {
    setDragBlockId(blockId);
    dragYRef.current = clientY;
    setSelectedBlockId(blockId);

    function onPointerMove(e: PointerEvent) {
      if (!editorRef.current) return;
      dragYRef.current = e.clientY;
      // Find insertion target
      const blockEls = editorRef.current.querySelectorAll("[data-block-id]");
      let targetIdx = blocks.length - 1;
      for (let i = 0; i < blockEls.length; i++) {
        const rect = blockEls[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          targetIdx = i;
          break;
        }
        targetIdx = i + 1;
      }
      setDragOverIndex(targetIdx);
    }

    function onPointerUp() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      setDragBlockId((prevDragId) => {
        setDragOverIndex((prevTarget) => {
          if (prevDragId && prevTarget !== null) {
            setBlocks((prevBlocks) => {
              const srcIdx = prevBlocks.findIndex((b) => b.id === prevDragId);
              if (srcIdx < 0 || prevTarget === srcIdx || prevTarget === srcIdx + 1) return prevBlocks;
              const copy = [...prevBlocks];
              const [moved] = copy.splice(srcIdx, 1);
              const insertAt = prevTarget > srcIdx ? prevTarget - 1 : prevTarget;
              copy.splice(insertAt, 0, moved);
              const md = blocksToMarkdown(copy);
              lastContentRef.current = md;
              onChange(md);
              return copy;
            });
          }
          return null;
        });
        return null;
      });
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  // Click below last block to add paragraph
  function handleEditorClick(e: React.MouseEvent) {
    if (e.target !== editorRef.current) return;
    // Only if clicking in the bottom empty area
    if (blocks.length === 0) return;
    const lastBlockEl = editorRef.current?.querySelector("[data-block-id]:last-of-type");
    if (lastBlockEl) {
      const rect = lastBlockEl.getBoundingClientRect();
      if (e.clientY > rect.bottom + 20) {
        const id = `vb_new_${Date.now().toString(36)}`;
        const newBlock: VisualBlock = { id, type: "paragraph", text: "" };
        const copy = [...blocks, newBlock];
        commit(copy);
        setSelectedBlockId(id);
      }
    }
  }

  return (
    <div
      className={`visual-editor${dragBlockId ? " visual-editor--dragging" : ""}`}
      ref={editorRef}
      onClick={handleEditorClick}
    >
      {blocks.length === 0 && (
        <div className="visual-empty">
          No content yet.
          <button
            className="visual-empty-add"
            onClick={() => openAddMenu(-1)}
          >
            + Add Block
          </button>
        </div>
      )}
      {blocks.length > 0 && (
        <InsertRow onClick={() => openAddMenu(-1)} active={dragOverIndex === 0} />
      )}
      {blocks.map((block, index) => (
        <div key={block.id} data-block-id={block.id}>
          {dragOverIndex === index && dragBlockId && dragBlockId !== block.id && (
            <div className="visual-drag-indicator" />
          )}
          <BlockRenderer
            block={block}
            isFirst={index === 0}
            isLast={index === blocks.length - 1}
            selected={selectedBlockId === block.id}
            dragging={dragBlockId === block.id}
            onSelect={() => setSelectedBlockId(block.id)}
            onUpdate={(patch) => updateBlock(block.id, patch)}
            onDelete={() => deleteBlock(block.id)}
            onMove={(dir) => moveBlock(block.id, dir)}
            onDuplicate={() => duplicateBlock(block.id)}
            onConvertToRaw={() => convertToRaw(block.id)}
            onAddAbove={() => openAddMenu(index - 1)}
            onAddBelow={() => openAddMenu(index)}
            onDragStart={(clientY) => handleDragStart(block.id, clientY)}
            onSlashTrigger={(filter) => handleSlashTrigger(block.id, filter)}
            showSlashMenu={slashBlockId === block.id}
            slashFilter={slashFilter}
            onSlashSelect={handleSlashSelect}
            onSlashClose={handleSlashClose}
            docsDir={docsDir}
            pageRelativePath={pageRelativePath}
            commit={commit}
            blocks={blocks}
            blockIndex={index}
          />
          {dragOverIndex === index + 1 && dragBlockId && dragBlockId !== block.id && (
            <div className="visual-drag-indicator" />
          )}
          <InsertRow onClick={() => openAddMenu(index)} />
        </div>
      ))}

      {addMenuOpen && addMenuIndex !== null && (
        <AddBlockMenu
          onSelect={(type) => insertNewBlock(type, addMenuIndex)}
          onClose={() => {
            setAddMenuOpen(false);
            setAddMenuIndex(null);
          }}
        />
      )}
    </div>
  );
}

// ── Block Type Icons ──────────────────────────────────

const blockIcons: Record<string, ReactNode> = {
  heading: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 10l3 2-3 2"/></svg>,
  paragraph: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>,
  quote: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>,
  divider: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18"/></svg>,
  "unordered-list": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>,
  "ordered-list": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>,
  "task-list": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="M12 8h9"/><rect x="3" y="13" width="6" height="6" rx="1"/><path d="m5 16 1.5 1.5L9 14"/><path d="M12 18h9"/></svg>,
  "definition-list": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h10"/><path d="M8 11h12"/><path d="M4 15h10"/><path d="M8 19h12"/></svg>,
  admonition: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
  details: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  image: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
  button: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M12 12h.01"/></svg>,
  "grid-cards": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  "content-tabs": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v6"/></svg>,
  table: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>,
  code: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  frontmatter: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16"/><path d="M4 10h16"/><path d="M4 14h10"/></svg>,
  raw: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
};

// ── Add Block Menu ────────────────────────────────────

interface AddBlockItem {
  type: AddBlockType;
  label: string;
  desc: string;
  aliases?: string[];
}

interface AddBlockCategory {
  name: string;
  items: AddBlockItem[];
}

const addBlockCategories: AddBlockCategory[] = [
  {
    name: "Text",
    items: [
      { type: "heading", label: "Heading", desc: "Section heading H1-H6", aliases: ["h1","h2","h3","title"] },
      { type: "paragraph", label: "Paragraph", desc: "Plain text block", aliases: ["text","p"] },
      { type: "quote", label: "Quote", desc: "Blockquote", aliases: ["blockquote"] },
      { type: "divider", label: "Divider", desc: "Horizontal rule", aliases: ["hr","line","separator"] },
    ],
  },
  {
    name: "Lists",
    items: [
      { type: "unordered-list", label: "Bullet List", desc: "Unordered list", aliases: ["ul","bullets"] },
      { type: "ordered-list", label: "Numbered List", desc: "Ordered list", aliases: ["ol","numbers"] },
      { type: "task-list", label: "Task List", desc: "Checklist items", aliases: ["todo","checklist"] },
      { type: "definition-list", label: "Definitions", desc: "Term + definition pairs", aliases: ["dl","glossary"] },
    ],
  },
  {
    name: "Callouts",
    items: [
      { type: "admonition", label: "Admonition", desc: "Note / tip / warning", aliases: ["note","tip","warning","info","callout"] },
      { type: "details", label: "Details", desc: "Collapsible section", aliases: ["collapse","accordion","toggle"] },
    ],
  },
  {
    name: "Media",
    items: [
      { type: "image", label: "Image", desc: "Image reference", aliases: ["img","photo","picture"] },
      { type: "button", label: "Button", desc: "Material button link", aliases: ["btn","link","cta"] },
      { type: "grid-cards", label: "Grid Cards", desc: "Card grid layout", aliases: ["cards","grid"] },
    ],
  },
  {
    name: "Layout",
    items: [
      { type: "content-tabs", label: "Tabs", desc: "Tabbed content sections", aliases: ["tab"] },
      { type: "table", label: "Table", desc: "Data table", aliases: ["grid","spreadsheet"] },
    ],
  },
  {
    name: "Advanced",
    items: [
      { type: "code", label: "Code", desc: "Fenced code block", aliases: ["codeblock","snippet","fence"] },
      { type: "frontmatter", label: "Front Matter", desc: "YAML metadata", aliases: ["yaml","meta"] },
      { type: "raw", label: "Raw Markdown", desc: "Preserved raw content", aliases: ["markdown","md"] },
    ],
  },
];

function filterBlockItems(categories: AddBlockCategory[], filter: string) {
  const lower = filter.toLowerCase();
  return categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(lower) ||
          item.desc.toLowerCase().includes(lower) ||
          item.type.includes(lower) ||
          item.aliases?.some((a) => a.includes(lower)),
      ),
    }))
    .filter((cat) => cat.items.length > 0);
}

function AddBlockMenu({
  onSelect,
  onClose,
  initialFilter,
}: {
  onSelect: (type: AddBlockType) => void;
  onClose: () => void;
  initialFilter?: string;
}) {
  const [filter, setFilter] = useState(initialFilter ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const filtered = filterBlockItems(addBlockCategories, filter);
  const flatItems = filtered.flatMap((cat) => cat.items);

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [filter]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatItems.length > 0) {
      e.preventDefault();
      onSelect(flatItems[Math.min(highlightIdx, flatItems.length - 1)].type);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  let flatIdx = 0;
  return (
    <div className="add-block-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="add-block-menu" ref={ref} onKeyDown={handleKeyDown}>
        <div className="add-block-header">
          <span className="add-block-title">Add Block</span>
          <button className="add-block-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <input
          ref={inputRef}
          className="add-block-search"
          placeholder="Search blocks…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="add-block-list">
          {filtered.map((cat) => (
            <div key={cat.name} className="add-block-category">
              <span className="add-block-cat-label">{cat.name}</span>
              {cat.items.map((item) => {
                const idx = flatIdx++;
                return (
                  <button
                    key={item.type}
                    className={`add-block-item${idx === highlightIdx ? " highlighted" : ""}`}
                    onClick={() => onSelect(item.type)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                  >
                    <span className="add-block-item-icon">{blockIcons[item.type]}</span>
                    <span className="add-block-item-text">
                      <span className="add-block-item-label">{item.label}</span>
                      <span className="add-block-item-desc">{item.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="add-block-empty">No matching blocks.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Insert Row (gutter plus button) ───────────────────

function InsertRow({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <div className={`visual-insert-row${active ? " visual-insert-row--active" : ""}`}>
      <button
        className="visual-insert-btn"
        onClick={onClick}
        title="Add block"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
      <div className="visual-insert-line" />
    </div>
  );
}

// ── Block Actions Menu (compact "..." dropdown) ──────

function BlockActionsMenu({
  isFirst,
  isLast,
  onMove,
  onDuplicate,
  onConvertToRaw,
  onDelete,
  onAddAbove,
  onAddBelow,
}: {
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: "up" | "down") => void;
  onDuplicate: () => void;
  onConvertToRaw: () => void;
  onDelete: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="vb-actions-menu" ref={ref}>
      <button
        className="vb-actions-trigger"
        onClick={() => setOpen(!open)}
        title="Block actions"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div className="vb-actions-dropdown">
          <button className="vb-action-item" onClick={() => { onAddAbove(); setOpen(false); }}>
            <span>Add above</span>
          </button>
          <button className="vb-action-item" onClick={() => { onAddBelow(); setOpen(false); }}>
            <span>Add below</span>
          </button>
          <div className="vb-actions-divider" />
          <button className="vb-action-item" onClick={() => { onMove("up"); setOpen(false); }} disabled={isFirst}>
            <span>Move up</span>
          </button>
          <button className="vb-action-item" onClick={() => { onMove("down"); setOpen(false); }} disabled={isLast}>
            <span>Move down</span>
          </button>
          <button className="vb-action-item" onClick={() => { onDuplicate(); setOpen(false); }}>
            <span>Duplicate</span>
          </button>
          <button className="vb-action-item" onClick={() => { onConvertToRaw(); setOpen(false); }}>
            <span>Convert to raw</span>
          </button>
          <div className="vb-actions-divider" />
          <button className="vb-action-item vb-action-danger" onClick={() => { onDelete(); setOpen(false); }}>
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Block Renderer ─────────────────────────────────────

interface BlockRendererProps {
  block: VisualBlock;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<VisualBlock>) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
  onDuplicate: () => void;
  onConvertToRaw: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onDragStart: (clientY: number) => void;
  onSlashTrigger: (filter: string) => void;
  showSlashMenu: boolean;
  slashFilter: string;
  onSlashSelect: (type: AddBlockType) => void;
  onSlashClose: () => void;
  docsDir: string;
  pageRelativePath: string;
  commit: (blocks: VisualBlock[]) => void;
  blocks: VisualBlock[];
  blockIndex: number;
}

function BlockRenderer({
  block,
  isFirst,
  isLast,
  selected,
  dragging,
  onSelect,
  onUpdate,
  onDelete,
  onMove,
  onDuplicate,
  onConvertToRaw,
  onAddAbove,
  onAddBelow,
  onDragStart,
  onSlashTrigger,
  showSlashMenu,
  slashFilter,
  onSlashSelect,
  onSlashClose,
  docsDir,
  pageRelativePath,
}: BlockRendererProps) {
  return (
    <div
      className={`visual-block visual-block--${block.type}${selected ? " visual-block--selected" : ""}${dragging ? " visual-block--dragging" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="vb-block-controls-wrap">
        <button
          className="vb-drag-handle"
          title="Drag to reorder"
          onPointerDown={(e) => {
            e.preventDefault();
            onDragStart(e.clientY);
          }}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
            <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
            <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
          </svg>
        </button>
        <BlockActionsMenu
          isFirst={isFirst}
          isLast={isLast}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onConvertToRaw={onConvertToRaw}
          onDelete={onDelete}
          onAddAbove={onAddAbove}
          onAddBelow={onAddBelow}
        />
      </div>

      {block.type === "heading" && (
        <HeadingBlock
          level={block.level}
          text={block.text}
          onUpdate={onUpdate}
        />
      )}
      {block.type === "paragraph" && (
        <ParagraphBlock
          text={block.text}
          onUpdate={onUpdate}
          onSlashTrigger={onSlashTrigger}
          showSlashMenu={showSlashMenu}
          slashFilter={slashFilter}
          onSlashSelect={onSlashSelect}
          onSlashClose={onSlashClose}
        />
      )}
      {block.type === "image" && (
        <ImageBlock
          alt={block.alt}
          src={block.src}
          title={block.title}
          onUpdate={onUpdate}
          docsDir={docsDir}
          pageRelativePath={pageRelativePath}
        />
      )}
      {block.type === "code" && (
        <CodeBlock
          language={block.language}
          code={block.code}
          onUpdate={onUpdate}
        />
      )}
      {block.type === "admonition" && (
        <AdmonitionBlock
          kind={block.kind}
          title={block.title}
          body={block.body}
          collapsible={block.collapsible}
          onUpdate={onUpdate}
        />
      )}
      {block.type === "table" && (
        <TableBlock
          raw={block.raw}
          onUpdate={(raw) => onUpdate({ raw })}
        />
      )}
      {block.type === "frontmatter" && (
        <RawBlock
          label="Front Matter"
          markdown={block.raw}
          onUpdate={(md) => onUpdate({ raw: md })}
        />
      )}
      {block.type === "divider" && <div className="visual-divider" />}
      {block.type === "raw" && (
        <RawBlock
          label="Raw Markdown"
          markdown={block.markdown}
          onUpdate={(md) => onUpdate({ markdown: md })}
        />
      )}
      {block.type === "quote" && (
        <QuoteBlock text={block.text} onUpdate={onUpdate} />
      )}
      {block.type === "unordered-list" && (
        <ListBlock
          items={block.items}
          ordered={false}
          onUpdate={(items) => onUpdate({ items })}
        />
      )}
      {block.type === "ordered-list" && (
        <ListBlock
          items={block.items}
          ordered={true}
          onUpdate={(items) => onUpdate({ items })}
        />
      )}
      {block.type === "task-list" && (
        <TaskListBlock
          items={block.items}
          onUpdate={(items) => onUpdate({ items })}
        />
      )}
      {block.type === "definition-list" && (
        <DefinitionListBlock
          items={block.items}
          onUpdate={(items) => onUpdate({ items })}
        />
      )}
      {block.type === "grid-cards" && (
        <GridCardsBlock
          cards={block.cards}
          onUpdate={(cards) => onUpdate({ cards })}
        />
      )}
      {block.type === "content-tabs" && (
        <ContentTabsBlock
          tabs={block.tabs}
          onUpdate={(tabs) => onUpdate({ tabs })}
        />
      )}
      {block.type === "button" && (
        <ButtonBlock
          label={block.label}
          url={block.url}
          primary={block.primary}
          icon={block.icon}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// ── Individual Block Components ────────────────────────

function HeadingBlock({
  level,
  text,
  onUpdate,
}: {
  level: number;
  text: string;
  onUpdate: (patch: Partial<VisualBlock>) => void;
}) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <div className="visual-heading-block">
      <select
        className="visual-heading-level"
        value={level}
        onChange={(e) => onUpdate({ level: Number(e.target.value) })}
        title="Heading level"
      >
        {[1, 2, 3, 4, 5, 6].map((l) => (
          <option key={l} value={l}>
            H{l}
          </option>
        ))}
      </select>
      <Tag
        className="visual-heading-text"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ text: e.currentTarget.textContent || "" })}
      >
        {text}
      </Tag>
    </div>
  );
}

function ParagraphBlock({
  text,
  onUpdate,
  onSlashTrigger,
  showSlashMenu,
  slashFilter,
  onSlashSelect,
  onSlashClose,
}: {
  text: string;
  onUpdate: (patch: Partial<VisualBlock>) => void;
  onSlashTrigger: (filter: string) => void;
  showSlashMenu: boolean;
  slashFilter: string;
  onSlashSelect: (type: AddBlockType) => void;
  onSlashClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useAutoGrow(text);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    onUpdate({ text: val });

    if (val.startsWith("/")) {
      onSlashTrigger(val.slice(1));
    } else if (showSlashMenu) {
      onSlashClose();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlashMenu) {
      if (e.key === "Escape") {
        e.preventDefault();
        onSlashClose();
        return;
      }
      // Let the slash menu handle arrow/enter via its own handlers — forward via DOM
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        // We'll let the SlashMenu component handle these
        return;
      }
    }
  }

  if (editing) {
    return (
      <div className="visual-paragraph-wrap">
        <textarea
          ref={ref}
          className="visual-paragraph visual-paragraph--editing"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay blur so slash menu clicks register
            setTimeout(() => {
              if (!slashMenuRef.current?.contains(document.activeElement)) {
                setEditing(false);
                if (showSlashMenu) onSlashClose();
              }
            }, 150);
          }}
          autoFocus
          rows={1}
          placeholder="Type / for blocks"
        />
        {showSlashMenu && (
          <div className="visual-slash-menu" ref={slashMenuRef}>
            <SlashMenu
              filter={slashFilter}
              onSelect={onSlashSelect}
              onClose={onSlashClose}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`visual-paragraph${!text ? " visual-paragraph--empty" : ""}`}
      onClick={() => setEditing(true)}
    >
      {text ? renderInlineMarkdown(text) : <span className="visual-paragraph-placeholder">Type / for blocks</span>}
    </div>
  );
}

// ── Slash Menu (inline, below paragraph) ─────────────

function SlashMenu({
  filter,
  onSelect,
  onClose,
}: {
  filter: string;
  onSelect: (type: AddBlockType) => void;
  onClose: () => void;
}) {
  const [highlightIdx, setHighlightIdx] = useState(0);
  const filtered = filterBlockItems(addBlockCategories, filter);
  const flatItems = filtered.flatMap((cat) => cat.items);

  useEffect(() => {
    setHighlightIdx(0);
  }, [filter]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatItems.length > 0) {
        e.preventDefault();
        onSelect(flatItems[Math.min(highlightIdx, flatItems.length - 1)].type);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  });

  if (flatItems.length === 0) {
    return <div className="slash-menu-empty">No matching blocks</div>;
  }

  let flatIdx = 0;
  return (
    <div className="slash-menu-list">
      {filtered.map((cat) => (
        <div key={cat.name}>
          <div className="slash-menu-cat">{cat.name}</div>
          {cat.items.map((item) => {
            const idx = flatIdx++;
            return (
              <button
                key={item.type}
                className={`slash-menu-item${idx === highlightIdx ? " highlighted" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); onSelect(item.type); }}
                onMouseEnter={() => setHighlightIdx(idx)}
              >
                <span className="slash-menu-icon">{blockIcons[item.type]}</span>
                <span className="slash-menu-label">{item.label}</span>
                <span className="slash-menu-desc">{item.desc}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ImageBlock({
  alt,
  src,
  title,
  onUpdate,
  docsDir,
  pageRelativePath,
}: {
  alt: string;
  src: string;
  title: string;
  onUpdate: (patch: Partial<VisualBlock>) => void;
  docsDir: string;
  pageRelativePath: string;
}) {
  const [imgError, setImgError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  let resolvedSrc = src;
  if (src && !isExternalUrl(src)) {
    const resolved = resolveDocsAsset(docsDir, pageRelativePath, src);
    resolvedSrc = convertFileSrc(resolved.absolutePath);
  }

  const showImage = src && !imgError;

  return (
    <div className="visual-image-block">
      <div className="visual-image-preview">
        {showImage ? (
          <img
            src={resolvedSrc}
            alt={alt}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="visual-image-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span className="visual-image-placeholder-text">
              {src ? "Could not load image" : "No image source"}
            </span>
            {src && <span className="visual-image-placeholder-path">{src}</span>}
          </div>
        )}
      </div>
      <div className="visual-image-source-row">
        <input
          className="visual-field-input mono"
          value={src}
          onChange={(e) => onUpdate({ src: e.target.value })}
          placeholder="path/to/image.png"
        />
        <button
          className="visual-settings-toggle"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title="Image settings"
        >
          {settingsOpen ? "▾" : "▸"} Settings
        </button>
      </div>
      {settingsOpen && (
        <div className="visual-image-settings">
          <input
            className="visual-field-input"
            value={alt}
            onChange={(e) => onUpdate({ alt: e.target.value })}
            placeholder="Alt text"
          />
          <input
            className="visual-field-input"
            value={title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Title / caption"
          />
        </div>
      )}
    </div>
  );
}

function CodeBlock({
  language,
  code,
  onUpdate,
}: {
  language: string;
  code: string;
  onUpdate: (patch: Partial<VisualBlock>) => void;
}) {
  const ref = useAutoGrow(code);
  return (
    <div className="visual-code-block">
      <input
        className="visual-code-lang"
        value={language}
        onChange={(e) => onUpdate({ language: e.target.value })}
        placeholder="language"
      />
      <textarea
        ref={ref}
        className="visual-code-area"
        value={code}
        onChange={(e) => onUpdate({ code: e.target.value })}
        spellCheck={false}
        rows={3}
      />
    </div>
  );
}

function AdmonitionBlock({
  kind,
  title,
  body,
  collapsible,
  onUpdate,
}: {
  kind: string;
  title: string;
  body: string;
  collapsible: boolean;
  onUpdate: (patch: Partial<VisualBlock>) => void;
}) {
  const [editingBody, setEditingBody] = useState(false);
  const ref = useAutoGrow(body);
  const kinds = [
    "note", "abstract", "info", "tip", "success",
    "question", "warning", "failure", "danger", "bug",
    "example", "quote",
  ];
  return (
    <div className={`visual-admonition visual-admonition--${kind}`}>
      <div className="visual-admonition-header">
        <select
          className="visual-admonition-kind"
          value={kind}
          onChange={(e) => onUpdate({ kind: e.target.value })}
          title="Callout type"
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          className="visual-admonition-title"
          value={title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Title"
        />
        <label className="visual-admonition-collapse" title="Make collapsible">
          <input
            type="checkbox"
            checked={collapsible}
            onChange={(e) => onUpdate({ collapsible: e.target.checked })}
          />
          <span>▼</span>
        </label>
      </div>
      {editingBody ? (
        <textarea
          ref={ref}
          className="visual-admonition-body"
          value={body}
          onChange={(e) => onUpdate({ body: e.target.value })}
          onBlur={() => setEditingBody(false)}
          autoFocus
          rows={2}
        />
      ) : (
        <div
          className="visual-admonition-body visual-admonition-body--rendered"
          onClick={() => setEditingBody(true)}
        >
          {body.split("\n").map((line, i) => (
            <div key={i}>{renderInlineMarkdown(line) || " "}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteBlock({
  text,
  onUpdate,
}: {
  text: string;
  onUpdate: (patch: Partial<VisualBlock>) => void;
}) {
  const ref = useAutoGrow(text);
  return (
    <div className="visual-quote-block">
      <div className="visual-quote-bar" />
      <textarea
        ref={ref}
        className="visual-quote-area"
        value={text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        rows={2}
        placeholder="Quote text..."
      />
    </div>
  );
}

function ListBlock({
  items,
  ordered,
  onUpdate,
}: {
  items: ListItem[];
  ordered: boolean;
  onUpdate: (items: ListItem[]) => void;
}) {
  function updateItem(index: number, text: string) {
    const copy = [...items];
    copy[index] = { ...copy[index], text };
    onUpdate(copy);
  }
  function addItem() {
    onUpdate([...items, { text: "" }]);
  }
  function removeItem(index: number) {
    onUpdate(items.filter((_, i) => i !== index));
  }
  function moveItem(index: number, dir: "up" | "down") {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onUpdate(copy);
  }

  return (
    <div className="visual-list-block">
      {items.map((item, idx) => (
        <div key={idx} className="visual-list-item">
          <span className="visual-list-marker">
            {ordered ? `${idx + 1}.` : "•"}
          </span>
          <input
            className="visual-list-input"
            value={item.text}
            onChange={(e) => updateItem(idx, e.target.value)}
            placeholder="List item..."
          />
          <div className="visual-list-item-actions">
            <button
              className="visual-list-item-btn"
              onClick={() => moveItem(idx, "up")}
              disabled={idx === 0}
              title="Move up"
            >
              ↑
            </button>
            <button
              className="visual-list-item-btn"
              onClick={() => moveItem(idx, "down")}
              disabled={idx === items.length - 1}
              title="Move down"
            >
              ↓
            </button>
            <button
              className="visual-list-item-btn danger"
              onClick={() => removeItem(idx)}
              title="Remove"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button className="visual-list-add" onClick={addItem}>
        + Add item
      </button>
    </div>
  );
}

function TaskListBlock({
  items,
  onUpdate,
}: {
  items: ListItem[];
  onUpdate: (items: ListItem[]) => void;
}) {
  function updateItem(index: number, patch: Partial<ListItem>) {
    const copy = [...items];
    copy[index] = { ...copy[index], ...patch };
    onUpdate(copy);
  }
  function addItem() {
    onUpdate([...items, { text: "", checked: false }]);
  }
  function removeItem(index: number) {
    onUpdate(items.filter((_, i) => i !== index));
  }

  return (
    <div className="visual-list-block">
      {items.map((item, idx) => (
        <div key={idx} className="visual-list-item">
          <input
            type="checkbox"
            className="visual-task-check"
            checked={item.checked ?? false}
            onChange={(e) => updateItem(idx, { checked: e.target.checked })}
          />
          <input
            className="visual-list-input"
            value={item.text}
            onChange={(e) => updateItem(idx, { text: e.target.value })}
            placeholder="Task..."
            style={{
              textDecoration: item.checked ? "line-through" : "none",
              opacity: item.checked ? 0.5 : 1,
            }}
          />
          <button
            className="visual-list-item-btn danger"
            onClick={() => removeItem(idx)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button className="visual-list-add" onClick={addItem}>
        + Add task
      </button>
    </div>
  );
}

function DefinitionListBlock({
  items,
  onUpdate,
}: {
  items: DefItem[];
  onUpdate: (items: DefItem[]) => void;
}) {
  function updateItem(index: number, patch: Partial<DefItem>) {
    const copy = [...items];
    copy[index] = { ...copy[index], ...patch };
    onUpdate(copy);
  }
  function addItem() {
    onUpdate([...items, { term: "", definition: "" }]);
  }
  function removeItem(index: number) {
    onUpdate(items.filter((_, i) => i !== index));
  }

  return (
    <div className="visual-deflist-block">
      {items.map((item, idx) => (
        <div key={idx} className="visual-deflist-pair">
          <input
            className="visual-deflist-term"
            value={item.term}
            onChange={(e) => updateItem(idx, { term: e.target.value })}
            placeholder="Term"
          />
          <textarea
            className="visual-deflist-def"
            value={item.definition}
            onChange={(e) => updateItem(idx, { definition: e.target.value })}
            placeholder="Definition"
            rows={1}
          />
          <button
            className="visual-deflist-remove"
            onClick={() => removeItem(idx)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button className="visual-list-add" onClick={addItem}>
        + Add definition
      </button>
    </div>
  );
}

// ── Grid Cards — preview-first design ─────────────────

function GridCardsBlock({
  cards,
  onUpdate,
}: {
  cards: GridCard[];
  onUpdate: (cards: GridCard[]) => void;
}) {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  function updateCard(index: number, patch: Partial<GridCard>) {
    const copy = [...cards];
    copy[index] = { ...copy[index], ...patch };
    onUpdate(copy);
  }
  function addCard() {
    onUpdate([
      ...cards,
      {
        icon: ":material-star:",
        title: "New Card",
        description: "Card description.",
        linkLabel: "Read more",
        linkUrl: "index.md",
      },
    ]);
  }
  function removeCard(index: number) {
    onUpdate(cards.filter((_, i) => i !== index));
    if (expandedCard === index) setExpandedCard(null);
  }
  function duplicateCard(index: number) {
    const copy = [...cards];
    copy.splice(index + 1, 0, { ...cards[index] });
    onUpdate(copy);
  }

  return (
    <div className="visual-grid-cards">
      <div className="visual-grid-cards-list">
        {cards.map((card, idx) => (
          <div key={idx} className="visual-grid-card">
            <div className="visual-gc-top">
              <div className="visual-gc-icon-wrap">
                {card.icon ? (
                  <IconShortcode shortcode={card.icon} size={22} />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                )}
              </div>
              <input
                className="visual-gc-title"
                value={card.title}
                onChange={(e) => updateCard(idx, { title: e.target.value })}
                placeholder="Card title"
              />
              <div className="visual-gc-card-actions">
                <button
                  className="visual-gc-action-btn"
                  onClick={() => setExpandedCard(expandedCard === idx ? null : idx)}
                  title="Edit details"
                >
                  ⋯
                </button>
                <button
                  className="visual-gc-action-btn"
                  onClick={() => duplicateCard(idx)}
                  title="Duplicate"
                >
                  ⧉
                </button>
                <button
                  className="visual-gc-action-btn visual-gc-action-danger"
                  onClick={() => removeCard(idx)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
            <div
              className="visual-gc-desc"
              onClick={(e) => {
                const target = e.currentTarget;
                const ta = target.nextElementSibling as HTMLTextAreaElement | null;
                if (ta && ta.tagName === "TEXTAREA") {
                  ta.style.display = "block";
                  target.style.display = "none";
                  ta.focus();
                }
              }}
            >
              {renderInlineMarkdown(card.description) || <span style={{ opacity: 0.4 }}>Card description...</span>}
            </div>
            <textarea
              className="visual-gc-desc-edit"
              value={card.description}
              onChange={(e) => updateCard(idx, { description: e.target.value })}
              placeholder="Card description..."
              rows={2}
              style={{ display: "none" }}
              onBlur={(e) => {
                e.currentTarget.style.display = "none";
                const rendered = e.currentTarget.previousElementSibling as HTMLElement | null;
                if (rendered) rendered.style.display = "";
              }}
            />
            {card.linkLabel && (
              <div className="visual-gc-link-preview">
                <span className="visual-gc-link-btn">{renderInlineMarkdown(card.linkLabel)}</span>
              </div>
            )}
            {expandedCard === idx && (
              <div className="visual-gc-details">
                <div className="visual-gc-detail-row">
                  <span className="visual-gc-detail-label">Icon</span>
                  <IconField
                    value={card.icon}
                    onChange={(icon) => updateCard(idx, { icon })}
                  />
                </div>
                <div className="visual-gc-detail-row">
                  <span className="visual-gc-detail-label">Link label</span>
                  <input
                    className="visual-field-input"
                    value={card.linkLabel}
                    onChange={(e) => updateCard(idx, { linkLabel: e.target.value })}
                    placeholder="Read more"
                  />
                </div>
                <div className="visual-gc-detail-row">
                  <span className="visual-gc-detail-label">Link URL</span>
                  <input
                    className="visual-field-input mono"
                    value={card.linkUrl}
                    onChange={(e) => updateCard(idx, { linkUrl: e.target.value })}
                    placeholder="index.md"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="visual-list-add" onClick={addCard}>
        + Add card
      </button>
    </div>
  );
}

function ContentTabsBlock({
  tabs,
  onUpdate,
}: {
  tabs: TabItem[];
  onUpdate: (tabs: TabItem[]) => void;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const ref = useAutoGrow(tabs[activeTab]?.content ?? "");

  function updateTab(index: number, patch: Partial<TabItem>) {
    const copy = [...tabs];
    copy[index] = { ...copy[index], ...patch };
    onUpdate(copy);
  }
  function addTab() {
    onUpdate([...tabs, { label: `Tab ${tabs.length + 1}`, content: "" }]);
  }
  function removeTab(index: number) {
    const copy = tabs.filter((_, i) => i !== index);
    onUpdate(copy);
    if (activeTab >= copy.length) setActiveTab(Math.max(0, copy.length - 1));
  }
  function moveTab(index: number, dir: "left" | "right") {
    const target = dir === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= tabs.length) return;
    const copy = [...tabs];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onUpdate(copy);
    setActiveTab(target);
  }

  return (
    <div className="visual-tabs-block">
      <div className="visual-tabs-bar">
        {tabs.map((tab, idx) => (
          <div
            key={idx}
            className={`visual-tab-label${idx === activeTab ? " active" : ""}`}
            onClick={() => setActiveTab(idx)}
          >
            <input
              className="visual-tab-label-input"
              value={tab.label}
              onChange={(e) => updateTab(idx, { label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="visual-tab-actions">
              <button
                className="visual-tab-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTab(idx, "left");
                }}
                disabled={idx === 0}
                title="Move left"
              >
                ←
              </button>
              <button
                className="visual-tab-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTab(idx, "right");
                }}
                disabled={idx === tabs.length - 1}
                title="Move right"
              >
                →
              </button>
              <button
                className="visual-tab-action-btn danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(idx);
                }}
                title="Remove tab"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        <button className="visual-tab-add" onClick={addTab} title="Add tab">
          +
        </button>
      </div>
      {tabs[activeTab] && (
        <textarea
          ref={ref}
          className="visual-tab-content"
          value={tabs[activeTab].content}
          onChange={(e) => updateTab(activeTab, { content: e.target.value })}
          rows={3}
          placeholder="Tab content..."
        />
      )}
    </div>
  );
}

function ButtonBlock({
  label,
  url,
  primary,
  icon,
  onUpdate,
}: {
  label: string;
  url: string;
  primary: boolean;
  icon: string;
  onUpdate: (patch: Partial<VisualBlock>) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="visual-button-block">
      <div className="visual-button-row">
        <span className={`visual-button-chip${primary ? " primary" : ""}`}>
          {icon && <IconShortcode shortcode={icon} size={16} />}
          <input
            className="visual-button-label-input"
            value={label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Button text"
          />
        </span>
        <button
          className="visual-settings-toggle"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title="Button settings"
        >
          {settingsOpen ? "▾" : "▸"} Settings
        </button>
      </div>
      {settingsOpen && (
        <div className="visual-button-settings">
          <input
            className="visual-field-input mono"
            value={url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="URL (e.g. index.md)"
          />
          <IconField
            value={icon}
            onChange={(v) => onUpdate({ icon: v })}
          />
          <label className="visual-toggle-label">
            <input
              type="checkbox"
              checked={primary}
              onChange={(e) => onUpdate({ primary: e.target.checked })}
            />
            <span>Primary style</span>
          </label>
        </div>
      )}
    </div>
  );
}

function TableBlock({
  raw,
  onUpdate,
}: {
  raw: string;
  onUpdate: (raw: string) => void;
}) {
  const rows = raw.split("\n").filter((l) => l.trim().startsWith("|"));
  const isSeparator = (row: string) => /^\|[\s:|-]+$/.test(row.trim()) && /---/.test(row);
  const dataRows = rows.filter((r) => !isSeparator(r));
  const cells = dataRows.map((row) =>
    row
      .split("|")
      .filter((_, i, arr) => i > 0 && i < arr.length - 1)
      .map((c) => c.trim()),
  );

  const numCols = cells.length > 0 ? cells[0].length : 0;

  function updateCell(row: number, col: number, value: string) {
    const updated = cells.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? value : c)),
    );
    rebuildTable(updated);
  }

  function addRow() {
    const newRow = Array(numCols).fill("");
    const updated = [...cells, newRow];
    rebuildTable(updated);
  }

  function removeRow(index: number) {
    if (cells.length <= 1) return;
    rebuildTable(cells.filter((_, i) => i !== index));
  }

  function addColumn() {
    const updated = cells.map((row, idx) => [
      ...row,
      idx === 0 ? "Column" : "",
    ]);
    rebuildTable(updated);
  }

  function removeColumn(col: number) {
    if (numCols <= 1) return;
    const updated = cells.map((row) => row.filter((_, ci) => ci !== col));
    rebuildTable(updated);
  }

  function rebuildTable(data: string[][]) {
    if (data.length === 0) return;
    const cols = data[0].length;
    const widths = Array(cols).fill(0);
    for (const row of data) {
      for (let c = 0; c < cols; c++) {
        widths[c] = Math.max(widths[c], (row[c] || "").length, 3);
      }
    }

    const lines: string[] = [];
    lines.push(
      "| " + data[0].map((c, ci) => c.padEnd(widths[ci])).join(" | ") + " |",
    );
    lines.push(
      "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |",
    );
    for (let r = 1; r < data.length; r++) {
      lines.push(
        "| " +
          data[r].map((c, ci) => (c || "").padEnd(widths[ci])).join(" | ") +
          " |",
      );
    }
    onUpdate(lines.join("\n"));
  }

  if (cells.length === 0 || numCols === 0) {
    return (
      <RawBlock label="Table" markdown={raw} onUpdate={onUpdate} />
    );
  }

  return (
    <div className="visual-table-block">
      <div className="visual-table-scroll">
        <table className="visual-table">
          <thead>
            <tr>
              {cells[0].map((cell, ci) => (
                <th key={ci}>
                  <input
                    className="visual-table-cell"
                    value={cell}
                    onChange={(e) => updateCell(0, ci, e.target.value)}
                  />
                  <button
                    className="visual-table-col-remove"
                    onClick={() => removeColumn(ci)}
                    title="Remove column"
                  >
                    ×
                  </button>
                </th>
              ))}
              <th className="visual-table-add-col">
                <button onClick={addColumn} title="Add column">
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {cells.slice(1).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      className="visual-table-cell"
                      value={cell}
                      onChange={(e) =>
                        updateCell(ri + 1, ci, e.target.value)
                      }
                    />
                  </td>
                ))}
                <td className="visual-table-row-remove">
                  <button onClick={() => removeRow(ri + 1)} title="Remove row">
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="visual-list-add" onClick={addRow}>
        + Add row
      </button>
    </div>
  );
}

function RawBlock({
  label,
  markdown,
  onUpdate,
}: {
  label: string;
  markdown: string;
  onUpdate: (md: string) => void;
}) {
  const ref = useAutoGrow(markdown);
  return (
    <div className="visual-raw-block">
      <span className="visual-raw-label">{label}</span>
      <textarea
        ref={ref}
        className="visual-raw-area"
        value={markdown}
        onChange={(e) => onUpdate(e.target.value)}
        spellCheck={false}
        rows={2}
      />
    </div>
  );
}

// ── Icon helpers ──────────────────────────────────────

function IconField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="visual-icon-field">
      <div className="visual-icon-field-row">
        {value && <IconShortcode shortcode={value} size={16} />}
        <input
          className="visual-field-input mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=":material-icon:"
        />
        {value && (
          <button
            className="visual-icon-clear"
            onClick={() => onChange("")}
            title="Clear icon"
          >
            ×
          </button>
        )}
        <button
          className="visual-icon-picker-btn"
          onClick={() => setPickerOpen(!pickerOpen)}
          title="Pick icon"
        >
          ⋯
        </button>
      </div>
      {pickerOpen && (
        <IconPicker
          onSelect={(shortcode) => {
            onChange(shortcode);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

export default VisualEditor;
