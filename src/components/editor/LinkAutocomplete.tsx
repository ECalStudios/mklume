/**
 * LinkAutocomplete — floating dropdown that shows matching pages
 * when the user types `[[` or `[text](` in the Markdown editor.
 *
 * Positioned near the cursor in the textarea.
 * Keyboard navigation: Arrow Up/Down, Enter to select, Escape to close.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { PageIndexEntry } from "../../hooks/usePageIndex";
import { searchPageIndex, computeRelativePath } from "../../hooks/usePageIndex";
import type { AutocompleteState } from "../../hooks/useLinkAutocomplete";

interface LinkAutocompleteProps {
  /** Current autocomplete state */
  autocomplete: AutocompleteState;
  /** Full page index */
  pageIndex: PageIndexEntry[];
  /** Current page's relative path (for computing relative links) */
  currentPagePath: string;
  /** Reference to the textarea element */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Called when user selects a page */
  onSelect: (title: string, relativePath: string) => void;
  /** Called when user dismisses autocomplete */
  onClose: () => void;
}

const MAX_RESULTS = 12;

export default function LinkAutocomplete({
  autocomplete,
  pageIndex,
  currentPagePath,
  textareaRef,
  onSelect,
  onClose,
}: LinkAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search results
  const results = searchPageIndex(pageIndex, autocomplete.query, currentPagePath)
    .slice(0, MAX_RESULTS);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [autocomplete.query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll(".link-ac-item");
    const selected = items[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle keyboard events on the textarea
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!autocomplete.active) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
        case "Tab":
          if (results.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            const entry = results[selectedIndex];
            if (entry) {
              const relPath = computeRelativePath(currentPagePath, entry.relativePath);
              onSelect(entry.title, relPath);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    },
    [autocomplete.active, results, selectedIndex, currentPagePath, onSelect, onClose],
  );

  // Attach keyboard handler to textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !autocomplete.active) return;

    // Use capture phase to intercept before other handlers
    ta.addEventListener("keydown", handleKeyDown, true);
    return () => {
      ta.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [textareaRef, autocomplete.active, handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    if (!autocomplete.active) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [autocomplete.active, onClose]);

  if (!autocomplete.active || results.length === 0) return null;

  // Calculate position relative to the textarea
  const position = getMenuPosition(textareaRef.current, autocomplete.triggerEnd);

  return (
    <div
      ref={containerRef}
      className="link-ac-container"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="link-ac-header">
        {autocomplete.mode === "wiki" ? "Insert link" : "Select page"}
      </div>
      <div className="link-ac-list" ref={listRef}>
        {results.map((entry, i) => (
          <button
            key={entry.relativePath}
            className={`link-ac-item${i === selectedIndex ? " selected" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              const relPath = computeRelativePath(currentPagePath, entry.relativePath);
              onSelect(entry.title, relPath);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <div className="link-ac-item-main">
              <span className="link-ac-item-title">{entry.title}</span>
              {!entry.inNav && <span className="link-ac-badge">unlisted</span>}
            </div>
            <div className="link-ac-item-path">
              {entry.section && <span className="link-ac-item-section">{entry.section} / </span>}
              {entry.relativePath}
            </div>
          </button>
        ))}
      </div>
      <div className="link-ac-footer">
        <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
        <span><kbd>Enter</kbd> select</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  );
}

/**
 * Calculate the pixel position for the autocomplete menu
 * based on the cursor position in the textarea.
 */
function getMenuPosition(
  textarea: HTMLTextAreaElement | null,
  cursorPos: number,
): { top: number; left: number } {
  if (!textarea) return { top: 0, left: 0 };

  // Create a mirror div to measure cursor position
  const mirror = document.createElement("div");
  const style = window.getComputedStyle(textarea);

  // Copy textarea styles to mirror
  const props = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "textTransform", "wordSpacing", "textIndent", "paddingTop", "paddingRight",
    "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth",
    "borderBottomWidth", "borderLeftWidth", "boxSizing", "lineHeight",
    "whiteSpace", "wordWrap", "overflowWrap",
  ] as const;

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${textarea.clientWidth}px`;

  for (const prop of props) {
    (mirror.style as unknown as Record<string, string>)[prop] = style.getPropertyValue(
      prop.replace(/([A-Z])/g, "-$1").toLowerCase()
    );
  }

  // Insert text up to cursor, then a span for measurement
  const textBefore = textarea.value.substring(0, cursorPos);
  const textNode = document.createTextNode(textBefore);
  const marker = document.createElement("span");
  marker.textContent = "|";

  mirror.appendChild(textNode);
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  // Get position of marker relative to mirror
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const markerTop = markerRect.top - mirrorRect.top;
  const markerLeft = markerRect.left - mirrorRect.left;

  document.body.removeChild(mirror);

  // Get textarea position in viewport
  const taRect = textarea.getBoundingClientRect();
  // Get the content-body parent for relative positioning
  const contentBody = textarea.closest(".content-body");
  const parentRect = contentBody?.getBoundingClientRect() ?? taRect;

  // Calculate position relative to content-body
  const top = (taRect.top - parentRect.top) + markerTop - textarea.scrollTop + parseInt(style.lineHeight || "20", 10) + 4;
  const left = (taRect.left - parentRect.left) + markerLeft - textarea.scrollLeft;

  // Clamp left to prevent overflow
  const maxLeft = (contentBody?.clientWidth ?? 600) - 320;
  const clampedLeft = Math.max(8, Math.min(left, maxLeft));

  return { top, left: clampedLeft };
}
