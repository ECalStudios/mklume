import { useState, useRef, useEffect, useCallback } from "react";

interface FindReplaceProps {
  open: boolean;
  showReplace: boolean;
  content: string;
  onChange: (content: string) => void;
  onClose: () => void;
  /** Ref to the textarea so we can control selection */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function FindReplace({
  open,
  showReplace,
  content,
  onChange,
  onClose,
  textareaRef,
}: FindReplaceProps) {
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, showReplace]);

  // Get all match positions
  const getMatches = useCallback((): number[] => {
    if (!searchText) return [];
    const src = caseSensitive ? content : content.toLowerCase();
    const needle = caseSensitive ? searchText : searchText.toLowerCase();
    const positions: number[] = [];
    let idx = 0;
    while (idx < src.length) {
      const found = src.indexOf(needle, idx);
      if (found === -1) break;
      positions.push(found);
      idx = found + 1;
    }
    return positions;
  }, [content, searchText, caseSensitive]);

  const matches = getMatches();
  const totalMatches = matches.length;

  // Clamp current match
  useEffect(() => {
    if (currentMatch >= totalMatches) setCurrentMatch(Math.max(0, totalMatches - 1));
  }, [totalMatches, currentMatch]);

  // Highlight current match in textarea
  useEffect(() => {
    if (!searchText || totalMatches === 0) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = matches[currentMatch];
    if (pos === undefined) return;
    // Only focus the textarea if the search/replace inputs don't have focus
    // (otherwise we'd steal focus from the input on every keystroke)
    const activeEl = document.activeElement;
    const isFindInputFocused =
      activeEl === searchRef.current ||
      (activeEl instanceof HTMLInputElement && activeEl.closest(".find-replace-bar"));
    if (!isFindInputFocused) {
      ta.focus();
    }
    ta.setSelectionRange(pos, pos + searchText.length);
    // Scroll into view — move the textarea scroll so selection is visible
    // Simple approach: set scrollTop proportional to position
    const linesBefore = content.substring(0, pos).split("\n").length;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (linesBefore - 3) * lineHeight);
  }, [currentMatch, matches, searchText, totalMatches, content, textareaRef]);

  function goNext() {
    if (totalMatches === 0) return;
    setCurrentMatch((i) => (i + 1) % totalMatches);
  }

  function goPrev() {
    if (totalMatches === 0) return;
    setCurrentMatch((i) => (i - 1 + totalMatches) % totalMatches);
  }

  function replaceCurrent() {
    if (totalMatches === 0 || !searchText) return;
    const pos = matches[currentMatch];
    if (pos === undefined) return;
    const newContent =
      content.substring(0, pos) +
      replaceText +
      content.substring(pos + searchText.length);
    onChange(newContent);
    // Keep cursor at replacement end
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const end = pos + replaceText.length;
        ta.setSelectionRange(end, end);
      }
    });
  }

  function replaceAll() {
    if (totalMatches === 0 || !searchText) return;
    let result = content;
    if (caseSensitive) {
      result = result.split(searchText).join(replaceText);
    } else {
      const regex = new RegExp(escapeRegex(searchText), "gi");
      result = result.replace(regex, replaceText);
    }
    onChange(result);
    setCurrentMatch(0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      goNext();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      goPrev();
    }
  }

  if (!open) return null;

  return (
    <div className="find-replace-bar" onKeyDown={handleKeyDown}>
      <div className="find-replace-row">
        <div className="find-replace-field">
          <input
            ref={searchRef}
            className="find-replace-input"
            type="text"
            placeholder="Find..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentMatch(0); }}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="find-replace-count">
            {searchText ? `${totalMatches > 0 ? currentMatch + 1 : 0}/${totalMatches}` : ""}
          </span>
        </div>

        <button className="find-replace-btn" onClick={goPrev} disabled={totalMatches === 0} title="Previous (Shift+Enter)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        <button className="find-replace-btn" onClick={goNext} disabled={totalMatches === 0} title="Next (Enter)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <button
          className={`find-replace-btn toggle${caseSensitive ? " active" : ""}`}
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="Case sensitive"
        >
          Aa
        </button>

        <button className="find-replace-btn close" onClick={onClose} title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      {showReplace && (
        <div className="find-replace-row">
          <div className="find-replace-field">
            <input
              className="find-replace-input"
              type="text"
              placeholder="Replace..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button className="find-replace-btn" onClick={replaceCurrent} disabled={totalMatches === 0} title="Replace current">
            Replace
          </button>
          <button className="find-replace-btn" onClick={replaceAll} disabled={totalMatches === 0} title="Replace all">
            All
          </button>
        </div>
      )}
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default FindReplace;
