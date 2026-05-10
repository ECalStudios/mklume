/**
 * useLinkAutocomplete — detects `[[` and `[text](` triggers in a textarea
 * and manages autocomplete state.
 *
 * Trigger modes:
 *   1. Wiki-link: user types `[[` → triggers autocomplete, replaces `[[query` with `[Title](path.md)`
 *   2. Markdown link: user types `[some text](` → triggers autocomplete, inserts only the path
 */
import { useState, useCallback, useRef } from "react";

export type AutocompleteMode = "wiki" | "mdlink" | null;

export interface AutocompleteState {
  /** Whether autocomplete is active */
  active: boolean;
  /** Trigger mode */
  mode: AutocompleteMode;
  /** The search query typed after the trigger */
  query: string;
  /** Position in content where the trigger starts (for replacement) */
  triggerStart: number;
  /** Position in content where the query ends (cursor position) */
  triggerEnd: number;
  /** The link label text for mdlink mode (text inside []) */
  linkLabel: string;
  /** Pixel position for floating menu (set by the component) */
  menuPosition: { top: number; left: number } | null;
}

const INITIAL_STATE: AutocompleteState = {
  active: false,
  mode: null,
  query: "",
  triggerStart: 0,
  triggerEnd: 0,
  linkLabel: "",
  menuPosition: null,
};

/**
 * Detect autocomplete triggers in text content at a given cursor position.
 *
 * Returns trigger info or null if no trigger is active.
 */
export function detectTrigger(
  content: string,
  cursorPos: number,
): { mode: AutocompleteMode; query: string; triggerStart: number; linkLabel: string } | null {
  // Don't trigger if cursor is at start
  if (cursorPos < 2) return null;

  // Look backward from cursor to find triggers
  const before = content.substring(0, cursorPos);

  // Check for wiki-link trigger: [[query
  // Find the last `[[` that doesn't have a closing `]]`
  const wikiIdx = before.lastIndexOf("[[");
  if (wikiIdx !== -1) {
    const afterBrackets = before.substring(wikiIdx + 2);
    // Must not contain `]]` or newlines (single-line trigger only)
    if (!afterBrackets.includes("]]") && !afterBrackets.includes("\n")) {
      // Make sure it's not inside a markdown link like [text](url)
      // Check that there's no `]` between [[ and cursor (or if there is, it's the start)
      return {
        mode: "wiki",
        query: afterBrackets,
        triggerStart: wikiIdx,
        linkLabel: "",
      };
    }
  }

  // Check for markdown link trigger: [text](query
  // Find the last unmatched `](`
  const mdLinkIdx = before.lastIndexOf("](");
  if (mdLinkIdx !== -1) {
    const afterParen = before.substring(mdLinkIdx + 2);
    // Must not contain `)` or newlines
    if (!afterParen.includes(")") && !afterParen.includes("\n")) {
      // Find the matching `[` for the `](`
      const bracketContent = before.substring(0, mdLinkIdx);
      const openIdx = bracketContent.lastIndexOf("[");
      if (openIdx !== -1) {
        const linkLabel = before.substring(openIdx + 1, mdLinkIdx);
        // Ensure the [ isn't preceded by ! (image) or another [
        const charBefore = openIdx > 0 ? before[openIdx - 1] : "";
        if (charBefore !== "!" && charBefore !== "[") {
          return {
            mode: "mdlink",
            query: afterParen,
            triggerStart: mdLinkIdx + 2, // Start of the path portion
            linkLabel,
          };
        }
      }
    }
  }

  return null;
}

export function useLinkAutocomplete() {
  const [state, setState] = useState<AutocompleteState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track dismissed trigger position so Escape doesn't immediately re-open.
  // Cleared when the trigger start position changes (user edits or moves cursor).
  const dismissedRef = useRef<{ triggerStart: number; cursorPos: number } | null>(null);

  /**
   * Call this on every content change or cursor movement to check for triggers.
   */
  const checkTrigger = useCallback((content: string, cursorPos: number) => {
    const trigger = detectTrigger(content, cursorPos);

    if (trigger) {
      // Skip re-opening if this trigger was just dismissed at the same position
      const d = dismissedRef.current;
      if (d && d.triggerStart === trigger.triggerStart && d.cursorPos === cursorPos) {
        return;
      }
      // Clear dismissed state if trigger position changed
      if (d && d.triggerStart !== trigger.triggerStart) {
        dismissedRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        active: true,
        mode: trigger.mode,
        query: trigger.query,
        triggerStart: trigger.triggerStart,
        triggerEnd: cursorPos,
        linkLabel: trigger.linkLabel,
      }));
    } else {
      dismissedRef.current = null;
      if (stateRef.current.active) {
        setState(INITIAL_STATE);
      }
    }
  }, []);

  /**
   * Close the autocomplete (e.g. on Escape).
   * Records the dismissed position to prevent immediate re-opening.
   */
  const close = useCallback(() => {
    const s = stateRef.current;
    if (s.active) {
      dismissedRef.current = { triggerStart: s.triggerStart, cursorPos: s.triggerEnd };
    }
    setState(INITIAL_STATE);
  }, []);

  /**
   * Set the menu position (called by the component when calculating coordinates).
   */
  const setMenuPosition = useCallback((pos: { top: number; left: number } | null) => {
    setState((prev) => ({ ...prev, menuPosition: pos }));
  }, []);

  /**
   * Build the replacement text when a page is selected.
   *
   * For wiki mode (`[[query`):
   *   Replace from triggerStart to triggerEnd with `[Title](relative/path.md)`
   *
   * For mdlink mode (`[text](query`):
   *   Replace from triggerStart to triggerEnd with `relative/path.md)`
   */
  const buildReplacement = useCallback(
    (
      content: string,
      title: string,
      relativePath: string,
    ): { newContent: string; cursorPos: number } | null => {
      const s = stateRef.current;
      if (!s.active || !s.mode) return null;

      if (s.mode === "wiki") {
        // Replace `[[query` with `[Title](path.md)`
        const replacement = `[${title}](${relativePath})`;
        const newContent =
          content.substring(0, s.triggerStart) +
          replacement +
          content.substring(s.triggerEnd);
        return {
          newContent,
          cursorPos: s.triggerStart + replacement.length,
        };
      }

      if (s.mode === "mdlink") {
        // Replace just the path portion and add closing paren
        const replacement = `${relativePath})`;
        const newContent =
          content.substring(0, s.triggerStart) +
          replacement +
          content.substring(s.triggerEnd);
        return {
          newContent,
          cursorPos: s.triggerStart + replacement.length,
        };
      }

      return null;
    },
    [],
  );

  return {
    state,
    checkTrigger,
    close,
    setMenuPosition,
    buildReplacement,
  };
}
