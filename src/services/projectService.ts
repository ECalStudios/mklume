import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ProjectData,
  PageEntry,
  NavEntry,
  HealthReport,
  RecentProject,
  AppSettings,
  RecoveryDraft,
} from "../types/project";

export async function pickAndOpenProject(): Promise<ProjectData | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select MkDocs Project Folder",
  });
  if (!selected) return null;
  return await invoke<ProjectData>("open_project", { path: selected });
}

export async function openProjectByPath(path: string): Promise<ProjectData> {
  return await invoke<ProjectData>("open_project", { path });
}

export async function loadPageContent(filePath: string): Promise<string> {
  return await invoke<string>("read_page_content", { filePath });
}

export async function savePageContent(
  filePath: string,
  content: string,
): Promise<void> {
  await invoke("save_page_content", { filePath, content });
}

export async function createPage(
  docsDir: string,
  folder: string,
  filename: string,
  title: string,
): Promise<PageEntry> {
  return await invoke<PageEntry>("create_page", {
    docsDir,
    folder,
    filename,
    title,
  });
}

export async function renamePage(
  filePath: string,
  docsDir: string,
  newName: string,
  doUpdateHeading: boolean,
): Promise<PageEntry> {
  return await invoke<PageEntry>("rename_page", {
    filePath,
    docsDir,
    newName,
    doUpdateHeading,
  });
}

export async function deletePage(
  filePath: string,
  projectRoot: string,
): Promise<void> {
  await invoke("delete_page", { filePath, projectRoot });
}

export async function addToNav(
  configPath: string,
  title: string,
  relativePath: string,
): Promise<void> {
  await invoke("add_to_nav", { configPath, title, relativePath });
}

export async function writeNav(
  configPath: string,
  nav: NavEntry[],
): Promise<void> {
  await invoke("write_nav", { configPath, nav });
}

export async function scanProjectHealth(
  rootPath: string,
  docsDir: string,
  configPath: string,
): Promise<HealthReport> {
  return await invoke<HealthReport>("scan_project_health", {
    rootPath,
    docsDir,
    configPath,
  });
}

// ── Recent Projects ──────────────────────────────────────

export async function getRecentProjects(): Promise<RecentProject[]> {
  return await invoke<RecentProject[]>("get_recent_projects");
}

export async function addRecentProject(
  project: RecentProject,
): Promise<RecentProject[]> {
  return await invoke<RecentProject[]>("add_recent_project", { project });
}

export async function removeRecentProject(
  rootPath: string,
): Promise<RecentProject[]> {
  return await invoke<RecentProject[]>("remove_recent_project", { rootPath });
}

export async function clearRecentProjects(): Promise<RecentProject[]> {
  return await invoke<RecentProject[]>("clear_recent_projects");
}

/** Create a new MkDocs Material project from scratch. Returns the project root path. */
export async function scaffoldProject(
  parentDir: string,
  folderName: string,
  siteName: string,
  siteDescription: string,
  mklumeCredit: boolean = false,
): Promise<string> {
  return await invoke<string>("scaffold_project", {
    parentDir,
    folderName,
    siteName,
    siteDescription,
    mklumeCredit,
  });
}

// ── Build & Serve ────────────────────────────────────────

export async function checkMkdocs(): Promise<string> {
  return await invoke<string>("check_mkdocs");
}

export async function buildSite(projectRoot: string): Promise<string> {
  return await invoke<string>("build_site", { projectRoot });
}

export async function startServe(projectRoot: string): Promise<void> {
  await invoke("start_serve", { projectRoot });
}

export async function stopServe(): Promise<void> {
  await invoke("stop_serve");
}

export async function isServeRunning(): Promise<boolean> {
  return await invoke<boolean>("is_serve_running");
}

// ── Build Export ────────────────────────────────────────

export type BuildOutputMode = "Folder" | "Zip" | "Both";

export interface BuildExportResult {
  success: boolean;
  site_dir: string | null;
  zip_path: string | null;
  zip_size: number | null;
  message: string;
  error: string | null;
}

export async function buildSiteExport(
  projectRoot: string,
  mode: BuildOutputMode,
): Promise<BuildExportResult> {
  return await invoke<BuildExportResult>("build_site_export", { projectRoot, mode });
}

export async function getSiteDir(projectRoot: string): Promise<string> {
  return await invoke<string>("get_site_dir", { projectRoot });
}

// ── Groups ───────────────────────────────────────────────

export async function createGroup(
  docsDir: string,
  folderName: string,
  displayName: string,
  createStarter: boolean,
): Promise<PageEntry | null> {
  return await invoke<PageEntry | null>("create_group", {
    docsDir,
    folderName,
    displayName,
    createStarter,
  });
}

// ── Settings ─────────────────────────────────────────

export async function loadSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke("save_settings", { settings });
}

export async function testMkdocsCommand(command: string): Promise<string> {
  return await invoke<string>("test_mkdocs_command", { command });
}

export async function createBackup(
  filePath: string,
  projectRoot: string,
): Promise<string> {
  return await invoke<string>("create_backup", { filePath, projectRoot });
}

export async function getAppVersion(): Promise<string> {
  return await invoke<string>("get_app_version");
}

// ── Recovery Drafts ────────────────────────────────────

export async function writeRecoveryDraft(
  projectRoot: string,
  filePath: string,
  content: string,
): Promise<void> {
  await invoke("write_recovery_draft", { projectRoot, filePath, content });
}

export async function checkRecoveryDraft(
  projectRoot: string,
  filePath: string,
): Promise<RecoveryDraft | null> {
  return await invoke<RecoveryDraft | null>("check_recovery_draft", {
    projectRoot,
    filePath,
  });
}

export async function deleteRecoveryDraft(
  projectRoot: string,
  filePath: string,
): Promise<void> {
  await invoke("delete_recovery_draft", { projectRoot, filePath });
}

export async function clearRecoveryDrafts(
  projectRoot: string,
): Promise<number> {
  return await invoke<number>("clear_recovery_drafts", { projectRoot });
}

export async function openFolderInExplorer(
  folderPath: string,
): Promise<void> {
  await invoke("open_folder_in_explorer", { folderPath });
}

export async function openUrlInBrowser(url: string): Promise<void> {
  await invoke("open_url_in_browser", { url });
}

export async function countRecoveryDrafts(
  projectRoot: string,
): Promise<number> {
  return await invoke<number>("count_recovery_drafts", { projectRoot });
}

export async function countBackups(
  projectRoot: string,
): Promise<number> {
  return await invoke<number>("count_backups", { projectRoot });
}

// ── Site Config ─────────────────────────────────────────

export interface SiteConfig {
  site_name: string | null;
  site_description: string | null;
  site_author: string | null;
  site_url: string | null;
  repo_url: string | null;
  repo_name: string | null;
  edit_uri: string | null;
  copyright: string | null;
  theme_name: string | null;
  theme_logo: string | null;
  theme_favicon: string | null;
  theme_language: string | null;
  features: string[];
  palette: PaletteEntry[];
  plugins: string[];
  markdown_extensions: string[];
  extra_css: string[];
  extra: ExtraConfig;
  raw_yaml: string;
}

export interface ExtraAnalytics {
  provider: string | null;
  property: string | null;
}

export interface ExtraSocialLink {
  icon: string | null;
  link: string | null;
  name: string | null;
}

export interface ExtraConsent {
  title: string | null;
  description: string | null;
  actions: string[];
}

export interface ExtraAlternate {
  name: string | null;
  link: string | null;
  lang: string | null;
}

export interface ExtraCustomEntry {
  key: string;
  value_display: string;
  is_scalar: boolean;
}

export interface ExtraConfig {
  analytics: ExtraAnalytics | null;
  social: ExtraSocialLink[];
  consent: ExtraConsent | null;
  generator: boolean | null;
  homepage: string | null;
  alternate: ExtraAlternate[];
  mklume_credit: boolean | null;
  custom: ExtraCustomEntry[];
}

export interface ExtraConfigUpdate {
  analytics?: ExtraAnalytics | null;
  social?: ExtraSocialLink[];
  consent?: ExtraConsent | null;
  generator?: boolean | null;
  homepage?: string | null;
  alternate?: ExtraAlternate[];
  mklume_credit?: boolean | null;
}

export interface PaletteEntry {
  scheme: string | null;
  primary: string | null;
  accent: string | null;
  toggle: { icon: string | null; name: string | null } | null;
}

export interface SiteConfigUpdate {
  site_name?: string;
  site_description?: string;
  site_author?: string;
  site_url?: string;
  repo_url?: string;
  repo_name?: string;
  edit_uri?: string;
  copyright?: string;
  theme_logo?: string;
  theme_favicon?: string;
  theme_language?: string;
  features?: string[];
  palette?: PaletteEntry[];
  plugins?: string[];
  markdown_extensions?: string[];
  extra?: ExtraConfigUpdate;
}

export interface DocsPageInfo {
  relative_path: string;
  in_nav: boolean;
}

export async function readSiteConfig(configPath: string): Promise<SiteConfig> {
  return await invoke<SiteConfig>("read_site_config", { configPath });
}

export async function writeSiteConfig(
  configPath: string,
  updates: SiteConfigUpdate,
): Promise<void> {
  await invoke("write_site_config", { configPath, updates });
}

export async function listDocsPages(
  docsDir: string,
  configPath: string,
): Promise<DocsPageInfo[]> {
  return await invoke<DocsPageInfo[]>("list_docs_pages", { docsDir, configPath });
}

// ── Image Assets ────────────────────────────────────────

export interface ImageCopyResult {
  source: string;
  filename: string;
  markdown_path: string;
  alt_text: string;
  ok: boolean;
  error: string | null;
}

export interface CopyImagesResult {
  results: ImageCopyResult[];
  copied_count: number;
  skipped_count: number;
}

export async function copyImagesToAssets(
  docsDir: string,
  pageRelativePath: string,
  filePaths: string[],
): Promise<CopyImagesResult> {
  return await invoke<CopyImagesResult>("copy_images_to_assets", {
    docsDir,
    pageRelativePath,
    filePaths,
  });
}

// ── Sidebar State ────────────────────────────────────────

export async function getCollapsedGroups(
  projectRoot: string,
): Promise<string[]> {
  return await invoke<string[]>("get_collapsed_groups", { projectRoot });
}

export async function saveCollapsedGroups(
  projectRoot: string,
  collapsed: string[],
): Promise<void> {
  await invoke("save_collapsed_groups", { projectRoot, collapsed });
}

// ── Git Sync ────────────────────────────────────────────

export interface GitRepoInfo {
  git_installed: boolean;
  is_repo: boolean;
  repo_root: string | null;
  branch: string | null;
  remote: string | null;
  upstream: string | null;
  last_commit: string | null;
  last_commit_date: string | null;
}

export interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitStatusResult {
  info: GitRepoInfo;
  files: GitFileStatus[];
  ahead: number;
  behind: number;
  has_changes: boolean;
  error: string | null;
}

export interface GitSyncResult {
  success: boolean;
  committed: boolean;
  pushed: boolean;
  commit_hash: string | null;
  files_committed: number;
  message: string;
  error: string | null;
  error_detail: string | null;
}

export interface GitIgnoreSuggestion {
  has_gitignore: boolean;
  missing_entries: string[];
  suggested_content: string;
}

export async function gitCheckInstalled(): Promise<boolean> {
  return await invoke<boolean>("git_check_installed");
}

export async function gitGetRepoInfo(projectRoot: string): Promise<GitRepoInfo> {
  return await invoke<GitRepoInfo>("git_get_repo_info", { projectRoot });
}

export async function gitStatus(projectRoot: string): Promise<GitStatusResult> {
  return await invoke<GitStatusResult>("git_status", { projectRoot });
}

export async function gitSync(
  projectRoot: string,
  commitMessage: string,
  doPush: boolean,
): Promise<GitSyncResult> {
  return await invoke<GitSyncResult>("git_sync", { projectRoot, commitMessage, doPush });
}

export async function gitCheckGitignore(projectRoot: string): Promise<GitIgnoreSuggestion> {
  return await invoke<GitIgnoreSuggestion>("git_check_gitignore", { projectRoot });
}

export async function gitWriteGitignore(projectRoot: string, content: string): Promise<void> {
  await invoke("git_write_gitignore", { projectRoot, content });
}

// ── Deploy Assistant ────────────────────────────────────

export interface DeployReadiness {
  git_installed: boolean;
  is_repo: boolean;
  has_remote: boolean;
  remote_url: string | null;
  is_github: boolean;
  github_owner: string | null;
  github_repo: string | null;
  branch: string | null;
  has_workflows_dir: boolean;
  existing_deploy_workflow: string | null;
  other_pages_workflows: string[];
  site_dir: string;
  site_url: string | null;
  has_requirements_txt: boolean;
  has_cname: boolean;
  cname_value: string | null;
  inferred_pages_url: string | null;
  detected_plugins: string[];
}

export interface WorkflowOptions {
  branch: string;
  site_dir: string;
}

export interface DeployGenerateResult {
  success: boolean;
  file_path: string | null;
  message: string;
  error: string | null;
}

export async function deployCheckReadiness(projectRoot: string): Promise<DeployReadiness> {
  return await invoke<DeployReadiness>("deploy_check_readiness", { projectRoot });
}

export async function deployGenerateWorkflow(
  projectRoot: string,
  options: WorkflowOptions,
): Promise<DeployGenerateResult> {
  return await invoke<DeployGenerateResult>("deploy_generate_workflow", { projectRoot, options });
}

export async function deployGenerateWorkflowAlternate(
  projectRoot: string,
  options: WorkflowOptions,
): Promise<DeployGenerateResult> {
  return await invoke<DeployGenerateResult>("deploy_generate_workflow_alternate", { projectRoot, options });
}

export async function deployGenerateRequirements(projectRoot: string): Promise<DeployGenerateResult> {
  return await invoke<DeployGenerateResult>("deploy_generate_requirements", { projectRoot });
}

export async function deployWriteCname(projectRoot: string, domain: string): Promise<DeployGenerateResult> {
  return await invoke<DeployGenerateResult>("deploy_write_cname", { projectRoot, domain });
}

export async function deployReadFile(filePath: string): Promise<string> {
  return await invoke<string>("deploy_read_file", { filePath });
}
