export interface PageEntry {
  title: string;
  file_path: string;
  relative_path: string;
}

export interface NavEntry {
  title: string;
  path: string | null;
  children: NavEntry[];
}

export interface ProjectData {
  root_path: string;
  site_name: string;
  docs_dir: string;
  config_path: string;
  pages: PageEntry[];
  nav: NavEntry[] | null;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PendingAction =
  | { type: "switch-page"; page: PageEntry }
  | { type: "close-project" }
  | { type: "close-window" }
  | null;

export type ViewMode = "edit" | "visual" | "preview" | "split";

export type PreviewType = "page" | "site";
export type SplitEditor = "markdown" | "visual";

// ── Visual Block Editor types ────────────────────────

export interface ListItem {
  text: string;
  checked?: boolean;
}

export interface GridCard {
  icon: string;
  title: string;
  description: string;
  linkLabel: string;
  linkUrl: string;
}

export interface TabItem {
  label: string;
  content: string;
}

export interface DefItem {
  term: string;
  definition: string;
}

export type VisualBlock =
  | { id: string; type: "frontmatter"; raw: string }
  | { id: string; type: "heading"; level: number; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; alt: string; src: string; title: string }
  | {
      id: string;
      type: "admonition";
      kind: string;
      title: string;
      body: string;
      collapsible: boolean;
    }
  | { id: string; type: "code"; language: string; code: string }
  | { id: string; type: "table"; raw: string }
  | { id: string; type: "divider" }
  | { id: string; type: "raw"; markdown: string }
  | { id: string; type: "quote"; text: string }
  | { id: string; type: "unordered-list"; items: ListItem[] }
  | { id: string; type: "ordered-list"; items: ListItem[] }
  | { id: string; type: "task-list"; items: ListItem[] }
  | { id: string; type: "definition-list"; items: DefItem[] }
  | { id: string; type: "grid-cards"; cards: GridCard[] }
  | { id: string; type: "content-tabs"; tabs: TabItem[] }
  | {
      id: string;
      type: "button";
      label: string;
      url: string;
      primary: boolean;
      icon: string;
    };

export interface HealthIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  file: string | null;
  line: number | null;
  detail: string | null;
  action: string | null;
}

export interface HealthSummary {
  errors: number;
  warnings: number;
  infos: number;
  total_pages: number;
  nav_pages: number;
  unlisted_pages: number;
  score: number;
}

export interface HealthReport {
  issues: HealthIssue[];
  summary: HealthSummary;
}

export type ThemeMode = "dark" | "light" | "system";

export interface AppSettings {
  startBehavior: "welcome" | "reopen";
  theme: ThemeMode;
  editorFontSize: number;
  wordWrap: boolean;
  autosave: boolean;
  autosaveDelaySecs: number;
  pythonCommand: string;
  mkdocsCommand: string;
  backupBeforeSave: boolean;
  recoveryDrafts: boolean;
  warnBeforeDelete: boolean;
  warnBeforeRemoveRecent: boolean;
  confirmOverwrite: boolean;
  warnBeforePageSwitch: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  startBehavior: "welcome",
  theme: "dark",
  editorFontSize: 13,
  wordWrap: true,
  autosave: false,
  autosaveDelaySecs: 5,
  pythonCommand: "python",
  mkdocsCommand: "mkdocs",
  backupBeforeSave: true,
  recoveryDrafts: true,
  warnBeforeDelete: true,
  warnBeforeRemoveRecent: false,
  confirmOverwrite: false,
  warnBeforePageSwitch: true,
};

export interface RecoveryDraft {
  filePath: string;
  content: string;
  timestamp: number;
}

export interface RecentProject {
  name: string;
  root_path: string;
  docs_dir: string;
  config_path: string;
  last_opened: string;
  last_page: string | null;
}
