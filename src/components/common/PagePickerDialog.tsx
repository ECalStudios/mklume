/**
 * PagePickerDialog — command-palette-style dialog for selecting a page
 * to insert as an internal link.
 *
 * Used by the "Insert Internal Link" command.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import type { PageIndexEntry } from "../../hooks/usePageIndex";
import { searchPageIndex, computeRelativePath } from "../../hooks/usePageIndex";

interface PagePickerDialogProps {
  pageIndex: PageIndexEntry[];
  currentPagePath: string;
  onSelect: (title: string, relativePath: string) => void;
  onClose: () => void;
}

export default function PagePickerDialog({
  pageIndex,
  currentPagePath,
  onSelect,
  onClose,
}: PagePickerDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = searchPageIndex(pageIndex, query, currentPagePath);

  // Focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll(".page-picker-item");
    const selected = items[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (entry: PageIndexEntry) => {
      const relPath = computeRelativePath(currentPagePath, entry.relativePath);
      onSelect(entry.title, relPath);
    },
    [currentPagePath, onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results.length > 0 && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, handleSelect, onClose],
  );

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        className="page-picker-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="page-picker-header">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="page-picker-search-icon"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="page-picker-input"
            placeholder="Search pages to link..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="page-picker-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="page-picker-empty">
              {query ? "No matching pages" : "No pages in project"}
            </div>
          ) : (
            results.map((entry, i) => (
              <button
                key={entry.relativePath}
                className={`page-picker-item${i === selectedIndex ? " selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(entry);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="page-picker-item-main">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="page-picker-item-icon"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                  <span className="page-picker-item-title">{entry.title}</span>
                  {!entry.inNav && <span className="page-picker-badge">unlisted</span>}
                </div>
                <div className="page-picker-item-path">
                  {entry.section && (
                    <span className="page-picker-item-section">{entry.section} / </span>
                  )}
                  {entry.relativePath}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="page-picker-footer">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
          <span><kbd>Enter</kbd> insert link</span>
          <span><kbd>Esc</kbd> cancel</span>
        </div>
      </div>
    </div>
  );
}
