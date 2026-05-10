import { useState, useEffect } from "react";
import type { AppSettings, ThemeMode } from "../../types/project";
import MkLumeIcon from "../common/MkLumeIcon";
import {
  saveSettings,
  testMkdocsCommand,
  getAppVersion,
  openFolderInExplorer,
  openUrlInBrowser,
  clearRecoveryDrafts,
  countRecoveryDrafts,
  countBackups,
} from "../../services/projectService";

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  projectRoot: string | null;
}

type Section = "general" | "editor" | "mkdocs" | "safety" | "about";

function SettingsPanel({
  settings,
  onSettingsChange,
  onClose,
  projectRoot,
}: SettingsPanelProps) {
  const [section, setSection] = useState<Section>("general");
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [mkdocsTestResult, setMkdocsTestResult] = useState<string | null>(null);
  const [mkdocsTestError, setMkdocsTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [backupCount, setBackupCount] = useState(0);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  useEffect(() => {
    getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    setLocal({ ...settings });
  }, [settings]);

  useEffect(() => {
    if (section === "safety" && projectRoot) {
      countRecoveryDrafts(projectRoot).then(setRecoveryCount).catch(() => {});
      countBackups(projectRoot).then(setBackupCount).catch(() => {});
    }
  }, [section, projectRoot]);

  function update(patch: Partial<AppSettings>) {
    const next = { ...local, ...patch };
    setLocal(next);
    onSettingsChange(next);
    saveSettings(next).catch((err) =>
      console.error("Failed to save settings:", err),
    );
  }

  async function handleTestMkdocs() {
    setIsTesting(true);
    setMkdocsTestResult(null);
    setMkdocsTestError(null);
    try {
      const result = await testMkdocsCommand(local.mkdocsCommand);
      setMkdocsTestResult(result);
    } catch (err: unknown) {
      setMkdocsTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTesting(false);
    }
  }

  const sections: { key: Section; label: string; icon: JSX.Element }[] = [
    {
      key: "general",
      label: "General",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      key: "editor",
      label: "Editor",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      ),
    },
    {
      key: "mkdocs",
      label: "MkDocs",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      key: "safety",
      label: "Safety",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
      ),
    },
    {
      key: "about",
      label: "About",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
            <h2 className="settings-sidebar-title">Settings</h2>
          </div>
          <nav className="settings-nav">
            {sections.map((s) => (
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

        <div className="settings-content">
          <div className="settings-content-header">
            <h3 className="settings-section-title">
              {sections.find((s) => s.key === section)?.label}
            </h3>
            <button className="settings-close-btn" onClick={onClose} title="Close settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="settings-body">
            {section === "general" && (
              <div className="settings-section">
                <SettingRow
                  label="Start behavior"
                  description="What to show when the app opens"
                >
                  <select
                    className="dialog-select"
                    value={local.startBehavior}
                    onChange={(e) =>
                      update({ startBehavior: e.target.value as AppSettings["startBehavior"] })
                    }
                  >
                    <option value="welcome">Show welcome screen</option>
                    <option value="reopen">Reopen last project</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Theme"
                  description="Visual theme for the app"
                >
                  <select
                    className="dialog-select"
                    value={local.theme}
                    onChange={(e) =>
                      update({ theme: e.target.value as ThemeMode })
                    }
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </SettingRow>
              </div>
            )}

            {section === "editor" && (
              <div className="settings-section">
                <SettingRow
                  label="Font size"
                  description="Editor font size in pixels"
                >
                  <div className="settings-number-row">
                    <input
                      type="range"
                      min={10}
                      max={24}
                      value={local.editorFontSize}
                      onChange={(e) =>
                        update({ editorFontSize: Number(e.target.value) })
                      }
                      className="settings-range"
                    />
                    <span className="settings-number-label">
                      {local.editorFontSize}px
                    </span>
                  </div>
                </SettingRow>

                <SettingToggle
                  label="Word wrap"
                  description="Wrap long lines in the editor"
                  checked={local.wordWrap}
                  onChange={(v) => update({ wordWrap: v })}
                />

                <SettingToggle
                  label="Autosave"
                  description="Automatically save changes after a delay"
                  checked={local.autosave}
                  onChange={(v) => update({ autosave: v })}
                />

                {local.autosave && (
                  <SettingRow
                    label="Autosave delay"
                    description="Seconds to wait after last edit before saving"
                  >
                    <div className="settings-number-row">
                      <input
                        type="range"
                        min={2}
                        max={30}
                        value={local.autosaveDelaySecs}
                        onChange={(e) =>
                          update({ autosaveDelaySecs: Number(e.target.value) })
                        }
                        className="settings-range"
                      />
                      <span className="settings-number-label">
                        {local.autosaveDelaySecs}s
                      </span>
                    </div>
                  </SettingRow>
                )}
              </div>
            )}

            {section === "mkdocs" && (
              <div className="settings-section">
                <SettingRow
                  label="Python command"
                  description="Command to invoke Python on your system"
                >
                  <select
                    className="dialog-select"
                    value={
                      ["python", "py"].includes(local.pythonCommand)
                        ? local.pythonCommand
                        : "custom"
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v !== "custom") update({ pythonCommand: v });
                    }}
                  >
                    <option value="python">python</option>
                    <option value="py">py</option>
                    <option value="custom">Custom...</option>
                  </select>
                  {!["python", "py"].includes(local.pythonCommand) && (
                    <input
                      className="dialog-input mono"
                      value={local.pythonCommand}
                      onChange={(e) =>
                        update({ pythonCommand: e.target.value })
                      }
                      placeholder="e.g. python3"
                      style={{ marginTop: 6 }}
                    />
                  )}
                </SettingRow>

                <SettingRow
                  label="MkDocs command"
                  description="Command to invoke MkDocs"
                >
                  <select
                    className="dialog-select"
                    value={
                      ["mkdocs", "python -m mkdocs"].includes(local.mkdocsCommand)
                        ? local.mkdocsCommand
                        : "custom"
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v !== "custom") update({ mkdocsCommand: v });
                    }}
                  >
                    <option value="mkdocs">mkdocs</option>
                    <option value="python -m mkdocs">python -m mkdocs</option>
                    <option value="custom">Custom...</option>
                  </select>
                  {!["mkdocs", "python -m mkdocs"].includes(local.mkdocsCommand) && (
                    <input
                      className="dialog-input mono"
                      value={local.mkdocsCommand}
                      onChange={(e) =>
                        update({ mkdocsCommand: e.target.value })
                      }
                      placeholder="e.g. python3 -m mkdocs"
                      style={{ marginTop: 6 }}
                    />
                  )}
                </SettingRow>

                <div className="settings-row" style={{ marginTop: 8 }}>
                  <button
                    className="build-action-btn accent"
                    onClick={handleTestMkdocs}
                    disabled={isTesting}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {isTesting ? "Testing..." : "Test MkDocs Command"}
                  </button>
                </div>
                {mkdocsTestResult && (
                  <div className="settings-test-result success">
                    {mkdocsTestResult}
                  </div>
                )}
                {mkdocsTestError && (
                  <div className="settings-test-result error">
                    {mkdocsTestError}
                  </div>
                )}
              </div>
            )}

            {section === "safety" && (
              <div className="settings-section">
                <SettingToggle
                  label="Backup before saving"
                  description="Create a backup copy before manual save (not autosave)"
                  checked={local.backupBeforeSave}
                  onChange={(v) => update({ backupBeforeSave: v })}
                />

                <SettingToggle
                  label="Recovery drafts"
                  description="Keep local recovery copies in case the app closes unexpectedly"
                  checked={local.recoveryDrafts}
                  onChange={(v) => update({ recoveryDrafts: v })}
                />

                <SettingToggle
                  label="Warn before switching pages"
                  description="Show a dialog when switching pages with unsaved changes"
                  checked={local.warnBeforePageSwitch}
                  onChange={(v) => update({ warnBeforePageSwitch: v })}
                />

                <SettingToggle
                  label="Warn before deleting pages"
                  description="Show a confirmation dialog before deleting files"
                  checked={local.warnBeforeDelete}
                  onChange={(v) => update({ warnBeforeDelete: v })}
                />

                <SettingToggle
                  label="Warn before removing from recent list"
                  description="Ask for confirmation when removing a project from recents"
                  checked={local.warnBeforeRemoveRecent}
                  onChange={(v) => update({ warnBeforeRemoveRecent: v })}
                />

                <SettingToggle
                  label="Confirm before overwriting files"
                  description="Ask for confirmation before overwriting existing files"
                  checked={local.confirmOverwrite}
                  onChange={(v) => update({ confirmOverwrite: v })}
                />

                {projectRoot && (
                  <>
                    <div className="settings-divider" />
                    <div className="settings-row-label" style={{ padding: "12px 0 4px", fontWeight: 600, fontSize: 13 }}>
                      Maintenance
                    </div>
                    <div className="settings-maintenance-row">
                      <button
                        className="settings-maintenance-btn"
                        onClick={() => openFolderInExplorer(`${projectRoot}/.mklume/backups`)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                        </svg>
                        Open backups folder
                        <span className="settings-maintenance-count">{backupCount} files</span>
                      </button>
                    </div>
                    <div className="settings-maintenance-row">
                      <button
                        className="settings-maintenance-btn"
                        onClick={() => openFolderInExplorer(`${projectRoot}/.mklume/recovery`)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                        </svg>
                        Open recovery folder
                        <span className="settings-maintenance-count">{recoveryCount} drafts</span>
                      </button>
                    </div>
                    <div className="settings-maintenance-row">
                      <button
                        className="settings-maintenance-btn danger"
                        disabled={recoveryCount === 0}
                        onClick={async () => {
                          const cleared = await clearRecoveryDrafts(projectRoot);
                          setRecoveryCount(0);
                          setClearMsg(`Cleared ${cleared} recovery draft${cleared !== 1 ? "s" : ""}.`);
                          setTimeout(() => setClearMsg(null), 3000);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        Clear recovery drafts
                      </button>
                    </div>
                    {clearMsg && (
                      <div className="settings-test-result success">{clearMsg}</div>
                    )}
                  </>
                )}
              </div>
            )}

            {section === "about" && (
              <div className="settings-section">
                <div className="settings-about">
                  <div className="settings-about-brand">
                    <div className="settings-about-icon">
                      <MkLumeIcon size={48} />
                    </div>
                    <h3 className="settings-about-name">MkLume</h3>
                    <span className="settings-about-version">v{appVersion}</span>
                    <span className="settings-about-tagline">
                      A visual desktop editor for MkDocs Material documentation
                    </span>
                  </div>
                  <p className="settings-about-desc">
                    Create, edit, preview, and manage MkDocs Material sites locally.
                    Combines Markdown editing, visual blocks, site configuration,
                    asset handling, smart linking, live preview, and project health
                    checks in one focused app.
                  </p>
                  <div className="settings-about-links">
                    <AboutLink
                      label="GitHub"
                      hint="Source code & releases"
                      onClick={() => openUrlInBrowser("https://github.com/ECalStudios/mklume").catch(() => {})}
                    />
                    <AboutLink
                      label="Report Issue"
                      hint="Bug reports & feature requests"
                      onClick={() => openUrlInBrowser("https://github.com/ECalStudios/mklume/issues").catch(() => {})}
                    />
                    <AboutLink
                      label="Documentation"
                      hint="Usage guide & tips"
                      onClick={() => openUrlInBrowser("https://www.ecalstudios.com/mklume/").catch(() => {})}
                    />
                  </div>
                  <div className="settings-about-support">
                    <p className="settings-about-support-text">
                      MkLume is free and open source. If it helps your workflow, you can support development.
                    </p>
                    <button
                      className="settings-about-support-btn"
                      onClick={() => openUrlInBrowser("https://ko-fi.com/ecalstudios").catch(() => {})}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </svg>
                      Support MkLume
                    </button>
                  </div>
                  <div className="settings-about-footer">
                    Created by Enrique Cal &mdash; ECal Studios
                    <br />
                    <span className="settings-about-license">Licensed under GPLv3</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
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

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        <span className="settings-row-desc">{description}</span>
      </div>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="settings-toggle-track">
          <span className="settings-toggle-thumb" />
        </span>
      </label>
    </div>
  );
}

function AboutLink({ label, hint, onClick }: { label: string; hint: string; onClick?: () => void }) {
  return (
    <div
      className={`settings-about-link${onClick ? " clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <span className="settings-about-link-label">{label}</span>
      <span className="settings-about-link-hint">{hint}</span>
      {onClick && (
        <svg className="settings-about-link-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
    </div>
  );
}

export default SettingsPanel;
