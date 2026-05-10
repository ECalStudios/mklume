/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

/**
 * Centralized command registry for MkLume.
 * Every user-facing action is defined here with metadata
 * that feeds the Command Palette, keyboard shortcuts, and menus.
 */

export interface AppCommand {
  id: string;
  label: string;
  category: string;
  shortcut?: string;          // Display string, e.g. "Ctrl+S"
  /** When provided, only enabled if predicate returns true */
  when?: (ctx: CommandContext) => boolean;
  /** Shown when command is disabled */
  disabledReason?: string | ((ctx: CommandContext) => string);
  /** Search aliases — extra keywords that match this command */
  aliases?: string[];
}

export interface CommandContext {
  hasProject: boolean;
  hasPage: boolean;
  isDirty: boolean;
  isServing: boolean;
  viewMode: string;           // "edit" | "visual" | "preview" | "split"
}

/** Category display order */
export const CATEGORY_ORDER = [
  "File", "Edit", "Paragraph", "Format", "Insert", "View", "Tools", "Help",
] as const;

// Helper for common "when" predicates
const needsProject = (c: CommandContext) => c.hasProject;
const needsPage = (c: CommandContext) => c.hasPage;
const needsEditor = (c: CommandContext) => c.hasPage && (c.viewMode === "edit" || c.viewMode === "split");
const needsServing = (c: CommandContext) => c.hasProject && c.isServing;

function projectReason(c: CommandContext): string {
  if (!c.hasProject) return "Open a project first";
  return "";
}
function pageReason(c: CommandContext): string {
  if (!c.hasProject) return "Open a project first";
  if (!c.hasPage) return "Select a page first";
  return "";
}
function editorReason(c: CommandContext): string {
  if (!c.hasProject) return "Open a project first";
  if (!c.hasPage) return "Select a page first";
  if (c.viewMode !== "edit" && c.viewMode !== "split") return "Switch to Markdown or Split mode";
  return "";
}

// ── File ─────────────────────────────────────────────────

const fileCommands: AppCommand[] = [
  { id: "file.newProject",        label: "New Project",            category: "File", shortcut: "Ctrl+N" },
  { id: "file.openProject",       label: "Open Project",           category: "File", shortcut: "Ctrl+O",
    aliases: ["folder", "browse"] },
  { id: "file.save",              label: "Save",                   category: "File", shortcut: "Ctrl+S",
    when: (c) => c.hasPage && c.isDirty,
    disabledReason: (c) => !c.hasPage ? "Select a page first" : "No unsaved changes" },
  { id: "file.closeProject",      label: "Close Project",          category: "File", shortcut: "Ctrl+W",
    when: needsProject, disabledReason: projectReason },
  { id: "file.newPage",           label: "New Page",               category: "File",
    when: needsProject, disabledReason: projectReason },
  { id: "file.newGroup",          label: "New Group",              category: "File",
    when: needsProject, disabledReason: projectReason,
    aliases: ["section", "folder"] },
  { id: "file.revealFile",        label: "Open File Location",     category: "File",
    when: needsPage, disabledReason: pageReason,
    aliases: ["folder", "explorer", "finder"] },
  { id: "file.revealProject",     label: "Reveal Project Folder",  category: "File",
    when: needsProject, disabledReason: projectReason,
    aliases: ["folder", "explorer", "finder"] },
  { id: "file.revealDocs",        label: "Open Docs Folder",       category: "File",
    when: needsProject, disabledReason: projectReason,
    aliases: ["folder"] },
  { id: "file.openBackups",       label: "Open Backups Folder",    category: "File",
    when: needsProject, disabledReason: projectReason,
    aliases: ["backup", "folder"] },
  { id: "file.openRecovery",      label: "Open Recovery Folder",   category: "File",
    when: needsProject, disabledReason: projectReason,
    aliases: ["recovery", "folder"] },
];

// ── Edit ─────────────────────────────────────────────────

const editCommands: AppCommand[] = [
  { id: "edit.undo",              label: "Undo",                   category: "Edit", shortcut: "Ctrl+Z" },
  { id: "edit.redo",              label: "Redo",                   category: "Edit", shortcut: "Ctrl+Y" },
  { id: "edit.cut",               label: "Cut",                    category: "Edit", shortcut: "Ctrl+X" },
  { id: "edit.copy",              label: "Copy",                   category: "Edit", shortcut: "Ctrl+C" },
  { id: "edit.paste",             label: "Paste",                  category: "Edit", shortcut: "Ctrl+V" },
  { id: "edit.selectAll",         label: "Select All",             category: "Edit", shortcut: "Ctrl+A" },
  { id: "edit.find",              label: "Find",                   category: "Edit", shortcut: "Ctrl+F",
    when: needsPage, disabledReason: pageReason,
    aliases: ["search"] },
  { id: "edit.findReplace",       label: "Find and Replace",       category: "Edit", shortcut: "Ctrl+H",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["search", "replace"] },
  { id: "edit.copyAsMarkdown",    label: "Copy as Markdown",       category: "Edit",
    when: needsPage, disabledReason: pageReason },
  { id: "edit.pasteAsPlainText",  label: "Paste as Plain Text",    category: "Edit", shortcut: "Ctrl+Shift+V",
    when: needsEditor, disabledReason: editorReason },
];

// ── Paragraph ────────────────────────────────────────────

const paragraphCommands: AppCommand[] = [
  { id: "paragraph.h1",           label: "Heading 1",              category: "Paragraph",
    when: needsEditor, disabledReason: editorReason },
  { id: "paragraph.h2",           label: "Heading 2",              category: "Paragraph",
    when: needsEditor, disabledReason: editorReason },
  { id: "paragraph.h3",           label: "Heading 3",              category: "Paragraph",
    when: needsEditor, disabledReason: editorReason },
  { id: "paragraph.h4",           label: "Heading 4",              category: "Paragraph",
    when: needsEditor, disabledReason: editorReason },
  { id: "paragraph.h5",           label: "Heading 5",              category: "Paragraph",
    when: needsEditor, disabledReason: editorReason },
  { id: "paragraph.h6",           label: "Heading 6",              category: "Paragraph",
    when: needsEditor, disabledReason: editorReason },
  { id: "paragraph.quote",        label: "Quote",                  category: "Paragraph",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["blockquote"] },
  { id: "paragraph.bulletList",   label: "Bullet List",            category: "Paragraph",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["unordered"] },
  { id: "paragraph.numberedList", label: "Numbered List",          category: "Paragraph",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["ordered"] },
  { id: "paragraph.taskList",     label: "Task List",              category: "Paragraph",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["checkbox", "todo"] },
  { id: "paragraph.codeBlock",    label: "Code Block",             category: "Paragraph", shortcut: "Ctrl+Shift+K",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["fence", "pre"] },
  { id: "paragraph.divider",      label: "Divider",                category: "Paragraph",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["horizontal rule", "hr", "separator"] },
];

// ── Format ───────────────────────────────────────────────

const formatCommands: AppCommand[] = [
  { id: "format.bold",            label: "Bold",                   category: "Format", shortcut: "Ctrl+B",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["strong"] },
  { id: "format.italic",          label: "Italic",                 category: "Format", shortcut: "Ctrl+I",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["emphasis", "em"] },
  { id: "format.inlineCode",      label: "Inline Code",            category: "Format", shortcut: "Ctrl+E",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["code", "monospace"] },
  { id: "format.strikethrough",   label: "Strikethrough",          category: "Format",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["strike", "del"] },
  { id: "format.link",            label: "Link",                   category: "Format",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["url", "href", "hyperlink"] },
  { id: "format.image",           label: "Image",                  category: "Format",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["picture", "img"] },
];

// ── Insert ───────────────────────────────────────────────

const insertCommands: AppCommand[] = [
  { id: "insert.admonition",      label: "Insert Admonition",      category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["note", "warning", "tip", "info", "danger", "callout"] },
  { id: "insert.details",         label: "Insert Details",         category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["collapsible", "accordion", "expandable"] },
  { id: "insert.tabs",            label: "Insert Content Tabs",    category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["tabbed"] },
  { id: "insert.gridCards",       label: "Insert Grid Cards",      category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["grid", "cards", "layout"] },
  { id: "insert.table",           label: "Insert Table",           category: "Insert",
    when: needsEditor, disabledReason: editorReason },
  { id: "insert.button",          label: "Insert Button",          category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["btn", "cta"] },
  { id: "insert.link",            label: "Insert Link",            category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["url"] },
  { id: "insert.internalLink",   label: "Insert Internal Link",   category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["page link", "wiki link", "internal", "[["] },
  { id: "insert.image",           label: "Insert Image",           category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["picture", "img", "photo"] },
  { id: "insert.footnote",        label: "Insert Footnote",        category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["reference", "citation"] },
  { id: "insert.frontMatter",     label: "Insert Front Matter",    category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["yaml", "metadata", "meta"] },
  { id: "insert.divider",         label: "Insert Divider",         category: "Insert",
    when: needsEditor, disabledReason: editorReason,
    aliases: ["hr", "separator"] },
];

// ── View ─────────────────────────────────────────────────

const viewCommands: AppCommand[] = [
  { id: "view.markdown",          label: "Switch to Markdown Mode", category: "View", shortcut: "Ctrl+1",
    when: needsPage, disabledReason: pageReason,
    aliases: ["edit", "source", "raw", "markdown"] },
  { id: "view.visual",            label: "Switch to Visual Mode",   category: "View", shortcut: "Ctrl+2",
    when: needsPage, disabledReason: pageReason,
    aliases: ["wysiwyg", "rich", "visual"] },
  { id: "view.preview",           label: "Switch to Preview Mode",  category: "View", shortcut: "Ctrl+3",
    when: needsPage, disabledReason: pageReason,
    aliases: ["rendered"] },
  { id: "view.split",             label: "Switch to Split Mode",    category: "View", shortcut: "Ctrl+4",
    when: needsPage, disabledReason: pageReason,
    aliases: ["side by side", "dual"] },
  { id: "view.toggleTheme",       label: "Toggle Theme",           category: "View",
    aliases: ["dark", "light", "appearance", "color scheme"] },
  { id: "view.buildPanel",        label: "Build & Preview Panel",  category: "View",
    when: needsProject, disabledReason: projectReason,
    aliases: ["serve"] },
  { id: "view.healthPanel",       label: "Project Health",         category: "View",
    when: needsProject, disabledReason: projectReason,
    aliases: ["health", "diagnostics"] },
  { id: "view.settings",          label: "Open Settings",          category: "View", shortcut: "Ctrl+,",
    aliases: ["preferences", "config", "options"] },
  { id: "view.siteSettings",      label: "Site Settings",          category: "View",
    when: needsProject, disabledReason: projectReason,
    aliases: ["mkdocs", "yaml", "config", "theme", "navigation", "palette"] },
];

// ── Tools ────────────────────────────────────────────────

const toolsCommands: AppCommand[] = [
  { id: "tools.checkMkdocs",      label: "Check MkDocs",           category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["mkdocs", "validate"] },
  { id: "tools.buildSite",        label: "Build Site",             category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["mkdocs", "compile", "generate"] },
  { id: "tools.startPreview",     label: "Start Preview Server",   category: "Tools",
    when: (c) => c.hasProject && !c.isServing,
    disabledReason: (c) => !c.hasProject ? "Open a project first" : "Preview server is already running",
    aliases: ["serve", "mkdocs", "dev server"] },
  { id: "tools.stopPreview",      label: "Stop Preview Server",    category: "Tools",
    when: needsServing,
    disabledReason: (c) => !c.hasProject ? "Open a project first" : "Preview server is not running",
    aliases: ["serve", "stop"] },
  { id: "tools.openInBrowser",    label: "Open Preview in Browser",category: "Tools",
    when: needsServing,
    disabledReason: (c) => !c.hasProject ? "Open a project first" : "Preview server is not running",
    aliases: ["browser", "localhost", "web"] },
  { id: "tools.healthScan",       label: "Rescan Project Health",  category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["health", "diagnostics", "scan"] },
  { id: "tools.openBackups",      label: "Open Backups Folder",    category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["backup", "folder"] },
  { id: "tools.openRecovery",     label: "Open Recovery Folder",   category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["recovery", "folder"] },
  { id: "tools.gitSync",          label: "Git Sync",               category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["git", "commit", "push", "sync", "version control"] },
  { id: "tools.buildFolder",      label: "Build Site as Folder",   category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["build", "export", "site"] },
  { id: "tools.buildZip",         label: "Build Site as ZIP",      category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["build", "export", "zip", "archive", "deploy"] },
  { id: "tools.buildBoth",        label: "Build Site as Folder + ZIP", category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["build", "export", "zip", "both"] },
  { id: "tools.openSiteFolder",   label: "Open Build Output Folder", category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["site", "output", "folder"] },
  { id: "tools.openDistFolder",   label: "Open ZIP Output Folder", category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["dist", "zip", "output", "folder"] },
  { id: "tools.deployAssistant",  label: "GitHub Pages Deploy Assistant", category: "Tools",
    when: needsProject, disabledReason: projectReason,
    aliases: ["deploy", "github", "pages", "publish", "hosting", "workflow", "actions"] },
];

// ── Help ─────────────────────────────────────────────────

const helpCommands: AppCommand[] = [
  { id: "help.about",             label: "About MkLume",           category: "Help",
    aliases: ["version", "info"] },
  { id: "help.docs",              label: "Documentation",          category: "Help",
    aliases: ["manual", "guide", "help"] },
  { id: "help.offlineHelp",       label: "Offline Quick Help",     category: "Help",
    aliases: ["offline", "quick help", "bundled help", "local help"] },
  { id: "help.github",            label: "GitHub Repository",      category: "Help",
    aliases: ["source", "repo"] },
  { id: "help.reportIssue",       label: "Report Issue",           category: "Help",
    aliases: ["bug", "feedback"] },
  { id: "help.support",           label: "Support MkLume",         category: "Help",
    aliases: ["donate", "sponsor", "fund"] },
];

// ── Full registry ────────────────────────────────────────

export const ALL_COMMANDS: AppCommand[] = [
  ...fileCommands,
  ...editCommands,
  ...paragraphCommands,
  ...formatCommands,
  ...insertCommands,
  ...viewCommands,
  ...toolsCommands,
  ...helpCommands,
];

/**
 * Build a shortcut → command-id map for keyboard dispatch.
 * Keys are normalized: "ctrl+shift+k", "ctrl+s", etc.
 */
export function buildShortcutMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const cmd of ALL_COMMANDS) {
    if (cmd.shortcut) {
      const key = cmd.shortcut.toLowerCase().replace(/\s/g, "");
      map.set(key, cmd.id);
    }
  }
  return map;
}
