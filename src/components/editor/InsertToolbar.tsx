import { useState, useRef, useEffect } from "react";
import type { BlockType } from "../../utils/insertBlock";

interface InsertToolbarProps {
  onInsert: (type: BlockType) => void;
}

interface BlockItem {
  type: BlockType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

interface BlockCategory {
  name: string;
  items: BlockItem[];
}

// ── SVG icon helper ──────────────────────────────────────

function I({ children }: { children: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function I18({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

// ── Quick toolbar items (always visible) ─────────────────

const quickItems: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: "heading", label: "Heading", icon: <><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /></> },
  { type: "note", label: "Note", icon: <circle cx="12" cy="12" r="10" /> },
  { type: "tip", label: "Tip", icon: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></> },
  { type: "warning", label: "Warning", icon: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></> },
  { type: "code", label: "Code Block", icon: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></> },
  { type: "table", label: "Table", icon: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /></> },
  { type: "link", label: "Link", icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></> },
  { type: "image", label: "Image", icon: <><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></> },
];

// ── Palette categories ───────────────────────────────────

const categories: BlockCategory[] = [
  {
    name: "Text",
    items: [
      { type: "quote", label: "Quote", desc: "Blockquote text", icon: <><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></> },
    ],
  },
  {
    name: "Lists",
    items: [
      { type: "bullet-list", label: "Bullet List", desc: "Unordered list items", icon: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></> },
      { type: "numbered-list", label: "Numbered List", desc: "Ordered list items", icon: <><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></> },
      { type: "task-list", label: "Task List", desc: "Checklist with checkboxes", icon: <><rect x="3" y="5" width="6" height="6" rx="1" /><path d="m3.5 8 2 2L9 6" /><line x1="13" y1="8" x2="21" y2="8" /><rect x="3" y="14" width="6" height="6" rx="1" /><line x1="13" y1="17" x2="21" y2="17" /></> },
      { type: "definition-list", label: "Definitions", desc: "Term and definition pairs", icon: <><path d="M4 7h16" /><path d="M8 11h12" /><path d="M4 15h16" /><path d="M8 19h12" /></> },
    ],
  },
  {
    name: "Callouts",
    items: [
      { type: "note", label: "Note", desc: "Highlight important info", icon: <circle cx="12" cy="12" r="10" /> },
      { type: "info", label: "Info", desc: "Informational callout", icon: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></> },
      { type: "tip", label: "Tip", desc: "Helpful tip or suggestion", icon: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></> },
      { type: "success", label: "Success", desc: "Success confirmation", icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></> },
      { type: "warning", label: "Warning", desc: "Cautionary warning", icon: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></> },
      { type: "danger", label: "Danger", desc: "Critical danger alert", icon: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M2.5 17L12 3l9.5 14z" /></> },
      { type: "question", label: "Question", desc: "Question or FAQ", icon: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></> },
      { type: "bug", label: "Bug", desc: "Bug report callout", icon: <><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></> },
      { type: "example", label: "Example", desc: "Example section", icon: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 4v4" /><path d="M2 8h20" /><path d="M6 4v4" /></> },
      { type: "details", label: "Expandable", desc: "Collapsible details block", icon: <path d="m9 18 6-6-6-6" /> },
    ],
  },
  {
    name: "Layout",
    items: [
      { type: "tabs", label: "Content Tabs", desc: "Tabbed content sections", icon: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 3v6" /></> },
      { type: "grid-cards", label: "Grid Cards", desc: "Material card grid layout", icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="9" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /><rect x="14" y="15" width="7" height="6" rx="1" /></> },
      { type: "button", label: "Button", desc: "Material styled button link", icon: <><rect x="4" y="8" width="16" height="8" rx="2" /><path d="M12 8v8" /></> },
      { type: "table", label: "Table", desc: "Markdown data table", icon: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /></> },
      { type: "divider", label: "Divider", desc: "Horizontal rule", icon: <path d="M3 12h18" /> },
    ],
  },
  {
    name: "Media",
    items: [
      { type: "image", label: "Image", desc: "Insert an image reference", icon: <><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></> },
      { type: "link", label: "Link", desc: "Inline hyperlink", icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></> },
      { type: "code", label: "Code Block", desc: "Fenced code block", icon: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></> },
    ],
  },
  {
    name: "Advanced",
    items: [
      { type: "front-matter", label: "Front Matter", desc: "YAML page metadata block", icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6" /><path d="M9 11h6" /></> },
    ],
  },
];

// ── InsertToolbar ────────────────────────────────────────

function InsertToolbar({ onInsert }: InsertToolbarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Close palette on outside click
  useEffect(() => {
    if (!paletteOpen) return;
    function handleClick(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [paletteOpen]);

  function handleInsert(type: BlockType) {
    setPaletteOpen(false);
    onInsert(type);
  }

  return (
    <div className="insert-toolbar" ref={paletteRef}>
      <span className="insert-toolbar-label">Insert</span>

      {/* Quick buttons */}
      <div className="insert-toolbar-group">
        {quickItems.map((item) => (
          <button
            key={item.type}
            className="insert-toolbar-btn"
            title={item.label}
            onMouseDown={(e) => { e.preventDefault(); onInsert(item.type); }}
          >
            <I>{item.icon}</I>
          </button>
        ))}
      </div>

      <span className="insert-toolbar-sep" />

      {/* "More" button opens palette */}
      <button
        className={`insert-toolbar-btn insert-more-btn${paletteOpen ? " active" : ""}`}
        title="More blocks"
        onMouseDown={(e) => { e.preventDefault(); setPaletteOpen(!paletteOpen); }}
      >
        <I>
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </I>
        <span className="insert-more-label">More</span>
      </button>

      {/* Palette dropdown */}
      {paletteOpen && (
        <div className="insert-palette">
          {categories.map((cat) => (
            <div className="insert-palette-category" key={cat.name}>
              <span className="insert-palette-cat-label">{cat.name}</span>
              <div className="insert-palette-items">
                {cat.items.map((item) => (
                  <button
                    key={item.type}
                    className="insert-palette-item"
                    onMouseDown={(e) => { e.preventDefault(); handleInsert(item.type); }}
                  >
                    <span className="insert-palette-icon"><I18>{item.icon}</I18></span>
                    <span className="insert-palette-text">
                      <span className="insert-palette-name">{item.label}</span>
                      <span className="insert-palette-desc">{item.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InsertToolbar;
