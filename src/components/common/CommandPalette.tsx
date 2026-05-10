import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ALL_COMMANDS, CATEGORY_ORDER, type AppCommand, type CommandContext } from "../../commands/registry";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (commandId: string) => void;
  context: CommandContext;
}

/** Native browser commands — these are handled by the browser natively */
const NATIVE_COMMANDS = new Set([
  "edit.undo", "edit.redo", "edit.cut", "edit.copy", "edit.paste", "edit.selectAll",
]);

type ScoredCommand = AppCommand & { score: number; enabled: boolean; reason: string };

function CommandPalette({ open, onClose, onExecute, context }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Filter and score commands
  const filtered = useMemo((): ScoredCommand[] => {
    const q = query.toLowerCase().trim();
    const results: ScoredCommand[] = [];

    for (const cmd of ALL_COMMANDS) {
      // Skip native clipboard/undo commands — browser handles them
      if (NATIVE_COMMANDS.has(cmd.id)) continue;

      const enabled = !cmd.when || cmd.when(context);
      let reason = "";
      if (!enabled && cmd.disabledReason) {
        reason = typeof cmd.disabledReason === "function"
          ? cmd.disabledReason(context)
          : cmd.disabledReason;
      }

      const label = cmd.label.toLowerCase();
      const cat = cmd.category.toLowerCase();
      const aliasStr = cmd.aliases ? cmd.aliases.join(" ").toLowerCase() : "";
      const combined = `${cat} ${label} ${aliasStr}`;

      if (!q) {
        results.push({ ...cmd, score: 0, enabled, reason });
        continue;
      }

      // Exact substring match on label (highest priority)
      if (label.includes(q)) {
        const bonus = label.startsWith(q) ? 100 : 50;
        results.push({ ...cmd, score: bonus, enabled, reason });
        continue;
      }

      // Category match
      if (cat.includes(q)) {
        results.push({ ...cmd, score: 20, enabled, reason });
        continue;
      }

      // Alias match
      if (aliasStr.includes(q)) {
        results.push({ ...cmd, score: 30, enabled, reason });
        continue;
      }

      // Combined substring
      if (combined.includes(q)) {
        results.push({ ...cmd, score: 10, enabled, reason });
        continue;
      }

      // Fuzzy: all query chars appear in order
      let qi = 0;
      for (let i = 0; i < combined.length && qi < q.length; i++) {
        if (combined[i] === q[qi]) qi++;
      }
      if (qi === q.length) {
        results.push({ ...cmd, score: 1, enabled, reason });
      }
    }

    // Sort: enabled first, then by score descending
    results.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return b.score - a.score;
    });
    return results;
  }, [query, context]);

  // Clamp selection
  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // We need to find the actual item element by index across possible group headers
    const items = list.querySelectorAll("[data-cmd-index]");
    const target = Array.from(items).find(el => el.getAttribute("data-cmd-index") === String(selectedIndex));
    target?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const runCommand = useCallback((cmd: ScoredCommand) => {
    if (!cmd.enabled) return;
    onClose();
    onExecute(cmd.id);
  }, [onClose, onExecute]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) runCommand(cmd);
        break;
      }
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }

  if (!open) return null;

  const isSearching = query.trim().length > 0;

  // Group commands by category when not searching
  const grouped = !isSearching
    ? CATEGORY_ORDER.map((cat) => ({
        category: cat,
        commands: filtered.filter((c) => c.category === cat),
      })).filter((g) => g.commands.length > 0)
    : null;

  // Build flat index mapping for grouped view
  let flatIndex = 0;

  return (
    <div className="cmd-palette-overlay" onMouseDown={onClose}>
      <div className="cmd-palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Search input */}
        <div className="cmd-palette-input-wrap">
          <svg className="cmd-palette-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-palette-input"
            type="text"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmd-palette-kbd">Esc</kbd>
        </div>

        {/* Command list */}
        <div className="cmd-palette-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="cmd-palette-empty">
              <div className="cmd-palette-empty-title">No commands found</div>
              <div className="cmd-palette-empty-hint">
                Try searching for <em>save</em>, <em>preview</em>, <em>grid</em>, <em>image</em>, or <em>settings</em>
              </div>
            </div>
          )}

          {/* Grouped view (no search) */}
          {grouped && grouped.map((group) => {
            const header = (
              <div key={`header-${group.category}`} className="cmd-palette-group-header">
                {group.category}
              </div>
            );
            const items = group.commands.map((cmd) => {
              const idx = flatIndex++;
              return (
                <CommandRow
                  key={cmd.id}
                  cmd={cmd}
                  index={idx}
                  isSelected={idx === selectedIndex}
                  showCategory={false}
                  onSelect={setSelectedIndex}
                  onRun={runCommand}
                />
              );
            });
            return [header, ...items];
          })}

          {/* Flat search results */}
          {isSearching && filtered.map((cmd, i) => (
            <CommandRow
              key={cmd.id}
              cmd={cmd}
              index={i}
              isSelected={i === selectedIndex}
              showCategory={true}
              onSelect={setSelectedIndex}
              onRun={runCommand}
            />
          ))}
        </div>

        {/* Footer hints */}
        <div className="cmd-palette-footer">
          <span className="cmd-palette-hint"><kbd>↑↓</kbd> navigate</span>
          <span className="cmd-palette-hint"><kbd>↵</kbd> run</span>
          <span className="cmd-palette-hint"><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/** Individual command row */
function CommandRow({
  cmd,
  index,
  isSelected,
  showCategory,
  onSelect,
  onRun,
}: {
  cmd: ScoredCommand;
  index: number;
  isSelected: boolean;
  showCategory: boolean;
  onSelect: (i: number) => void;
  onRun: (cmd: ScoredCommand) => void;
}) {
  return (
    <div
      data-cmd-index={index}
      className={`cmd-palette-item${isSelected ? " selected" : ""}${!cmd.enabled ? " disabled" : ""}`}
      onMouseEnter={() => onSelect(index)}
      onMouseDown={(e) => {
        e.preventDefault();
        onRun(cmd);
      }}
    >
      {showCategory && <span className="cmd-palette-cat">{cmd.category}</span>}
      <span className="cmd-palette-label">{cmd.label}</span>
      {!cmd.enabled && cmd.reason && (
        <span className="cmd-palette-reason">{cmd.reason}</span>
      )}
      {cmd.shortcut && <kbd className="cmd-palette-shortcut">{cmd.shortcut}</kbd>}
    </div>
  );
}

export default CommandPalette;
