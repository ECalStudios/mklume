import { useState, useRef, useEffect, useCallback } from "react";
import { ALL_COMMANDS, type CommandContext } from "../../commands/registry";
import type { ViewMode } from "../../types/project";

interface AppMenuBarProps {
  onExecute: (commandId: string) => void;
  context: CommandContext;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  hasPage?: boolean;
}

/** Native browser commands — skip them in menus, the browser handles these */
const NATIVE_COMMANDS = new Set([
  "edit.undo", "edit.redo", "edit.cut", "edit.copy", "edit.paste", "edit.selectAll",
]);

/**
 * Menu structure: each top-level menu maps to an ordered list of command IDs,
 * with `"---"` as a separator. Uses the registry for labels, shortcuts, and
 * enabled/disabled state — no duplication.
 */
const MENU_STRUCTURE: { label: string; items: string[] }[] = [
  {
    label: "File",
    items: [
      "file.newProject", "file.openProject",
      "---",
      "file.save",
      "---",
      "file.newPage", "file.newGroup",
      "---",
      "file.revealFile", "file.revealProject", "file.revealDocs",
      "---",
      "file.openBackups", "file.openRecovery",
      "---",
      "file.closeProject",
    ],
  },
  {
    label: "Edit",
    items: [
      "edit.undo", "edit.redo",
      "---",
      "edit.cut", "edit.copy", "edit.paste",
      "---",
      "edit.selectAll",
      "---",
      "edit.find", "edit.findReplace",
      "---",
      "edit.copyAsMarkdown", "edit.pasteAsPlainText",
    ],
  },
  {
    label: "Paragraph",
    items: [
      "paragraph.h1", "paragraph.h2", "paragraph.h3",
      "paragraph.h4", "paragraph.h5", "paragraph.h6",
      "---",
      "paragraph.quote", "paragraph.bulletList",
      "paragraph.numberedList", "paragraph.taskList",
      "---",
      "paragraph.codeBlock", "paragraph.divider",
    ],
  },
  {
    label: "Format",
    items: [
      "format.bold", "format.italic", "format.inlineCode",
      "format.strikethrough",
      "---",
      "format.link", "format.image",
    ],
  },
  {
    label: "Insert",
    items: [
      "insert.admonition", "insert.details", "insert.tabs",
      "insert.gridCards",
      "---",
      "insert.table", "insert.button",
      "---",
      "insert.link", "insert.internalLink", "insert.image", "insert.footnote",
      "---",
      "insert.frontMatter", "insert.divider",
    ],
  },
  {
    label: "View",
    items: [
      "view.markdown", "view.visual", "view.preview", "view.split",
      "---",
      "view.toggleTheme",
      "---",
      "view.buildPanel", "view.healthPanel",
      "---",
      "view.siteSettings",
      "---",
      "view.settings",
    ],
  },
  {
    label: "Tools",
    items: [
      "tools.checkMkdocs", "tools.buildSite",
      "---",
      "tools.startPreview", "tools.stopPreview", "tools.openInBrowser",
      "---",
      "tools.healthScan",
      "---",
      "tools.gitSync",
      "tools.deployAssistant",
      "---",
      "tools.openBackups", "tools.openRecovery",
    ],
  },
  {
    label: "Help",
    items: [
      "help.about",
      "---",
      "help.docs", "help.offlineHelp",
      "---",
      "help.github", "help.reportIssue",
    ],
  },
];

// Build a quick lookup from command id → command definition
const CMD_MAP = new Map(ALL_COMMANDS.map((c) => [c.id, c]));

function AppMenuBar({ onExecute, context, viewMode, onViewModeChange, hasPage }: AppMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    function onMouseDown(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
      }
    }
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const handleTopClick = useCallback((label: string) => {
    setOpenMenu((cur) => (cur === label ? null : label));
  }, []);

  const handleTopEnter = useCallback((label: string) => {
    // Only switch on hover when a menu is already open
    setOpenMenu((cur) => (cur ? label : cur));
  }, []);

  const handleItemClick = useCallback(
    (cmdId: string) => {
      setOpenMenu(null);
      // Native commands are still clickable — the browser handles them
      if (NATIVE_COMMANDS.has(cmdId)) {
        // Execute the native action via document.execCommand as a best-effort
        const nativeMap: Record<string, string> = {
          "edit.undo": "undo",
          "edit.redo": "redo",
          "edit.cut": "cut",
          "edit.copy": "copy",
          "edit.paste": "paste",
          "edit.selectAll": "selectAll",
        };
        const native = nativeMap[cmdId];
        if (native) document.execCommand(native);
        return;
      }
      onExecute(cmdId);
    },
    [onExecute],
  );

  return (
    <div className="app-menubar" ref={barRef}>
      <div className="app-menubar-menus">
        {MENU_STRUCTURE.map((menu) => (
          <div key={menu.label} className="app-menubar-item">
            <button
              className={`app-menubar-btn${openMenu === menu.label ? " open" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); handleTopClick(menu.label); }}
              onMouseEnter={() => handleTopEnter(menu.label)}
            >
              {menu.label}
            </button>

            {openMenu === menu.label && (
              <MenuDropdown
                items={menu.items}
                context={context}
                onItemClick={handleItemClick}
              />
            )}
          </div>
        ))}
      </div>

      {hasPage && viewMode && onViewModeChange && (
        <div className="app-menubar-right">
          <div className="view-toggle">
            <ViewToggleBtn active={viewMode === "edit"} onClick={() => onViewModeChange("edit")} label="Markdown" shortcut="Ctrl+1">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </ViewToggleBtn>
            <ViewToggleBtn active={viewMode === "visual"} onClick={() => onViewModeChange("visual")} label="Visual" shortcut="Ctrl+2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="4" rx="1" />
              <rect x="14" y="11" width="7" height="4" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </ViewToggleBtn>
            <ViewToggleBtn active={viewMode === "preview"} onClick={() => onViewModeChange("preview")} label="Preview" shortcut="Ctrl+3">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </ViewToggleBtn>
            <ViewToggleBtn active={viewMode === "split"} onClick={() => onViewModeChange("split")} label="Split" shortcut="Ctrl+4">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </ViewToggleBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/** Dropdown panel for a single menu */
function MenuDropdown({
  items,
  context,
  onItemClick,
}: {
  items: string[];
  context: CommandContext;
  onItemClick: (id: string) => void;
}) {
  return (
    <div className="app-menu-dropdown">
      {items.map((item, i) => {
        if (item === "---") {
          return <div key={`sep-${i}`} className="app-menu-separator" />;
        }

        const cmd = CMD_MAP.get(item);
        if (!cmd) return null;

        const enabled = !cmd.when || cmd.when(context);

        return (
          <button
            key={cmd.id}
            className={`app-menu-item${!enabled ? " disabled" : ""}`}
            disabled={!enabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (enabled) onItemClick(cmd.id);
            }}
            title={
              !enabled && cmd.disabledReason
                ? typeof cmd.disabledReason === "function"
                  ? cmd.disabledReason(context)
                  : cmd.disabledReason
                : undefined
            }
          >
            <span className="app-menu-item-label">{cmd.label}</span>
            {cmd.shortcut && (
              <span className="app-menu-item-shortcut">{cmd.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** View mode toggle button */
function ViewToggleBtn({
  active,
  onClick,
  label,
  shortcut,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`view-toggle-btn${active ? " active" : ""}`}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span>{label}</span>
    </button>
  );
}

export default AppMenuBar;
