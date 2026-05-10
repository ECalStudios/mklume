/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useEffect, useCallback } from "react";
import {
  readSiteConfig,
  writeSiteConfig,
  listDocsPages,
  createBackup,
  type SiteConfig,
  type SiteConfigUpdate,
  type PaletteEntry,
  type DocsPageInfo,
  type ExtraConfig,
  type ExtraConfigUpdate,
  type ExtraAnalytics,
  type ExtraSocialLink,
  type ExtraConsent,
  type ExtraAlternate,
} from "../../services/projectService";
import type { NavEntry } from "../../types/project";

interface SiteSettingsPanelProps {
  configPath: string;
  docsDir: string;
  projectRoot: string;
  nav: NavEntry[] | null;
  isServing: boolean;
  backupEnabled: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

type Section = "identity" | "theme" | "features" | "navigation" | "extras" | "extensions" | "raw";

// ── Material color options ──────────────────────────────

const MATERIAL_COLORS = [
  "red", "pink", "purple", "deep purple", "indigo", "blue",
  "light blue", "cyan", "teal", "green", "light green", "lime",
  "yellow", "amber", "orange", "deep orange", "brown", "grey",
  "blue grey", "black", "white", "custom",
];

// ── Feature definitions ─────────────────────────────────

interface FeatureDef {
  id: string;
  label: string;
  description: string;
}

const FEATURE_GROUPS: { group: string; features: FeatureDef[] }[] = [
  {
    group: "Navigation",
    features: [
      { id: "navigation.tabs", label: "Navigation tabs", description: "Top-level nav items appear as tabs" },
      { id: "navigation.tabs.sticky", label: "Sticky tabs", description: "Tabs stay visible when scrolling" },
      { id: "navigation.sections", label: "Sections", description: "Group sidebar items into sections" },
      { id: "navigation.expand", label: "Auto-expand", description: "Expand all sidebar sections by default" },
      { id: "navigation.path", label: "Navigation path", description: "Show breadcrumb navigation path" },
      { id: "navigation.indexes", label: "Section index pages", description: "Allow index pages for sections" },
      { id: "navigation.top", label: "Back to top", description: "Show back-to-top button" },
      { id: "navigation.footer", label: "Footer navigation", description: "Show prev/next in footer" },
      { id: "toc.follow", label: "TOC follow", description: "Auto-scroll table of contents" },
      { id: "toc.integrate", label: "TOC integrate", description: "Integrate TOC into sidebar" },
    ],
  },
  {
    group: "Search",
    features: [
      { id: "search.suggest", label: "Search suggestions", description: "Show search suggestions" },
      { id: "search.highlight", label: "Search highlight", description: "Highlight search terms on page" },
      { id: "search.share", label: "Search share", description: "Allow sharing search queries" },
    ],
  },
  {
    group: "Content",
    features: [
      { id: "content.code.copy", label: "Code copy button", description: "Add copy button to code blocks" },
      { id: "content.code.select", label: "Code line select", description: "Allow selecting code lines" },
      { id: "content.code.annotate", label: "Code annotations", description: "Enable code annotations" },
      { id: "content.tabs.link", label: "Linked tabs", description: "Sync content tabs across page" },
      { id: "content.tooltips", label: "Tooltips", description: "Enhanced tooltip rendering" },
      { id: "content.action.edit", label: "Edit button", description: "Show edit-this-page button" },
      { id: "content.action.view", label: "View source", description: "Show view-source button" },
    ],
  },
  {
    group: "Header",
    features: [
      { id: "header.autohide", label: "Auto-hide header", description: "Hide header on scroll down" },
      { id: "announce.dismiss", label: "Dismissible announcements", description: "Allow dismissing announcements" },
    ],
  },
];

const KNOWN_FEATURE_IDS = new Set(FEATURE_GROUPS.flatMap(g => g.features.map(f => f.id)));

// ── Common extensions ───────────────────────────────────

const RECOMMENDED_EXTENSIONS = [
  "admonition", "attr_list", "md_in_html", "tables", "toc",
  "pymdownx.details", "pymdownx.superfences", "pymdownx.tabbed",
  "pymdownx.emoji", "pymdownx.tasklist", "pymdownx.highlight",
  "pymdownx.inlinehilite", "pymdownx.snippets", "pymdownx.mark",
  "pymdownx.keys", "def_list", "footnotes", "abbr",
];

// ── Main Component ──────────────────────────────────────

function SiteSettingsPanel({
  configPath,
  docsDir,
  projectRoot,
  nav,
  isServing,
  backupEnabled,
  onClose,
  onConfigSaved,
}: SiteSettingsPanelProps) {
  const [section, setSection] = useState<Section>("identity");
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [draft, setDraft] = useState<SiteConfigUpdate>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [docsPages, setDocsPages] = useState<DocsPageInfo[]>([]);

  // Nav editing state
  const [editingNav, setEditingNav] = useState<NavEntry[] | null>(null);
  const [navDirty, setNavDirty] = useState(false);

  // Extra editing state
  const [extraDraft, setExtraDraft] = useState<ExtraConfigUpdate>({});

  // Load config
  useEffect(() => {
    loadConfig();
    loadDocsPages();
  }, [configPath]);

  async function loadConfig() {
    try {
      const cfg = await readSiteConfig(configPath);
      setConfig(cfg);
      setDraft({});
      setExtraDraft({});
      setIsDirty(false);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadDocsPages() {
    try {
      const pages = await listDocsPages(docsDir, configPath);
      setDocsPages(pages);
    } catch {
      // Non-critical
    }
  }

  // Initialize nav editing from current nav
  useEffect(() => {
    if (nav && !editingNav) {
      setEditingNav(JSON.parse(JSON.stringify(nav)));
    }
  }, [nav]);

  // Track dirty state
  const markDirty = useCallback(() => {
    setIsDirty(true);
    setSaveMsg(null);
  }, []);

  function updateDraft(patch: Partial<SiteConfigUpdate>) {
    setDraft(d => ({ ...d, ...patch }));
    markDirty();
  }

  function updateExtraDraft(patch: Partial<ExtraConfigUpdate>) {
    setExtraDraft(d => ({ ...d, ...patch }));
    markDirty();
  }

  // Get effective value (draft overrides config)
  function val(key: keyof SiteConfig): string {
    const draftKey = key as keyof SiteConfigUpdate;
    if (draftKey in draft && draft[draftKey] !== undefined) {
      return String(draft[draftKey]);
    }
    if (config && config[key] != null) {
      return String(config[key]);
    }
    return "";
  }

  function effectiveFeatures(): string[] {
    return draft.features ?? config?.features ?? [];
  }

  function effectivePalette(): PaletteEntry[] {
    return draft.palette ?? config?.palette ?? [];
  }

  function effectivePlugins(): string[] {
    return draft.plugins ?? config?.plugins ?? [];
  }

  function effectiveExtensions(): string[] {
    return draft.markdown_extensions ?? config?.markdown_extensions ?? [];
  }

  // ── Save ──────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      // Backup if enabled
      if (backupEnabled) {
        try {
          await createBackup(configPath, projectRoot);
        } catch {
          // Backup failure shouldn't block save
        }
      }

      // Build update with all changed fields
      const updates: SiteConfigUpdate = { ...draft };

      // Include extra updates if any
      const hasExtraChanges = Object.keys(extraDraft).length > 0;
      if (hasExtraChanges) {
        updates.extra = extraDraft;
      }

      // Include nav changes if dirty
      // Nav is saved via the existing write_nav command, not through site config
      await writeSiteConfig(configPath, updates);

      // If nav was edited, save it separately via the existing system
      if (navDirty && editingNav) {
        const { writeNav } = await import("../../services/projectService");
        await writeNav(configPath, editingNav);
        setNavDirty(false);
      }

      setSaveMsg("Saved successfully");
      setIsDirty(false);
      setDraft({});
      setExtraDraft({});
      onConfigSaved();

      // Reload config
      await loadConfig();
      await loadDocsPages();

      // Clear save message after a delay
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Sections config ───────────────────────────────────

  const sections: { key: Section; label: string; icon: JSX.Element }[] = [
    { key: "identity", label: "Identity", icon: <SvgIcon d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /> },
    { key: "theme", label: "Theme", icon: <SvgIcon d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2 10 10 0 0 0-7-13z" extra={<><circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/><circle cx="12" cy="7.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1.5" fill="currentColor"/></>} /> },
    { key: "features", label: "Features", icon: <SvgIcon d="M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5" /> },
    { key: "navigation", label: "Navigation", icon: <SvgIcon d="M3 12h18 M3 6h18 M3 18h18" /> },
    { key: "extras", label: "Extras", icon: <SvgIcon d="M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83" /> },
    { key: "extensions", label: "Extensions", icon: <SvgIcon d="M16 18 22 12 16 6 M8 6 2 12 8 18" /> },
    { key: "raw", label: "Raw YAML", icon: <SvgIcon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M10 13h4 M10 17h4" /> },
  ];

  if (error && !config) {
    return (
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-panel site-settings-panel" onClick={e => e.stopPropagation()}>
          <div className="site-settings-error">
            <h3>Could not load site configuration</h3>
            <p>{error}</p>
            <button className="build-action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-panel site-settings-panel" onClick={e => e.stopPropagation()}>
          <div className="site-settings-loading">Loading configuration...</div>
        </div>
      </div>
    );
  }

  const unlistedPages = docsPages.filter(p => !p.in_nav);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel site-settings-panel" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
            <h2 className="settings-sidebar-title">Site Settings</h2>
          </div>
          <nav className="settings-nav">
            {sections.map(s => (
              <button
                key={s.key}
                className={`settings-nav-item${section === s.key ? " active" : ""}`}
                onClick={() => setSection(s.key)}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="settings-content">
          <div className="settings-content-header">
            <h3 className="settings-section-title">
              {sections.find(s => s.key === section)?.label}
            </h3>
            <div className="site-settings-header-right">
              {isDirty && (
                <span className="save-indicator dirty">
                  <span className="dirty-dot" />Unsaved
                </span>
              )}
              {saveMsg && (
                <span className={`save-indicator ${saveMsg.includes("fail") || saveMsg.includes("Error") ? "error" : "saved"}`}>
                  {saveMsg}
                </span>
              )}
              {isServing && isDirty && (
                <span className="site-settings-hint">
                  Restart preview after saving to see changes
                </span>
              )}
              <button
                className={`build-action-btn accent${!isDirty && !navDirty ? " disabled" : ""}`}
                onClick={handleSave}
                disabled={saving || (!isDirty && !navDirty && Object.keys(extraDraft).length === 0)}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button className="settings-close-btn" onClick={onClose} title="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="settings-body">
            {section === "identity" && (
              <IdentitySection val={val} updateDraft={updateDraft} />
            )}

            {section === "theme" && (
              <ThemeSection
                val={val}
                palette={effectivePalette()}
                updateDraft={updateDraft}
              />
            )}

            {section === "features" && (
              <FeaturesSection
                features={effectiveFeatures()}
                onFeaturesChange={f => updateDraft({ features: f })}
              />
            )}

            {section === "navigation" && (
              <NavigationSection
                nav={editingNav}
                onNavChange={n => { setEditingNav(n); setNavDirty(true); markDirty(); }}
                unlistedPages={unlistedPages}
              />
            )}

            {section === "extras" && (
              <ExtrasSection
                extra={config.extra}
                extraDraft={extraDraft}
                updateExtraDraft={updateExtraDraft}
              />
            )}

            {section === "extensions" && (
              <ExtensionsSection
                plugins={effectivePlugins()}
                extensions={effectiveExtensions()}
                onPluginsChange={p => updateDraft({ plugins: p })}
                onExtensionsChange={e => updateDraft({ markdown_extensions: e })}
              />
            )}

            {section === "raw" && (
              <RawYamlSection raw={config.raw_yaml} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Identity Section ────────────────────────────────────

function IdentitySection({
  val,
  updateDraft,
}: {
  val: (key: keyof SiteConfig) => string;
  updateDraft: (patch: Partial<SiteConfigUpdate>) => void;
}) {
  return (
    <div className="settings-section">
      <FieldRow label="Site name" description="The name shown in the header and browser tab">
        <input
          className="dialog-input"
          value={val("site_name")}
          onChange={e => updateDraft({ site_name: e.target.value })}
          placeholder="My Documentation"
        />
      </FieldRow>
      <FieldRow label="Site description" description="Meta description for search engines">
        <input
          className="dialog-input"
          value={val("site_description")}
          onChange={e => updateDraft({ site_description: e.target.value })}
          placeholder="A description of your site"
        />
      </FieldRow>
      <FieldRow label="Site author" description="Default author name">
        <input
          className="dialog-input"
          value={val("site_author")}
          onChange={e => updateDraft({ site_author: e.target.value })}
          placeholder="Author Name"
        />
      </FieldRow>
      <FieldRow label="Site URL" description="The canonical URL of your documentation">
        <input
          className="dialog-input mono"
          value={val("site_url")}
          onChange={e => updateDraft({ site_url: e.target.value })}
          placeholder="https://example.com"
        />
      </FieldRow>

      <div className="settings-divider" />

      <FieldRow label="Repository URL" description="Link to your source repository">
        <input
          className="dialog-input mono"
          value={val("repo_url")}
          onChange={e => updateDraft({ repo_url: e.target.value })}
          placeholder="https://github.com/user/repo"
        />
      </FieldRow>
      <FieldRow label="Repository name" description="Display name for the repo link">
        <input
          className="dialog-input"
          value={val("repo_name")}
          onChange={e => updateDraft({ repo_name: e.target.value })}
          placeholder="GitHub"
        />
      </FieldRow>
      <FieldRow label="Edit URI" description="Path template for edit links">
        <input
          className="dialog-input mono"
          value={val("edit_uri")}
          onChange={e => updateDraft({ edit_uri: e.target.value })}
          placeholder="edit/main/docs/"
        />
      </FieldRow>

      <div className="settings-divider" />

      <FieldRow label="Copyright" description="Footer copyright text (supports HTML entities)">
        <input
          className="dialog-input"
          value={val("copyright")}
          onChange={e => updateDraft({ copyright: e.target.value })}
          placeholder="Copyright &copy; 2024 Your Name"
        />
      </FieldRow>
    </div>
  );
}

// ── Theme Section ───────────────────────────────────────

function ThemeSection({
  val,
  palette,
  updateDraft,
}: {
  val: (key: keyof SiteConfig) => string;
  palette: PaletteEntry[];
  updateDraft: (patch: Partial<SiteConfigUpdate>) => void;
}) {
  function updatePalette(index: number, patch: Partial<PaletteEntry>) {
    const newPalette = palette.map((p, i) => i === index ? { ...p, ...patch } : p);
    updateDraft({ palette: newPalette });
  }

  function addPalette() {
    updateDraft({
      palette: [...palette, { scheme: "default", primary: "indigo", accent: "indigo", toggle: null }],
    });
  }

  function removePalette(index: number) {
    updateDraft({ palette: palette.filter((_, i) => i !== index) });
  }

  return (
    <div className="settings-section">
      <FieldRow label="Logo" description="Path to logo image relative to docs/">
        <input
          className="dialog-input mono"
          value={val("theme_logo")}
          onChange={e => updateDraft({ theme_logo: e.target.value })}
          placeholder="assets/logo.png"
        />
      </FieldRow>
      <FieldRow label="Favicon" description="Path to favicon relative to docs/">
        <input
          className="dialog-input mono"
          value={val("theme_favicon")}
          onChange={e => updateDraft({ theme_favicon: e.target.value })}
          placeholder="assets/favicon.png"
        />
      </FieldRow>
      <FieldRow label="Language" description="Site language code">
        <input
          className="dialog-input"
          value={val("theme_language")}
          onChange={e => updateDraft({ theme_language: e.target.value })}
          placeholder="en"
          style={{ maxWidth: 100 }}
        />
      </FieldRow>

      <div className="settings-divider" />

      <div className="settings-row-label" style={{ padding: "12px 0 8px", fontWeight: 600, fontSize: 13 }}>
        Color Palette
      </div>
      <p className="site-settings-help-text">
        Add one palette for a single scheme, or two for a light/dark toggle.
      </p>

      {palette.map((p, i) => (
        <div key={i} className="site-palette-card">
          <div className="site-palette-card-header">
            <span className="site-palette-card-title">Palette {i + 1}</span>
            {palette.length > 1 && (
              <button className="site-palette-remove" onClick={() => removePalette(i)} title="Remove palette">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <div className="site-palette-fields">
            <label className="site-palette-label">
              <span>Scheme</span>
              <select
                className="dialog-select"
                value={p.scheme ?? "default"}
                onChange={e => updatePalette(i, { scheme: e.target.value })}
              >
                <option value="default">default (light)</option>
                <option value="slate">slate (dark)</option>
              </select>
            </label>
            <label className="site-palette-label">
              <span>Primary</span>
              <select
                className="dialog-select"
                value={p.primary ?? "indigo"}
                onChange={e => updatePalette(i, { primary: e.target.value })}
              >
                {MATERIAL_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="site-palette-label">
              <span>Accent</span>
              <select
                className="dialog-select"
                value={p.accent ?? "indigo"}
                onChange={e => updatePalette(i, { accent: e.target.value })}
              >
                {MATERIAL_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          {p.toggle && (
            <div className="site-palette-toggle-info">
              Toggle: {p.toggle.icon ?? "—"} / {p.toggle.name ?? "—"}
            </div>
          )}
        </div>
      ))}

      <button className="build-action-btn" onClick={addPalette} style={{ marginTop: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        Add palette entry
      </button>
    </div>
  );
}

// ── Features Section ────────────────────────────────────

function FeaturesSection({
  features,
  onFeaturesChange,
}: {
  features: string[];
  onFeaturesChange: (features: string[]) => void;
}) {
  function toggleFeature(id: string) {
    if (features.includes(id)) {
      onFeaturesChange(features.filter(f => f !== id));
    } else {
      onFeaturesChange([...features, id]);
    }
  }

  // Detect unknown/custom features
  const unknownFeatures = features.filter(f => !KNOWN_FEATURE_IDS.has(f));

  return (
    <div className="settings-section">
      <p className="site-settings-help-text">
        Toggle Material for MkDocs features. These control navigation, search, and content behavior.
      </p>

      {FEATURE_GROUPS.map(group => (
        <div key={group.group}>
          <div className="settings-row-label" style={{ padding: "12px 0 4px", fontWeight: 600, fontSize: 13 }}>
            {group.group}
          </div>
          {group.features.map(f => (
            <div key={f.id} className="settings-row site-feature-row">
              <div className="settings-row-info">
                <span className="settings-row-label">{f.label}</span>
                <span className="settings-row-desc">{f.description}</span>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={features.includes(f.id)}
                  onChange={() => toggleFeature(f.id)}
                />
                <span className="settings-toggle-track">
                  <span className="settings-toggle-thumb" />
                </span>
              </label>
            </div>
          ))}
        </div>
      ))}

      {unknownFeatures.length > 0 && (
        <>
          <div className="settings-divider" />
          <div className="settings-row-label" style={{ padding: "12px 0 4px", fontWeight: 600, fontSize: 13 }}>
            Custom / Unknown Features
          </div>
          <p className="site-settings-help-text">
            These features are in your config but not in the standard Material list. They are preserved safely.
          </p>
          {unknownFeatures.map(f => (
            <div key={f} className="settings-row site-feature-row">
              <div className="settings-row-info">
                <span className="settings-row-label" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{f}</span>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => toggleFeature(f)}
                />
                <span className="settings-toggle-track">
                  <span className="settings-toggle-thumb" />
                </span>
              </label>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Navigation Section ──────────────────────────────────

function NavigationSection({
  nav,
  onNavChange,
  unlistedPages,
}: {
  nav: NavEntry[] | null;
  onNavChange: (nav: NavEntry[]) => void;
  unlistedPages: DocsPageInfo[];
}) {
  const [addingPage, setAddingPage] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPath, setNewPath] = useState("");
  const [addType, setAddType] = useState<"page" | "section">("page");

  function moveItem(indexPath: number[], direction: "up" | "down") {
    if (!nav) return;
    const newNav = JSON.parse(JSON.stringify(nav));
    const parentPath = indexPath.slice(0, -1);
    const idx = indexPath[indexPath.length - 1];

    let arr = newNav;
    for (const p of parentPath) {
      arr = arr[p].children;
    }

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= arr.length) return;

    [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
    onNavChange(newNav);
  }

  function removeItem(indexPath: number[]) {
    if (!nav) return;
    const newNav = JSON.parse(JSON.stringify(nav));
    const parentPath = indexPath.slice(0, -1);
    const idx = indexPath[indexPath.length - 1];

    let arr = newNav;
    for (const p of parentPath) {
      arr = arr[p].children;
    }

    arr.splice(idx, 1);
    onNavChange(newNav);
  }

  function renameItem(indexPath: number[], newTitle: string) {
    if (!nav) return;
    const newNav = JSON.parse(JSON.stringify(nav));
    const parentPath = indexPath.slice(0, -1);
    const idx = indexPath[indexPath.length - 1];

    let arr = newNav;
    for (const p of parentPath) {
      arr = arr[p].children;
    }

    arr[idx].title = newTitle;
    onNavChange(newNav);
  }

  function addItem() {
    if (!nav) return;
    const newNav = JSON.parse(JSON.stringify(nav));
    if (addType === "page") {
      newNav.push({ title: newTitle || "New Page", path: newPath, children: [] });
    } else {
      newNav.push({ title: newTitle || "New Section", path: null, children: [] });
    }
    onNavChange(newNav);
    setAddingPage(false);
    setNewTitle("");
    setNewPath("");
  }

  function addUnlistedPage(page: DocsPageInfo) {
    if (!nav) return;
    const newNav = JSON.parse(JSON.stringify(nav));
    // Generate title from filename
    const title = page.relative_path
      .split("/").pop()!
      .replace(/\.md$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase());
    newNav.push({ title, path: page.relative_path, children: [] });
    onNavChange(newNav);
  }

  return (
    <div className="settings-section">
      <p className="site-settings-help-text">
        Edit your site navigation structure. Changes are saved to the <code>nav:</code> section of mkdocs.yml.
      </p>
      <div className="site-settings-help-box">
        <strong>Tips:</strong>
        <ul>
          <li><code>navigation.tabs</code> makes top-level items appear as header tabs</li>
          <li><code>navigation.sections</code> groups sidebar items with section headers</li>
          <li><code>navigation.indexes</code> allows index pages for sections</li>
        </ul>
      </div>

      {nav && nav.length > 0 ? (
        <div className="site-nav-tree">
          {nav.map((entry, i) => (
            <NavTreeItem
              key={`${i}-${entry.title}`}
              entry={entry}
              indexPath={[i]}
              isFirst={i === 0}
              isLast={i === nav.length - 1}
              onMove={moveItem}
              onRemove={removeItem}
              onRename={renameItem}
            />
          ))}
        </div>
      ) : (
        <div className="site-nav-empty">
          No navigation defined. Pages will be auto-discovered by MkDocs.
        </div>
      )}

      {/* Add new item */}
      {addingPage ? (
        <div className="site-nav-add-form">
          <div className="site-nav-add-row">
            <select className="dialog-select" value={addType} onChange={e => setAddType(e.target.value as "page" | "section")}>
              <option value="page">Page</option>
              <option value="section">Section</option>
            </select>
            <input
              className="dialog-input"
              placeholder="Title"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              autoFocus
            />
            {addType === "page" && (
              <input
                className="dialog-input mono"
                placeholder="path/to/page.md"
                value={newPath}
                onChange={e => setNewPath(e.target.value)}
              />
            )}
          </div>
          <div className="site-nav-add-actions">
            <button className="build-action-btn accent" onClick={addItem} disabled={!newTitle && !newPath}>Add</button>
            <button className="build-action-btn" onClick={() => { setAddingPage(false); setNewTitle(""); setNewPath(""); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="build-action-btn" onClick={() => setAddingPage(true)} style={{ marginTop: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Add nav item
        </button>
      )}

      {/* Unlisted pages */}
      {unlistedPages.length > 0 && (
        <>
          <div className="settings-divider" />
          <div className="settings-row-label" style={{ padding: "12px 0 4px", fontWeight: 600, fontSize: 13 }}>
            Unlisted Pages ({unlistedPages.length})
          </div>
          <p className="site-settings-help-text">
            These pages exist in the docs folder but are not in the nav. Click to add them.
          </p>
          <div className="site-unlisted-list">
            {unlistedPages.slice(0, 30).map(p => (
              <div key={p.relative_path} className="site-unlisted-item">
                <span className="site-unlisted-path">{p.relative_path}</span>
                <button
                  className="site-unlisted-add"
                  onClick={() => addUnlistedPage(p)}
                  title="Add to navigation"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  Add
                </button>
              </div>
            ))}
            {unlistedPages.length > 30 && (
              <div className="site-settings-help-text">...and {unlistedPages.length - 30} more</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Nav Tree Item (recursive) ───────────────────────────

function NavTreeItem({
  entry,
  indexPath,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onRename,
}: {
  entry: NavEntry;
  indexPath: number[];
  isFirst: boolean;
  isLast: boolean;
  onMove: (path: number[], dir: "up" | "down") => void;
  onRemove: (path: number[]) => void;
  onRename: (path: number[], title: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title);

  const isSection = !entry.path && entry.children.length > 0;
  const hasChildren = entry.children.length > 0;

  function commitRename() {
    if (editTitle.trim() && editTitle !== entry.title) {
      onRename(indexPath, editTitle.trim());
    }
    setEditing(false);
  }

  return (
    <div className="site-nav-item">
      <div className="site-nav-item-row">
        {hasChildren ? (
          <button className="site-nav-expand" onClick={() => setExpanded(!expanded)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          <span className="site-nav-leaf-spacer" />
        )}

        <span className={`site-nav-icon ${isSection ? "section" : "page"}`}>
          {isSection ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
          )}
        </span>

        {editing ? (
          <input
            className="site-nav-rename-input"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
        ) : (
          <span className="site-nav-title" onDoubleClick={() => { setEditTitle(entry.title); setEditing(true); }}>
            {entry.title}
          </span>
        )}

        {entry.path && (
          <span className="site-nav-path">{entry.path}</span>
        )}

        <div className="site-nav-actions">
          <button className="site-nav-action-btn" onClick={() => { setEditTitle(entry.title); setEditing(true); }} title="Rename">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button className="site-nav-action-btn" onClick={() => onMove(indexPath, "up")} disabled={isFirst} title="Move up">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button className="site-nav-action-btn" onClick={() => onMove(indexPath, "down")} disabled={isLast} title="Move down">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <button className="site-nav-action-btn danger" onClick={() => onRemove(indexPath)} title="Remove">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="site-nav-children">
          {entry.children.map((child, ci) => (
            <NavTreeItem
              key={`${ci}-${child.title}`}
              entry={child}
              indexPath={[...indexPath, ci]}
              isFirst={ci === 0}
              isLast={ci === entry.children.length - 1}
              onMove={onMove}
              onRemove={onRemove}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Extras Section ──────────────────────────────────────

const SOCIAL_ICON_PRESETS = [
  { value: "fontawesome/brands/github", label: "GitHub" },
  { value: "fontawesome/brands/youtube", label: "YouTube" },
  { value: "fontawesome/brands/x-twitter", label: "X / Twitter" },
  { value: "fontawesome/brands/discord", label: "Discord" },
  { value: "fontawesome/brands/linkedin", label: "LinkedIn" },
  { value: "fontawesome/brands/reddit", label: "Reddit" },
  { value: "fontawesome/brands/patreon", label: "Patreon" },
  { value: "fontawesome/solid/globe", label: "Website" },
  { value: "fontawesome/solid/store", label: "Store" },
  { value: "fontawesome/solid/envelope", label: "Email" },
  { value: "material/web", label: "Web (Material)" },
  { value: "material/email", label: "Email (Material)" },
];

function ExtrasSection({
  extra,
  extraDraft,
  updateExtraDraft,
}: {
  extra: ExtraConfig;
  extraDraft: ExtraConfigUpdate;
  updateExtraDraft: (patch: Partial<ExtraConfigUpdate>) => void;
}) {
  // ── Effective values (draft overrides loaded config) ────

  const effectiveAnalytics = (): ExtraAnalytics | null => {
    if (extraDraft.analytics !== undefined) return extraDraft.analytics;
    return extra.analytics;
  };

  const effectiveSocial = (): ExtraSocialLink[] => {
    if (extraDraft.social !== undefined) return extraDraft.social;
    return extra.social;
  };

  const effectiveConsent = (): ExtraConsent | null => {
    if (extraDraft.consent !== undefined) return extraDraft.consent;
    return extra.consent;
  };

  const effectiveGenerator = (): boolean | null => {
    if (extraDraft.generator !== undefined) return extraDraft.generator;
    return extra.generator;
  };

  const effectiveHomepage = (): string | null => {
    if (extraDraft.homepage !== undefined) return extraDraft.homepage;
    return extra.homepage;
  };

  const effectiveMklumeCredit = (): boolean | null => {
    if (extraDraft.mklume_credit !== undefined) return extraDraft.mklume_credit;
    return extra.mklume_credit;
  };

  const effectiveAlternate = (): ExtraAlternate[] => {
    if (extraDraft.alternate !== undefined) return extraDraft.alternate;
    return extra.alternate;
  };

  const analytics = effectiveAnalytics();
  const social = effectiveSocial();
  const consent = effectiveConsent();
  const generator = effectiveGenerator();
  const homepage = effectiveHomepage();
  const mklumeCredit = effectiveMklumeCredit();
  const alternate = effectiveAlternate();

  // ── Analytics ──────────────────────────────────────────

  const analyticsEnabled = analytics !== null;

  function toggleAnalytics() {
    if (analyticsEnabled) {
      updateExtraDraft({ analytics: null });
    } else {
      updateExtraDraft({ analytics: { provider: "google", property: "" } });
    }
  }

  function updateAnalytics(patch: Partial<ExtraAnalytics>) {
    const current = analytics ?? { provider: "google", property: null };
    updateExtraDraft({
      analytics: { ...current, ...patch } as ExtraAnalytics,
    });
  }

  // ── Consent ────────────────────────────────────────────

  const consentEnabled = consent !== null;

  function toggleConsent() {
    if (consentEnabled) {
      updateExtraDraft({ consent: null });
    } else {
      updateExtraDraft({
        consent: {
          title: "Cookie consent",
          description: "We use cookies to recognize your repeated visits and preferences.",
          actions: ["accept", "manage"],
        },
      });
    }
  }

  function updateConsent(patch: Partial<ExtraConsent>) {
    const current = consent ?? { title: null, description: null, actions: [] };
    updateExtraDraft({
      consent: { ...current, ...patch } as ExtraConsent,
    });
  }

  // ── Social ─────────────────────────────────────────────

  function addSocial() {
    updateExtraDraft({
      social: [...social, { icon: "fontawesome/solid/globe", link: "", name: "" }],
    });
  }

  function updateSocial(index: number, patch: Partial<ExtraSocialLink>) {
    const newSocial = social.map((s, i) => (i === index ? { ...s, ...patch } : s));
    updateExtraDraft({ social: newSocial });
  }

  function removeSocial(index: number) {
    updateExtraDraft({ social: social.filter((_, i) => i !== index) });
  }

  function moveSocial(index: number, direction: "up" | "down") {
    const newSocial = [...social];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newSocial.length) return;
    [newSocial[index], newSocial[targetIdx]] = [newSocial[targetIdx], newSocial[index]];
    updateExtraDraft({ social: newSocial });
  }

  // ── Generator ──────────────────────────────────────────

  const generatorEnabled = generator !== false;

  function toggleGenerator() {
    if (generatorEnabled) {
      updateExtraDraft({ generator: false });
    } else {
      updateExtraDraft({ generator: null }); // Remove = default (true)
    }
  }

  // ── MkLume Credit ──────────────────────────────────────

  const mklumeCreditEnabled = mklumeCredit === true;

  function toggleMklumeCredit() {
    if (mklumeCreditEnabled) {
      updateExtraDraft({ mklume_credit: null }); // Remove
    } else {
      updateExtraDraft({ mklume_credit: true });
    }
  }

  // ── Alternate Languages ────────────────────────────────

  function addAlternate() {
    updateExtraDraft({
      alternate: [...alternate, { name: "", link: "/", lang: "" }],
    });
  }

  function updateAlternate(index: number, patch: Partial<ExtraAlternate>) {
    const newAlt = alternate.map((a, i) => (i === index ? { ...a, ...patch } : a));
    updateExtraDraft({ alternate: newAlt });
  }

  function removeAlternate(index: number) {
    updateExtraDraft({ alternate: alternate.filter((_, i) => i !== index) });
  }

  // ── Warnings ───────────────────────────────────────────

  const warnings: string[] = [];
  if (analyticsEnabled && (!analytics?.property || analytics.property.trim() === "")) {
    warnings.push("Google Analytics is enabled but no measurement ID is set.");
  }
  if (consentEnabled && (!consent?.title || consent.title.trim() === "")) {
    warnings.push("Cookie consent is enabled but title is empty.");
  }
  for (let i = 0; i < social.length; i++) {
    if (!social[i].link || social[i].link!.trim() === "") {
      warnings.push(`Social link #${i + 1} is missing a URL.`);
    }
  }

  return (
    <div className="settings-section">
      {warnings.length > 0 && (
        <div className="extras-warnings">
          {warnings.map((w, i) => (
            <div key={i} className="extras-warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Analytics Card ──────────────────────────── */}
      <div className="extras-card">
        <div className="extras-card-header">
          <div className="extras-card-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
            </svg>
            <span className="extras-card-title">Google Analytics</span>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={analyticsEnabled} onChange={toggleAnalytics} />
            <span className="settings-toggle-track"><span className="settings-toggle-thumb" /></span>
          </label>
        </div>
        {analyticsEnabled && (
          <div className="extras-card-body">
            <div className="extras-field-row">
              <label className="extras-field-label">Provider</label>
              <select
                className="dialog-select"
                value={analytics?.provider ?? "google"}
                onChange={e => updateAnalytics({ provider: e.target.value })}
              >
                <option value="google">Google Analytics</option>
              </select>
            </div>
            <div className="extras-field-row">
              <label className="extras-field-label">Measurement ID</label>
              <input
                className="dialog-input mono"
                value={analytics?.property ?? ""}
                onChange={e => updateAnalytics({ property: e.target.value })}
                placeholder="G-XXXXXXXXXX"
              />
            </div>
            <p className="site-settings-help-text">
              Material for MkDocs integrates Google Analytics automatically through this config.
            </p>
          </div>
        )}
      </div>

      {/* ── Cookie Consent Card ─────────────────────── */}
      <div className="extras-card">
        <div className="extras-card-header">
          <div className="extras-card-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/>
            </svg>
            <span className="extras-card-title">Cookie Consent</span>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={consentEnabled} onChange={toggleConsent} />
            <span className="settings-toggle-track"><span className="settings-toggle-thumb" /></span>
          </label>
        </div>
        {consentEnabled && (
          <div className="extras-card-body">
            <div className="extras-field-row">
              <label className="extras-field-label">Title</label>
              <input
                className="dialog-input"
                value={consent?.title ?? ""}
                onChange={e => updateConsent({ title: e.target.value })}
                placeholder="Cookie consent"
              />
            </div>
            <div className="extras-field-row">
              <label className="extras-field-label">Description</label>
              <textarea
                className="dialog-input extras-textarea"
                value={consent?.description ?? ""}
                onChange={e => updateConsent({ description: e.target.value })}
                placeholder="We use cookies to recognize your repeated visits and preferences."
                rows={3}
              />
            </div>
            <p className="site-settings-help-text">
              Commonly used with Google Analytics. Shows a consent banner to visitors.
            </p>
          </div>
        )}
      </div>

      {/* ── Social Links Card ───────────────────────── */}
      <div className="extras-card">
        <div className="extras-card-header">
          <div className="extras-card-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="M18 2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6.06a12 12 0 0 0-3.85 4.18"/>
            </svg>
            <span className="extras-card-title">Social Links</span>
          </div>
          <button className="build-action-btn" onClick={addSocial} style={{ fontSize: 11, padding: "3px 10px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Add
          </button>
        </div>
        <div className="extras-card-body">
          {social.length === 0 ? (
            <p className="site-settings-help-text" style={{ margin: 0, fontStyle: "italic" }}>
              No social links configured. These appear in the site footer.
            </p>
          ) : (
            <div className="extras-social-list">
              {social.map((s, i) => (
                <div key={i} className="extras-social-item">
                  <div className="extras-social-fields">
                    <div className="extras-field-row compact">
                      <label className="extras-field-label-sm">Icon</label>
                      <select
                        className="dialog-select"
                        value={SOCIAL_ICON_PRESETS.find(p => p.value === s.icon) ? s.icon ?? "" : "__custom__"}
                        onChange={e => {
                          if (e.target.value === "__custom__") return;
                          updateSocial(i, { icon: e.target.value });
                        }}
                      >
                        {SOCIAL_ICON_PRESETS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                        {!SOCIAL_ICON_PRESETS.find(p => p.value === s.icon) && (
                          <option value="__custom__">Custom: {s.icon}</option>
                        )}
                      </select>
                      {!SOCIAL_ICON_PRESETS.find(p => p.value === s.icon) && (
                        <input
                          className="dialog-input mono"
                          value={s.icon ?? ""}
                          onChange={e => updateSocial(i, { icon: e.target.value })}
                          placeholder="fontawesome/brands/..."
                          style={{ flex: 1 }}
                        />
                      )}
                    </div>
                    <div className="extras-field-row compact">
                      <label className="extras-field-label-sm">URL</label>
                      <input
                        className="dialog-input mono"
                        value={s.link ?? ""}
                        onChange={e => updateSocial(i, { link: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="extras-field-row compact">
                      <label className="extras-field-label-sm">Name</label>
                      <input
                        className="dialog-input"
                        value={s.name ?? ""}
                        onChange={e => updateSocial(i, { name: e.target.value })}
                        placeholder="Display name"
                      />
                    </div>
                  </div>
                  <div className="extras-social-actions">
                    <button className="site-nav-action-btn" onClick={() => moveSocial(i, "up")} disabled={i === 0} title="Move up">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button className="site-nav-action-btn" onClick={() => moveSocial(i, "down")} disabled={i === social.length - 1} title="Move down">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <button className="site-nav-action-btn danger" onClick={() => removeSocial(i)} title="Remove">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer / Generator Card ─────────────────── */}
      <div className="extras-card">
        <div className="extras-card-header">
          <div className="extras-card-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/>
            </svg>
            <span className="extras-card-title">Footer / Generator</span>
          </div>
        </div>
        <div className="extras-card-body">
          <div className="settings-row site-feature-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Show generator notice</span>
              <span className="settings-row-desc">Display "Made with Material for MkDocs" in footer</span>
            </div>
            <label className="settings-toggle">
              <input type="checkbox" checked={generatorEnabled} onChange={toggleGenerator} />
              <span className="settings-toggle-track"><span className="settings-toggle-thumb" /></span>
            </label>
          </div>
          <div className="settings-row site-feature-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Show MkLume credit</span>
              <span className="settings-row-desc">Add a small "Built with MkLume" link to the site footer</span>
            </div>
            <label className="settings-toggle">
              <input type="checkbox" checked={mklumeCreditEnabled} onChange={toggleMklumeCredit} />
              <span className="settings-toggle-track"><span className="settings-toggle-thumb" /></span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Homepage & Custom Links Card ─────────────── */}
      <div className="extras-card">
        <div className="extras-card-header">
          <div className="extras-card-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <span className="extras-card-title">Homepage & Links</span>
          </div>
        </div>
        <div className="extras-card-body">
          <div className="extras-field-row">
            <label className="extras-field-label">Homepage URL</label>
            <input
              className="dialog-input mono"
              value={homepage ?? ""}
              onChange={e => updateExtraDraft({ homepage: e.target.value || null })}
              placeholder="https://example.com"
            />
          </div>
          <p className="site-settings-help-text">
            Custom values can be used by templates, overrides, or future MkLume features.
          </p>
        </div>
      </div>

      {/* ── Alternate Languages Card ────────────────── */}
      <div className="extras-card">
        <div className="extras-card-header">
          <div className="extras-card-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
            </svg>
            <span className="extras-card-title">Alternate Languages</span>
          </div>
          <button className="build-action-btn" onClick={addAlternate} style={{ fontSize: 11, padding: "3px 10px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Add
          </button>
        </div>
        <div className="extras-card-body">
          {alternate.length === 0 ? (
            <p className="site-settings-help-text" style={{ margin: 0, fontStyle: "italic" }}>
              No alternate languages configured. Used for multi-language sites.
            </p>
          ) : (
            <div className="extras-social-list">
              {alternate.map((a, i) => (
                <div key={i} className="extras-social-item">
                  <div className="extras-social-fields">
                    <div className="extras-field-row compact">
                      <label className="extras-field-label-sm">Name</label>
                      <input
                        className="dialog-input"
                        value={a.name ?? ""}
                        onChange={e => updateAlternate(i, { name: e.target.value })}
                        placeholder="English"
                      />
                    </div>
                    <div className="extras-field-row compact">
                      <label className="extras-field-label-sm">Link</label>
                      <input
                        className="dialog-input mono"
                        value={a.link ?? ""}
                        onChange={e => updateAlternate(i, { link: e.target.value })}
                        placeholder="/"
                      />
                    </div>
                    <div className="extras-field-row compact">
                      <label className="extras-field-label-sm">Lang</label>
                      <input
                        className="dialog-input"
                        value={a.lang ?? ""}
                        onChange={e => updateAlternate(i, { lang: e.target.value })}
                        placeholder="en"
                        style={{ maxWidth: 80 }}
                      />
                    </div>
                  </div>
                  <div className="extras-social-actions">
                    <button className="site-nav-action-btn danger" onClick={() => removeAlternate(i)} title="Remove">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Custom Extras Card ──────────────────────── */}
      {extra.custom.length > 0 && (
        <div className="extras-card">
          <div className="extras-card-header">
            <div className="extras-card-title-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M10 13h4"/><path d="M10 17h4"/>
              </svg>
              <span className="extras-card-title">Custom Extras</span>
            </div>
          </div>
          <div className="extras-card-body">
            <p className="site-settings-help-text">
              These custom values in your <code>extra:</code> section are preserved safely when saving.
            </p>
            <div className="extras-custom-list">
              {extra.custom.map(c => (
                <div key={c.key} className="extras-custom-item">
                  <span className="extras-custom-key">{c.key}</span>
                  <span className="extras-custom-value">{c.value_display}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Extensions Section ──────────────────────────────────

function ExtensionsSection({
  plugins,
  extensions,
  onPluginsChange,
  onExtensionsChange,
}: {
  plugins: string[];
  extensions: string[];
  onPluginsChange: (p: string[]) => void;
  onExtensionsChange: (e: string[]) => void;
}) {
  const [showAddExt, setShowAddExt] = useState(false);

  const availableExts = RECOMMENDED_EXTENSIONS.filter(e => !extensions.includes(e));

  return (
    <div className="settings-section">
      <div className="settings-row-label" style={{ padding: "0 0 4px", fontWeight: 600, fontSize: 13 }}>
        Plugins ({plugins.length})
      </div>
      <p className="site-settings-help-text">
        MkDocs plugins currently enabled in your project.
      </p>
      <div className="site-ext-list">
        {plugins.map(p => (
          <div key={p} className="site-ext-item">
            <span className="site-ext-name">{p}</span>
            <button className="site-ext-remove" onClick={() => onPluginsChange(plugins.filter(x => x !== p))} title="Remove">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
        {plugins.length === 0 && (
          <div className="site-settings-help-text">No plugins configured.</div>
        )}
      </div>

      <div className="settings-divider" />

      <div className="settings-row-label" style={{ padding: "12px 0 4px", fontWeight: 600, fontSize: 13 }}>
        Markdown Extensions ({extensions.length})
      </div>
      <p className="site-settings-help-text">
        Markdown extensions enhance your documentation with admonitions, code highlighting, tabs, and more.
        Extensions with sub-configuration (like <code>toc</code> or <code>pymdownx.emoji</code>) will have their config preserved when saved.
      </p>
      <div className="site-ext-list">
        {extensions.map(e => (
          <div key={e} className="site-ext-item">
            <span className="site-ext-name">{e}</span>
            <button className="site-ext-remove" onClick={() => onExtensionsChange(extensions.filter(x => x !== e))} title="Remove">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
      </div>

      {showAddExt && availableExts.length > 0 ? (
        <div className="site-ext-add-list">
          {availableExts.map(e => (
            <button key={e} className="site-ext-add-item" onClick={() => { onExtensionsChange([...extensions, e]); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              {e}
            </button>
          ))}
          <button className="build-action-btn" onClick={() => setShowAddExt(false)} style={{ marginTop: 4 }}>Done</button>
        </div>
      ) : (
        <button className="build-action-btn" onClick={() => setShowAddExt(true)} style={{ marginTop: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Add extension
        </button>
      )}
    </div>
  );
}

// ── Raw YAML Section ────────────────────────────────────

function RawYamlSection({ raw }: { raw: string }) {
  return (
    <div className="settings-section">
      <p className="site-settings-help-text">
        Read-only view of your mkdocs.yml file. Edit individual settings using the other tabs,
        or edit the file directly in your code editor.
      </p>
      <pre className="site-raw-yaml">{raw}</pre>
    </div>
  );
}

// ── Shared Components ───────────────────────────────────

function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        <span className="settings-row-desc">{description}</span>
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function SvgIcon({ d, extra }: { d: string; extra?: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {extra}
    </svg>
  );
}

export default SiteSettingsPanel;
