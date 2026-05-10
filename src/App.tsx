/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import TopBar from "./components/layout/TopBar";
import AppMenuBar from "./components/layout/AppMenuBar";
import WelcomeScreen from "./components/welcome/WelcomeScreen";
import Sidebar from "./components/sidebar/Sidebar";
import ContentArea from "./components/editor/ContentArea";
import type { ContentAreaHandle } from "./components/editor/ContentArea";
import HealthPanel from "./components/health/HealthPanel";
import BuildPanel from "./components/build/BuildPanel";
import CommandPalette from "./components/common/CommandPalette";
import ConfirmDialog from "./components/common/ConfirmDialog";
import NewPageDialog from "./components/common/NewPageDialog";
import NewGroupDialog from "./components/common/NewGroupDialog";
import NewProjectDialog from "./components/common/NewProjectDialog";
import RenamePageDialog from "./components/common/RenamePageDialog";
import SettingsPanel from "./components/settings/SettingsPanel";
import SiteSettingsPanel from "./components/sitesettings/SiteSettingsPanel";
import GitSyncPanel from "./components/git/GitSyncPanel";
import DeployAssistant from "./components/deploy/DeployAssistant";
import ToastContainer, { createToast, type ToastMessage } from "./components/common/Toast";
import PagePickerDialog from "./components/common/PagePickerDialog";
import MkLumeIcon from "./components/common/MkLumeIcon";
import { useImageDrop, type ImageDropResult } from "./hooks/useImageDrop";
import { usePageIndex } from "./hooks/usePageIndex";
import { useLinkAutocomplete } from "./hooks/useLinkAutocomplete";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { CommandContext } from "./commands/registry";
import {
  pickAndOpenProject,
  openProjectByPath,
  loadPageContent,
  savePageContent,
  createPage,
  renamePage,
  deletePage,
  writeNav,
  scanProjectHealth,
  getRecentProjects,
  addRecentProject,
  removeRecentProject,
  clearRecentProjects,
  scaffoldProject,
  createGroup,
  isServeRunning,
  stopServe,
  startServe,
  openUrlInBrowser,
  openFolderInExplorer,
  loadSettings,
  createBackup,
  getAppVersion,
  writeRecoveryDraft,
  checkRecoveryDraft,
  deleteRecoveryDraft,
  readSiteConfig,
} from "./services/projectService";
import type { SiteConfig } from "./services/projectService";
import {
  moveNavEntry,
  removeNavEntry,
  removeNavEntryByPath,
  removeAllMissingEntries,
  addPageToNavSmart,
  countMissingEntries,
  dragMoveNavEntry,
} from "./utils/navHelpers";
import type {
  ProjectData,
  PageEntry,
  RecentProject,
  HealthReport,
  SaveStatus,
  PendingAction,
  ViewMode,
  PreviewType,
  SplitEditor,
  AppSettings,
  ThemeMode,
  RecoveryDraft,
} from "./types/project";
import { DEFAULT_SETTINGS } from "./types/project";

function App() {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageEntry | null>(null);
  const [welcomeError, setWelcomeError] = useState("");

  const [editedContent, setEditedContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [previewType, setPreviewType] = useState<PreviewType>("page");
  const [splitEditor, setSplitEditor] = useState<SplitEditor>("markdown");
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageError, setNewPageError] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupError, setNewGroupError] = useState("");
  const [renamingPage, setRenamingPage] = useState<PageEntry | null>(null);
  const [renameError, setRenameError] = useState("");
  const [deletingPage, setDeletingPage] = useState<PageEntry | null>(null);
  const [removingNav, setRemovingNav] = useState<{
    path: number[];
    title: string;
  } | null>(null);
  const [showCleanMissing, setShowCleanMissing] = useState(false);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectError, setNewProjectError] = useState("");

  const [showHealth, setShowHealth] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [showBuild, setShowBuild] = useState(false);
  const [isServing, setIsServing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showSiteSettings, setShowSiteSettings] = useState(false);
  const [showGitSync, setShowGitSync] = useState(false);
  const [showDeployAssistant, setShowDeployAssistant] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState<RecoveryDraft | null>(null);

  // ── Command Palette & Find/Replace ─────────────────
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showOfflineHelp, setShowOfflineHelp] = useState(false);

  const contentAreaRef = useRef<ContentAreaHandle>(null);

  // ── Toasts ────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((text: string, type: ToastMessage["type"] = "success") => {
    setToasts((prev) => [...prev, createToast(text, type)]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Image Drop ─────────────────────────────────────────
  // When a user drops an image onto the editor, Tauri's backend copies the
  // file into the project's docs/ assets folder and returns Markdown image
  // syntax. We insert the Markdown at the cursor (or append if no cursor).
  const handleImageDrop = useCallback(
    (result: ImageDropResult) => {
      addToast(result.toastMessage, result.toastType);
      if (result.markdownLines.length === 0) return;

      const snippet = result.markdownLines.join("\n") + "\n";

      if (viewMode === "edit" || viewMode === "split") {
        // Insert at cursor position in textarea
        const ta = contentAreaRef.current?.getTextarea();
        if (ta) {
          const pos = ta.selectionStart;
          // Ensure we start on a new line
          const before = editedContent.substring(0, pos);
          const after = editedContent.substring(pos);
          const needNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
          const newContent = before + needNewline + snippet + after;
          setEditedContent(newContent);
          requestAnimationFrame(() => {
            ta.focus();
            const newPos = pos + needNewline.length + snippet.length;
            ta.selectionStart = newPos;
            ta.selectionEnd = newPos;
          });
        } else {
          // Fallback: append to end
          const needNewline = editedContent.length > 0 && !editedContent.endsWith("\n") ? "\n" : "";
          setEditedContent(editedContent + needNewline + snippet);
        }
      } else if (viewMode === "visual") {
        // In visual mode, append image markdown to end (visual editor will re-parse)
        const needNewline = editedContent.length > 0 && !editedContent.endsWith("\n") ? "\n" : "";
        setEditedContent(editedContent + needNewline + snippet);
      } else if (viewMode === "preview") {
        // Preview-only mode: still append, user can switch modes to see
        const needNewline = editedContent.length > 0 && !editedContent.endsWith("\n") ? "\n" : "";
        setEditedContent(editedContent + needNewline + snippet);
      }
    },
    [viewMode, editedContent, addToast],
  );

  const imageDragState = useImageDrop({
    docsDir: project?.docs_dir ?? null,
    pageRelativePath: selectedPage?.relative_path ?? null,
    enabled: !!project && !!selectedPage,
    onImageDrop: handleImageDrop,
  });

  // ── Page Index & Link Autocomplete ────────────────────
  const pageIndex = usePageIndex(project?.pages, project?.nav);
  const linkAC = useLinkAutocomplete();
  const [showPagePicker, setShowPagePicker] = useState(false);

  const handleLinkSelect = useCallback(
    (title: string, relativePath: string) => {
      const result = linkAC.buildReplacement(editedContent, title, relativePath);
      if (result) {
        setEditedContent(result.newContent);
        requestAnimationFrame(() => {
          const ta = contentAreaRef.current?.getTextarea();
          if (ta) {
            ta.focus();
            ta.selectionStart = result.cursorPos;
            ta.selectionEnd = result.cursorPos;
          }
        });
      }
      linkAC.close();
    },
    [editedContent, linkAC],
  );

  const handlePagePickerSelect = useCallback(
    (title: string, relativePath: string) => {
      setShowPagePicker(false);
      const ta = contentAreaRef.current?.getTextarea();
      if (!ta) return;

      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const selectedText = editedContent.substring(s, e);
      const label = selectedText || title;
      const link = `[${label}](${relativePath})`;

      const newContent = editedContent.substring(0, s) + link + editedContent.substring(e);
      setEditedContent(newContent);
      requestAnimationFrame(() => {
        ta.focus();
        const newPos = s + link.length;
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
      });
    },
    [editedContent],
  );

  const isDirty = editedContent !== savedContent;
  const saveTimerRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  settingsRef.current = settings;
  const allowCloseRef = useRef(false);
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;
  const isAutosaveRef = useRef(false);
  const recoveryTimerRef = useRef<number | null>(null);
  const selectedPageRef = useRef<PageEntry | null>(null);
  selectedPageRef.current = selectedPage;
  const editedContentRef = useRef("");
  editedContentRef.current = editedContent;

  useEffect(() => {
    getRecentProjects()
      .then(setRecentProjects)
      .catch((err) => console.error("Failed to load recents:", err));
    isServeRunning()
      .then(setIsServing)
      .catch(() => {});
    loadSettings()
      .then((s) => { setSettings(s); settingsRef.current = s; })
      .catch((err) => console.error("Failed to load settings:", err));
  }, []);

  useEffect(() => {
    function applyTheme(mode: ThemeMode) {
      if (mode === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
      } else {
        document.documentElement.dataset.theme = mode;
      }
    }
    applyTheme(settings.theme);
    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async (event) => {
      if (allowCloseRef.current) return;
      if (isDirtyRef.current) {
        event.preventDefault();
        setPendingAction({ type: "close-window" });
      } else {
        event.preventDefault();
        forceCloseWindow();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  function flashSaved() {
    setSaveStatus("saved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function forceCloseWindow() {
    allowCloseRef.current = true;
    stopServe().catch((err: unknown) =>
      console.error("stopServe during close:", err),
    );
    const win = getCurrentWindow();
    win.destroy().catch((err: unknown) => {
      console.error("destroy failed, trying close:", err);
      win.close().catch((err2: unknown) =>
        console.error("close also failed:", err2),
      );
    });
  }

  function getExistingFolders(): string[] {
    if (!project) return [];
    const folders = new Set<string>();
    for (const p of project.pages) {
      const slash = p.relative_path.indexOf("/");
      if (slash !== -1) folders.add(p.relative_path.substring(0, slash));
    }
    return Array.from(folders).sort();
  }

  async function refreshProject(selectFilePath?: string) {
    if (!project) return;
    try {
      const updated = await openProjectByPath(project.root_path);
      setProject(updated);
      // Refresh site config for Site Preview
      readSiteConfig(updated.config_path)
        .then(setSiteConfig)
        .catch(() => {});
      const targetPath = selectFilePath || selectedPage?.file_path;
      if (targetPath) {
        const found = updated.pages.find((p) => p.file_path === targetPath);
        if (found) {
          setSelectedPage(found);
          const content = await loadPageContent(found.file_path);
          setEditedContent(content);
          setSavedContent(content);
        } else {
          setSelectedPage(null);
          setEditedContent("");
          setSavedContent("");
        }
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  }

  async function saveToRecents(data: ProjectData) {
    try {
      const entry: RecentProject = {
        name: data.site_name,
        root_path: data.root_path,
        docs_dir: data.docs_dir,
        config_path: data.config_path,
        last_opened: new Date().toISOString(),
        last_page: null,
      };
      const updated = await addRecentProject(entry);
      setRecentProjects(updated);
    } catch (err) {
      console.error("Failed to save recent:", err);
    }
  }

  // ── Health scan ─────────────────────────────────────

  async function runHealthScan() {
    if (!project) return;
    setIsScanning(true);
    try {
      const report = await scanProjectHealth(
        project.root_path,
        project.docs_dir,
        project.config_path,
      );
      setHealthReport(report);
    } catch (err: unknown) {
      console.error("Health scan failed:", err);
    } finally {
      setIsScanning(false);
    }
  }

  function handleOpenHealth() {
    setShowHealth(true);
    setShowBuild(false);
    runHealthScan();
  }

  async function handleHealthFixAction(action: string) {
    if (!project) return;
    if (action.startsWith("remove_nav:")) {
      const targetPath = action.substring("remove_nav:".length);
      if (project.nav) {
        const cleaned = removeNavEntryByPath(project.nav, targetPath);
        await writeNav(project.config_path, cleaned);
        await refreshProject();
        runHealthScan();
      }
    } else if (action.startsWith("add_nav:")) {
      const relativePath = action.substring("add_nav:".length);
      const page = project.pages.find((p) => p.relative_path === relativePath);
      if (page) {
        const currentNav = project.nav ?? [];
        const slash = relativePath.indexOf("/");
        const folder = slash !== -1 ? relativePath.substring(0, slash) : "";
        const updatedNav = addPageToNavSmart(
          currentNav,
          page.title,
          page.relative_path,
          folder,
        );
        await writeNav(project.config_path, updatedNav);
        await refreshProject();
        runHealthScan();
      }
    }
  }

  // ── Open project ────────────────────────────────────

  async function openAndSetProject(data: ProjectData) {
    setProject(data);
    setSelectedPage(null);
    setEditedContent("");
    setSavedContent("");
    setSaveStatus("idle");
    setShowHealth(false);
    setHealthReport(null);
    await saveToRecents(data);
    // Load site config for Site Preview
    readSiteConfig(data.config_path)
      .then(setSiteConfig)
      .catch((err) => console.error("Failed to load site config:", err));
  }

  async function handleOpenProject() {
    setWelcomeError("");
    try {
      const data = await pickAndOpenProject();
      if (data) await openAndSetProject(data);
    } catch (err: unknown) {
      setWelcomeError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenRecentProject(recent: RecentProject) {
    setWelcomeError("");
    try {
      const data = await openProjectByPath(recent.root_path);
      await openAndSetProject(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setWelcomeError(
        `Could not open "${recent.name}".\n${msg}\nYou can remove it from the list.`,
      );
    }
  }

  async function handleRemoveRecentProject(rootPath: string) {
    try {
      const updated = await removeRecentProject(rootPath);
      setRecentProjects(updated);
    } catch (err) {
      console.error("Failed to remove recent:", err);
    }
  }

  async function handleClearRecentProjects() {
    try {
      const updated = await clearRecentProjects();
      setRecentProjects(updated);
    } catch (err) {
      console.error("Failed to clear recents:", err);
    }
  }

  // ── New project ─────────────────────────────────────

  async function handleNewProject(
    parentDir: string,
    folderName: string,
    siteName: string,
    siteDescription: string,
    mklumeCredit: boolean,
  ) {
    setNewProjectError("");
    try {
      const projectPath = await scaffoldProject(
        parentDir,
        folderName,
        siteName,
        siteDescription,
        mklumeCredit,
      );
      setShowNewProject(false);
      const data = await openProjectByPath(projectPath);
      await openAndSetProject(data);
    } catch (err: unknown) {
      setNewProjectError(err instanceof Error ? err.message : String(err));
    }
  }

  // ── Select page ─────────────────────────────────────

  async function loadPage(page: PageEntry) {
    setSelectedPage(page);
    setSaveStatus("idle");
    setShowHealth(false);
    setShowBuild(false);
    try {
      const content = await loadPageContent(page.file_path);
      setEditedContent(content);
      setSavedContent(content);

      // Check for recovery draft
      if (settingsRef.current.recoveryDrafts && project) {
        const draft = await checkRecoveryDraft(project.root_path, page.file_path);
        if (draft && draft.content !== content) {
          setPendingRecovery(draft);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEditedContent(`Error loading file:\n${msg}`);
      setSavedContent("");
    }
  }

  function handleSelectPage(page: PageEntry) {
    if (isDirty && settingsRef.current.warnBeforePageSwitch) {
      setPendingAction({ type: "switch-page", page });
      return;
    }
    if (isDirty && !settingsRef.current.warnBeforePageSwitch) {
      // Auto-discard when warning disabled
    }
    loadPage(page);
  }

  // ── Close project ───────────────────────────────────

  function closeProject() {
    setProject(null);
    setSelectedPage(null);
    setEditedContent("");
    setSavedContent("");
    setSaveStatus("idle");
    setShowHealth(false);
    setHealthReport(null);
  }

  function handleCloseProject() {
    if (isDirty) {
      setPendingAction({ type: "close-project" });
      return;
    }
    closeProject();
  }

  function handleConfirmDiscard() {
    if (!pendingAction) return;
    if (pendingAction.type === "switch-page") loadPage(pendingAction.page);
    else if (pendingAction.type === "close-project") closeProject();
    else if (pendingAction.type === "close-window") forceCloseWindow();
    setPendingAction(null);
  }

  // ── Save ───────────────────────────────────────────

  const handleSave = useCallback(async (auto = false) => {
    if (!selectedPage || !isDirty) return;
    isAutosaveRef.current = auto;
    setSaveStatus("saving");
    try {
      // Backups only on manual save, not autosave
      if (!auto && settingsRef.current.backupBeforeSave && project) {
        await createBackup(selectedPage.file_path, project.root_path).catch(
          (err: unknown) => console.error("Backup failed:", err),
        );
      }
      await savePageContent(selectedPage.file_path, editedContent);
      setSavedContent(editedContent);
      // Clear recovery draft after successful save
      if (settingsRef.current.recoveryDrafts && project) {
        deleteRecoveryDraft(project.root_path, selectedPage.file_path).catch(
          (err: unknown) => console.error("Clear recovery draft failed:", err),
        );
      }
      flashSaved();
    } catch {
      setSaveStatus("error");
    } finally {
      isAutosaveRef.current = false;
    }
  }, [selectedPage, isDirty, editedContent, project]);

  // ── Command execution ──────────────────────────────

  const commandContext: CommandContext = {
    hasProject: !!project,
    hasPage: !!selectedPage,
    isDirty,
    isServing,
    viewMode,
  };

  const executeCommand = useCallback((id: string) => {
    switch (id) {
      // ── File ──
      case "file.newProject":
        setNewProjectError(""); setShowNewProject(true);
        break;
      case "file.openProject":
        handleOpenProject();
        break;
      case "file.save":
        handleSave();
        break;
      case "file.closeProject":
        handleCloseProject();
        break;
      case "file.newPage":
        if (project) { setNewPageError(""); setShowNewPage(true); }
        break;
      case "file.newGroup":
        if (project) { setNewGroupError(""); setShowNewGroup(true); }
        break;
      case "file.revealFile":
        if (selectedPage) {
          const dir = selectedPage.file_path.replace(/[\\/][^\\/]+$/, "");
          openFolderInExplorer(dir).catch((err: unknown) => console.error("Reveal file:", err));
        }
        break;
      case "file.revealProject":
        if (project) openFolderInExplorer(project.root_path).catch((err: unknown) => console.error("Reveal project:", err));
        break;
      case "file.revealDocs":
        if (project) openFolderInExplorer(project.docs_dir).catch((err: unknown) => console.error("Reveal docs:", err));
        break;
      case "file.openBackups":
        if (project) openFolderInExplorer(`${project.root_path}/.mklume/backups`).catch((err: unknown) => console.error("Open backups:", err));
        break;
      case "file.openRecovery":
        if (project) openFolderInExplorer(`${project.root_path}/.mklume/recovery`).catch((err: unknown) => console.error("Open recovery:", err));
        break;

      // ── Edit ──
      case "edit.copyAsMarkdown":
        if (selectedPage) {
          const ta = contentAreaRef.current?.getTextarea();
          if (ta) {
            const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
            navigator.clipboard.writeText(sel || editedContent).catch(() => {});
          } else {
            navigator.clipboard.writeText(editedContent).catch(() => {});
          }
        }
        break;
      case "edit.pasteAsPlainText":
        navigator.clipboard.readText().then((text) => {
          const ta = contentAreaRef.current?.getTextarea();
          if (ta) {
            const s = ta.selectionStart;
            const e = ta.selectionEnd;
            const newContent = editedContent.substring(0, s) + text + editedContent.substring(e);
            setEditedContent(newContent);
            requestAnimationFrame(() => {
              ta.focus();
              ta.selectionStart = s + text.length;
              ta.selectionEnd = s + text.length;
            });
          }
        }).catch(() => {});
        break;
      case "edit.find":
        setShowFind(true); setShowFindReplace(false);
        break;
      case "edit.findReplace":
        setShowFind(true); setShowFindReplace(true);
        break;

      // ── Paragraph (block insert in markdown mode) ──
      case "paragraph.h1":
        contentAreaRef.current?.execFormat("h1"); break;
      case "paragraph.h2":
        contentAreaRef.current?.execFormat("h2"); break;
      case "paragraph.h3":
        contentAreaRef.current?.execFormat("h3"); break;
      case "paragraph.h4":
        contentAreaRef.current?.execFormat("h4"); break;
      case "paragraph.h5":
        contentAreaRef.current?.execFormat("h5"); break;
      case "paragraph.h6":
        contentAreaRef.current?.execFormat("h6"); break;
      case "paragraph.quote":
        contentAreaRef.current?.execInsertBlock("quote"); break;
      case "paragraph.bulletList":
        contentAreaRef.current?.execInsertBlock("bullet-list"); break;
      case "paragraph.numberedList":
        contentAreaRef.current?.execInsertBlock("numbered-list"); break;
      case "paragraph.taskList":
        contentAreaRef.current?.execInsertBlock("task-list"); break;
      case "paragraph.codeBlock":
        contentAreaRef.current?.execInsertBlock("code"); break;
      case "paragraph.divider":
        contentAreaRef.current?.execInsertBlock("divider"); break;

      // ── Format ──
      case "format.bold":
        contentAreaRef.current?.execFormat("bold"); break;
      case "format.italic":
        contentAreaRef.current?.execFormat("italic"); break;
      case "format.inlineCode":
        contentAreaRef.current?.execFormat("inlineCode"); break;
      case "format.strikethrough":
        contentAreaRef.current?.execFormat("strikethrough"); break;
      case "format.link":
        contentAreaRef.current?.execFormat("link"); break;
      case "format.image":
        contentAreaRef.current?.execFormat("image"); break;

      // ── Insert ──
      case "insert.admonition":
        contentAreaRef.current?.execInsertBlock("note"); break;
      case "insert.details":
        contentAreaRef.current?.execInsertBlock("details"); break;
      case "insert.tabs":
        contentAreaRef.current?.execInsertBlock("tabs"); break;
      case "insert.gridCards":
        contentAreaRef.current?.execInsertBlock("grid-cards"); break;
      case "insert.table":
        contentAreaRef.current?.execInsertBlock("table"); break;
      case "insert.button":
        contentAreaRef.current?.execInsertBlock("button"); break;
      case "insert.link":
        contentAreaRef.current?.execInsertBlock("link"); break;
      case "insert.internalLink":
        if (project && selectedPage) setShowPagePicker(true); break;
      case "insert.image":
        contentAreaRef.current?.execInsertBlock("image"); break;
      case "insert.footnote":
        contentAreaRef.current?.execFormat("footnote"); break;
      case "insert.frontMatter":
        contentAreaRef.current?.execInsertBlock("front-matter"); break;
      case "insert.divider":
        contentAreaRef.current?.execInsertBlock("divider"); break;

      // ── View ──
      case "view.markdown":
        setViewMode("edit"); break;
      case "view.visual":
        setViewMode("visual"); break;
      case "view.preview":
        setViewMode("preview"); break;
      case "view.split":
        setViewMode("split"); break;
      case "view.toggleTheme": {
        const current = settings.theme;
        const next: ThemeMode = current === "dark" ? "light" : current === "light" ? "system" : "dark";
        const updated = { ...settings, theme: next };
        setSettings(updated);
        import("./services/projectService").then(({ saveSettings }) => saveSettings(updated)).catch(() => {});
        break;
      }
      case "view.buildPanel":
        setShowBuild(true); setShowHealth(false); break;
      case "view.healthPanel":
        handleOpenHealth(); break;
      case "view.settings":
        setShowSettings(true); break;
      case "view.siteSettings":
        if (project) setShowSiteSettings(true); break;

      // ── Tools ──
      case "tools.checkMkdocs":
        setShowBuild(true); setShowHealth(false);
        // BuildPanel handles its own check; opening it is enough for now
        break;
      case "tools.buildSite":
        setShowBuild(true); setShowHealth(false);
        break;
      case "tools.startPreview":
        if (project) {
          startServe(project.root_path).then(() => setIsServing(true)).catch((err: unknown) => console.error("Start serve:", err));
          setShowBuild(true); setShowHealth(false);
        }
        break;
      case "tools.stopPreview":
        stopServe().then(() => { setIsServing(false); setPreviewUrl(null); }).catch((err: unknown) => console.error("Stop serve:", err));
        break;
      case "tools.openInBrowser":
        openUrlInBrowser(previewUrl || "http://127.0.0.1:8000/").catch(() => {});
        break;
      case "tools.healthScan":
        handleOpenHealth(); break;
      case "tools.openBackups":
        if (project) openFolderInExplorer(`${project.root_path}/.mklume/backups`).catch((err: unknown) => console.error("Open backups:", err));
        break;
      case "tools.openRecovery":
        if (project) openFolderInExplorer(`${project.root_path}/.mklume/recovery`).catch((err: unknown) => console.error("Open recovery:", err));
        break;
      case "tools.gitSync":
        setShowGitSync(true); break;
      case "tools.deployAssistant":
        setShowDeployAssistant(true); break;
      case "tools.buildFolder":
      case "tools.buildZip":
      case "tools.buildBoth":
        setShowBuild(true); setShowHealth(false);
        break;
      case "tools.openSiteFolder":
        if (project) openFolderInExplorer(`${project.root_path}/site`).catch(() => {});
        break;
      case "tools.openDistFolder":
        if (project) openFolderInExplorer(`${project.root_path}/dist`).catch(() => {});
        break;

      // ── Help ──
      case "help.about":
        setShowAbout(true); break;
      case "help.docs":
        openUrlInBrowser("https://www.ecalstudios.com/mklume/").catch(() => {});
        break;
      case "help.offlineHelp":
        setShowOfflineHelp(true); break;
      case "help.github":
        openUrlInBrowser("https://github.com/ECalStudios/mklume").catch(() => {});
        break;
      case "help.reportIssue":
        openUrlInBrowser("https://github.com/ECalStudios/mklume/issues").catch(() => {});
        break;
      case "help.support":
        openUrlInBrowser("https://ko-fi.com/ecalstudios").catch(() => {});
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSave, handleCloseProject, handleOpenProject, project, selectedPage, editedContent, settings, previewUrl, isServing, viewMode]);

  // ── Keyboard shortcuts ──────────────────────────────
  // Centralized dispatch: intercept known app shortcuts.
  // Everything else passes through to the OS untouched.

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;

      // Escape closes overlays
      if (e.key === "Escape") {
        if (showCommandPalette) { setShowCommandPalette(false); e.preventDefault(); return; }
        return; // Let other escape handlers run
      }

      if (!mod) return;

      // Ctrl+Shift combinations
      if (e.shiftKey) {
        switch (e.key) {
          case "P":
          case "p":
            e.preventDefault();
            setShowCommandPalette((v) => !v);
            return;
          case "V":
          case "v":
            e.preventDefault();
            executeCommand("edit.pasteAsPlainText");
            return;
        }
        return;
      }

      switch (e.key) {
        case "s":
          e.preventDefault();
          handleSave();
          break;
        case "k":
          e.preventDefault();
          setShowCommandPalette((v) => !v);
          break;
        case "o":
          e.preventDefault();
          handleOpenProject();
          break;
        case "n":
          e.preventDefault();
          if (project) { setNewPageError(""); setShowNewPage(true); }
          else { setNewProjectError(""); setShowNewProject(true); }
          break;
        case "w":
          e.preventDefault();
          if (project) handleCloseProject();
          break;
        case "f":
          e.preventDefault();
          if (selectedPage && (viewMode === "edit" || viewMode === "split")) {
            setShowFind(true); setShowFindReplace(false);
          }
          break;
        case "h":
          e.preventDefault();
          if (selectedPage && (viewMode === "edit" || viewMode === "split")) {
            setShowFind(true); setShowFindReplace(true);
          }
          break;
        case ",":
          e.preventDefault();
          setShowSettings(true);
          break;
        case "1":
          e.preventDefault();
          if (selectedPage) setViewMode("edit");
          break;
        case "2":
          e.preventDefault();
          if (selectedPage) setViewMode("visual");
          break;
        case "3":
          e.preventDefault();
          if (selectedPage) setViewMode("preview");
          break;
        case "4":
          e.preventDefault();
          if (selectedPage) setViewMode("split");
          break;
        // Ctrl+B/I/E are handled at textarea level in ContentArea
        // No default — unknown combos pass through untouched
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, executeCommand, showCommandPalette, project, selectedPage, viewMode]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Autosave ───────────────────────────────────────

  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!settings.autosave || !isDirty || !selectedPage) return;
    autosaveTimerRef.current = window.setTimeout(() => {
      handleSave(true);
    }, settings.autosaveDelaySecs * 1000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [isDirty, editedContent, settings.autosave, settings.autosaveDelaySecs, selectedPage, handleSave]);

  // ── Recovery draft writing (debounced) ──────────────

  useEffect(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (!settings.recoveryDrafts || !isDirty || !selectedPage || !project) return;
    recoveryTimerRef.current = window.setTimeout(() => {
      const page = selectedPageRef.current;
      if (page && project) {
        writeRecoveryDraft(project.root_path, page.file_path, editedContentRef.current).catch(
          (err: unknown) => console.error("Recovery draft failed:", err),
        );
      }
    }, 2000);
    return () => {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, [isDirty, editedContent, settings.recoveryDrafts, selectedPage, project]);

  // ── Create page ─────────────────────────────────────

  async function handleCreatePage(
    title: string,
    filename: string,
    folder: string,
    shouldAddToNav: boolean,
  ) {
    if (!project) return;
    setNewPageError("");
    try {
      const entry = await createPage(project.docs_dir, folder, filename, title);
      if (shouldAddToNav) {
        const relPath = folder ? `${folder}/${filename}` : filename;
        const currentNav = project.nav ?? [];
        const updatedNav = addPageToNavSmart(currentNav, title, relPath, folder);
        await writeNav(project.config_path, updatedNav);
      }
      setShowNewPage(false);
      await refreshProject(entry.file_path);
    } catch (err: unknown) {
      setNewPageError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCreateGroup(
    folderName: string,
    displayName: string,
    createStarter: boolean,
  ) {
    if (!project) return;
    setNewGroupError("");
    try {
      const page = await createGroup(
        project.docs_dir,
        folderName,
        displayName,
        createStarter,
      );
      if (page) {
        const currentNav = project.nav ?? [];
        const groupEntry = {
          title: displayName,
          path: null as string | null,
          children: [
            { title: "Overview", path: page.relative_path, children: [] },
          ],
        };
        const updatedNav = [...currentNav, groupEntry];
        await writeNav(project.config_path, updatedNav);
        setShowNewGroup(false);
        await refreshProject(page.file_path);
      } else {
        setShowNewGroup(false);
        await refreshProject();
      }
    } catch (err: unknown) {
      setNewGroupError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRenamePage(newName: string, updateHeading: boolean) {
    if (!project || !renamingPage) return;
    setRenameError("");
    try {
      if (selectedPage?.file_path === renamingPage.file_path && isDirty) {
        await savePageContent(selectedPage.file_path, editedContent);
        setSavedContent(editedContent);
      }
      const updated = await renamePage(
        renamingPage.file_path,
        project.docs_dir,
        newName,
        updateHeading,
      );
      setRenamingPage(null);
      await refreshProject(updated.file_path);
    } catch (err: unknown) {
      setRenameError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleConfirmDelete() {
    if (!project || !deletingPage) return;
    try {
      await deletePage(deletingPage.file_path, project.root_path);
      if (project.nav && project.nav.length > 0) {
        const cleanedNav = removeNavEntryByPath(
          project.nav,
          deletingPage.relative_path,
        );
        await writeNav(project.config_path, cleanedNav);
      }
      if (selectedPage?.file_path === deletingPage.file_path) {
        setSelectedPage(null);
        setEditedContent("");
        setSavedContent("");
      }
      setDeletingPage(null);
      await refreshProject();
    } catch (err: unknown) {
      console.error("Delete failed:", err);
      setDeletingPage(null);
    }
  }

  // ── Navigation reorder ──────────────────────────────

  async function handleMoveNav(path: number[], direction: "up" | "down") {
    if (!project?.nav) return;
    const newNav = moveNavEntry(project.nav, path, direction);
    if (!newNav) return;
    try {
      await writeNav(project.config_path, newNav);
      await refreshProject();
    } catch (err: unknown) {
      console.error("Move failed:", err);
    }
  }

  async function handleDragMoveNav(
    fromPath: number[],
    toPath: number[],
    position: "before" | "after" | "inside",
  ) {
    if (!project?.nav) return;
    const newNav = dragMoveNavEntry(project.nav, fromPath, toPath, position);
    if (!newNav) return;
    try {
      await writeNav(project.config_path, newNav);
      await refreshProject();
    } catch (err: unknown) {
      console.error("Drag move failed:", err);
    }
  }

  async function handleAddToNavAction(page: PageEntry) {
    if (!project) return;
    const currentNav = project.nav ?? [];
    const slash = page.relative_path.indexOf("/");
    const folder = slash !== -1 ? page.relative_path.substring(0, slash) : "";
    const updatedNav = addPageToNavSmart(
      currentNav,
      page.title,
      page.relative_path,
      folder,
    );
    try {
      await writeNav(project.config_path, updatedNav);
      await refreshProject();
    } catch (err: unknown) {
      console.error("Add to nav failed:", err);
    }
  }

  async function handleConfirmRemoveFromNav() {
    if (!project?.nav || !removingNav) return;
    const newNav = removeNavEntry(project.nav, removingNav.path);
    try {
      await writeNav(project.config_path, newNav);
      setRemovingNav(null);
      await refreshProject();
    } catch (err: unknown) {
      console.error("Remove from nav failed:", err);
      setRemovingNav(null);
    }
  }

  async function handleConfirmCleanMissing() {
    if (!project?.nav) return;
    const existingPaths = new Set(project.pages.map((p) => p.relative_path));
    const cleanedNav = removeAllMissingEntries(project.nav, existingPaths);
    try {
      await writeNav(project.config_path, cleanedNav);
      setShowCleanMissing(false);
      await refreshProject();
    } catch (err: unknown) {
      console.error("Clean missing failed:", err);
      setShowCleanMissing(false);
    }
  }

  function getMissingCount(): number {
    if (!project?.nav) return 0;
    const existingPaths = new Set(project.pages.map((p) => p.relative_path));
    return countMissingEntries(project.nav, existingPaths);
  }

  // ── Render ──────────────────────────────────────────

  return (
    <div className="app-shell no-select">
      <div className="app-chrome">
        <TopBar
          project={project}
          onCloseProject={handleCloseProject}
          hasSelectedPage={!!selectedPage}
          isDirty={isDirty}
          saveStatus={saveStatus}
          onSave={handleSave}
          onOpenHealth={handleOpenHealth}
          onOpenBuild={() => { setShowBuild(true); setShowHealth(false); }}
          onOpenSettings={() => setShowSettings(true)}
          isServing={isServing}
          onOpenInBrowser={() => {
            openUrlInBrowser(previewUrl || "http://127.0.0.1:8000/").catch(() => {});
          }}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenGitSync={() => setShowGitSync(true)}
        />

        <AppMenuBar
          onExecute={executeCommand}
          context={commandContext}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasPage={!!selectedPage}
        />
      </div>

      <div className="app-main">
        {project ? (
          <>
            <Sidebar
              pages={project.pages}
              nav={project.nav ?? null}
              selectedPage={selectedPage}
              onSelectPage={handleSelectPage}
              onNewPage={() => { setNewPageError(""); setShowNewPage(true); }}
              onRefresh={() => refreshProject()}
              onRenamePage={(p) => { setRenameError(""); setRenamingPage(p); }}
              onDeletePage={(p) => setDeletingPage(p)}
              onMoveNav={handleMoveNav}
              onAddToNav={handleAddToNavAction}
              onRemoveFromNav={(path, title) => setRemovingNav({ path, title })}
              onCleanMissing={() => setShowCleanMissing(true)}
              onDragMoveNav={handleDragMoveNav}
              onNewGroup={() => { setNewGroupError(""); setShowNewGroup(true); }}
              projectRoot={project.root_path}
            />
            {showBuild ? (
              <BuildPanel
                projectRoot={project.root_path}
                onClose={() => setShowBuild(false)}
                onServingChange={setIsServing}
                onPreviewUrlChange={setPreviewUrl}
                onOpenDeployAssistant={() => { setShowBuild(false); setShowDeployAssistant(true); }}
              />
            ) : showHealth && healthReport ? (
              <HealthPanel
                report={healthReport}
                isScanning={isScanning}
                onRescan={runHealthScan}
                onClose={() => setShowHealth(false)}
                onFixAction={handleHealthFixAction}
              />
            ) : (
              <ContentArea
                ref={contentAreaRef}
                content={editedContent}
                selectedPage={selectedPage}
                isDirty={isDirty}
                onChange={setEditedContent}
                viewMode={viewMode}
                docsDir={project.docs_dir}
                editorFontSize={settings.editorFontSize}
                wordWrap={settings.wordWrap}
                findOpen={showFind}
                findReplaceOpen={showFindReplace}
                onFindClose={() => { setShowFind(false); setShowFindReplace(false); }}
                imageDragState={imageDragState}
                pageIndex={pageIndex}
                linkAutocomplete={linkAC.state}
                onCheckLinkTrigger={linkAC.checkTrigger}
                onLinkSelect={handleLinkSelect}
                onLinkClose={linkAC.close}
                previewType={previewType}
                onPreviewTypeChange={setPreviewType}
                splitEditor={splitEditor}
                onSplitEditorChange={setSplitEditor}
                nav={project.nav}
                pages={project.pages}
                siteName={project.site_name}
                siteConfig={siteConfig}
                onNavigate={handleSelectPage}
              />
            )}
          </>
        ) : (
          <div className="app-content">
            <WelcomeScreen
              onNewProject={() => { setNewProjectError(""); setShowNewProject(true); }}
              onOpenProject={handleOpenProject}
              onOpenRecentProject={handleOpenRecentProject}
              onRemoveRecentProject={handleRemoveRecentProject}
              onClearRecentProjects={handleClearRecentProjects}
              recentProjects={recentProjects}
              error={welcomeError}
              onDismissError={() => setWelcomeError("")}
            />
          </div>
        )}
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onExecute={executeCommand}
        context={commandContext}
      />

      {/* Page Picker for Insert Internal Link */}
      {showPagePicker && selectedPage && (
        <PagePickerDialog
          pageIndex={pageIndex}
          currentPagePath={selectedPage.relative_path}
          onSelect={handlePagePickerSelect}
          onClose={() => setShowPagePicker(false)}
        />
      )}

      {/* About dialog */}
      {showAbout && (
        <AboutDialog onClose={() => setShowAbout(false)} />
      )}

      {/* Offline Quick Help */}
      {showOfflineHelp && (
        <OfflineHelpDialog onClose={() => setShowOfflineHelp(false)} />
      )}

      {pendingAction && pendingAction.type === "close-window" && (
        <ConfirmDialog
          title="Unsaved Changes"
          message={`You have unsaved changes in "${selectedPage?.title}". Save before closing?`}
          confirmLabel="Save and Close"
          cancelLabel="Cancel"
          onConfirm={async () => {
            if (selectedPage) {
              try {
                await savePageContent(selectedPage.file_path, editedContent);
              } catch (err: unknown) {
                console.error("Save before close failed:", err);
              }
            }
            setPendingAction(null);
            forceCloseWindow();
          }}
          onCancel={() => setPendingAction(null)}
          secondaryLabel="Don't Save"
          onSecondary={() => {
            setPendingAction(null);
            forceCloseWindow();
          }}
        />
      )}

      {pendingAction && pendingAction.type !== "close-window" && (
        <ConfirmDialog
          title="Unsaved Changes"
          message={`You have unsaved changes in "${selectedPage?.title}". Save before continuing?`}
          confirmLabel="Save"
          cancelLabel="Cancel"
          onConfirm={async () => {
            if (selectedPage && isDirty) {
              try {
                if (settingsRef.current.backupBeforeSave && project) {
                  await createBackup(selectedPage.file_path, project.root_path).catch(
                    (err: unknown) => console.error("Backup failed:", err),
                  );
                }
                await savePageContent(selectedPage.file_path, editedContent);
                setSavedContent(editedContent);
                if (settingsRef.current.recoveryDrafts && project) {
                  deleteRecoveryDraft(project.root_path, selectedPage.file_path).catch(() => {});
                }
              } catch (err: unknown) {
                console.error("Save failed:", err);
              }
            }
            handleConfirmDiscard();
          }}
          onCancel={() => setPendingAction(null)}
          secondaryLabel="Don't Save"
          onSecondary={handleConfirmDiscard}
        />
      )}

      {showNewPage && (
        <NewPageDialog
          folders={getExistingFolders()}
          hasNav={!!(project?.nav && project.nav.length > 0)}
          onConfirm={handleCreatePage}
          onCancel={() => setShowNewPage(false)}
          error={newPageError}
        />
      )}

      {renamingPage && (
        <RenamePageDialog
          page={renamingPage}
          onConfirm={handleRenamePage}
          onCancel={() => setRenamingPage(null)}
          error={renameError}
        />
      )}

      {deletingPage && (
        <ConfirmDialog
          title="Delete Page"
          message={`Delete "${deletingPage.title}"?\nThe file will be moved to .mklume-trash for safety.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingPage(null)}
        />
      )}

      {removingNav && (
        <ConfirmDialog
          title="Remove from Navigation"
          message={`Remove "${removingNav.title}" from the navigation?\nThe file will not be deleted — it will move to Unlisted Pages.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onConfirm={handleConfirmRemoveFromNav}
          onCancel={() => setRemovingNav(null)}
        />
      )}

      {showCleanMissing && (
        <ConfirmDialog
          title="Clean Up Missing Entries"
          message={`Remove ${getMissingCount()} navigation ${getMissingCount() === 1 ? "entry that points" : "entries that point"} to files that no longer exist?\nThis will update mkdocs.yml but will not delete any files.`}
          confirmLabel="Clean Up"
          cancelLabel="Cancel"
          onConfirm={handleConfirmCleanMissing}
          onCancel={() => setShowCleanMissing(false)}
        />
      )}

      {showNewProject && (
        <NewProjectDialog
          onConfirm={handleNewProject}
          onCancel={() => setShowNewProject(false)}
          error={newProjectError}
        />
      )}

      {showNewGroup && (
        <NewGroupDialog
          onConfirm={handleCreateGroup}
          onCancel={() => setShowNewGroup(false)}
          error={newGroupError}
        />
      )}

      {pendingRecovery && (
        <ConfirmDialog
          title="Recovery Draft Found"
          message="A newer unsaved recovery draft was found for this page. It may contain changes from a previous session that weren't saved."
          confirmLabel="Restore Draft"
          cancelLabel="Keep Saved File"
          onConfirm={() => {
            setEditedContent(pendingRecovery.content);
            setPendingRecovery(null);
          }}
          onCancel={() => {
            if (project && selectedPage) {
              deleteRecoveryDraft(project.root_path, selectedPage.file_path).catch(() => {});
            }
            setPendingRecovery(null);
          }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
          projectRoot={project?.root_path ?? null}
        />
      )}

      {showSiteSettings && project && (
        <SiteSettingsPanel
          configPath={project.config_path}
          docsDir={project.docs_dir}
          projectRoot={project.root_path}
          nav={project.nav ?? null}
          isServing={isServing}
          backupEnabled={settings.backupBeforeSave}
          onClose={() => setShowSiteSettings(false)}
          onConfigSaved={() => refreshProject()}
        />
      )}

      {showGitSync && project && (
        <div className="dialog-overlay" onMouseDown={() => setShowGitSync(false)}>
          <div className="git-sync-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <GitSyncPanel
              projectRoot={project.root_path}
              isDirty={isDirty}
              onSave={handleSave}
              onClose={() => setShowGitSync(false)}
            />
          </div>
        </div>
      )}

      {showDeployAssistant && project && (
        <div className="dialog-overlay" onMouseDown={() => setShowDeployAssistant(false)}>
          <div className="deploy-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <DeployAssistant
              projectRoot={project.root_path}
              onClose={() => setShowDeployAssistant(false)}
              onOpenGitSync={() => { setShowDeployAssistant(false); setShowGitSync(true); }}
              onOpenBuild={() => { setShowDeployAssistant(false); setShowBuild(true); setShowHealth(false); }}
            />
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// ── About Dialog ──────────────────────────────────────

function AboutDialog({ onClose }: { onClose: () => void }) {
  const [version, setVersion] = useState("...");
  useEffect(() => {
    getAppVersion().then(setVersion).catch(() => setVersion("unknown"));
  }, []);

  function openLink(url: string) {
    openUrlInBrowser(url).catch(() => {});
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div className="about-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="about-dialog-content">
          <MkLumeIcon size={56} />
          <h2 className="about-dialog-title">MkLume</h2>
          <p className="about-dialog-version">Version {version}</p>
          <p className="about-dialog-desc">A visual desktop editor for MkDocs Material documentation.</p>
          <p className="about-dialog-copy">Create, edit, preview, and manage MkDocs Material sites locally.</p>

          <div className="about-dialog-links">
            <button className="about-dialog-link" onClick={() => openLink("https://www.ecalstudios.com/mklume/")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              Documentation
            </button>
            <button className="about-dialog-link" onClick={() => openLink("https://github.com/ECalStudios/mklume")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              GitHub
            </button>
            <button className="about-dialog-link" onClick={() => openLink("https://github.com/ECalStudios/mklume/issues")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Report Issue
            </button>
          </div>

          <div className="about-dialog-support">
            <p className="about-dialog-support-text">
              MkLume is free and open source. If it helps your documentation workflow, consider supporting development.
            </p>
            <button className="about-dialog-support-btn" onClick={() => openLink("https://ko-fi.com/ecalstudios")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              Support MkLume
            </button>
          </div>

          <div className="about-dialog-footer">
            <p className="about-dialog-author">Created by Enrique Cal — ECal Studios</p>
            <p className="about-dialog-license">Licensed under the GNU General Public License v3.0.</p>
            <p className="about-dialog-disclaimer">MkDocs and Material for MkDocs are independent open-source projects not affiliated with MkLume.</p>
          </div>
          <button className="about-dialog-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Offline Help Dialog ──────────────────────────────

import offlineHelpUrl from "./assets/offline-help/offline-quick-help.html?url";

function OfflineHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div className="offline-help-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="offline-help-header">
          <h2 className="offline-help-title">Offline Quick Help</h2>
          <button className="offline-help-close" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <iframe
          className="offline-help-iframe"
          src={offlineHelpUrl}
          title="MkLume Quick Help"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

export default App;
