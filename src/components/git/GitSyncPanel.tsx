/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useEffect, useCallback } from "react";
import type {
  GitStatusResult,
  GitSyncResult,
  GitIgnoreSuggestion,
} from "../../services/projectService";
import {
  gitStatus,
  gitSync,
  gitCheckGitignore,
  gitWriteGitignore,
  openFolderInExplorer,
} from "../../services/projectService";

// ── Commit message presets ──────────────────────────────

const MESSAGE_PRESETS = [
  "Update docs",
  "Update documentation",
  "Update MkDocs site",
  "Update site settings",
];

// ── Status label helpers ────────────────────────────────

function statusLabel(code: string): string {
  switch (code) {
    case "M": return "Modified";
    case "A": return "Added";
    case "D": return "Deleted";
    case "R": return "Renamed";
    case "C": return "Copied";
    case "??": return "New";
    default: return code;
  }
}

function statusColor(code: string): string {
  switch (code) {
    case "M": return "var(--status-modified, #e5a600)";
    case "A": case "??": return "var(--status-added, #3fb950)";
    case "D": return "var(--status-deleted, #f85149)";
    default: return "var(--text-secondary)";
  }
}

// ── Component ───────────────────────────────────────────

interface GitSyncPanelProps {
  projectRoot: string;
  isDirty: boolean;
  onSave: () => void;
  onClose: () => void;
}

type SyncPhase = "idle" | "confirm" | "syncing" | "done";

export default function GitSyncPanel({
  projectRoot,
  isDirty,
  onSave,
  onClose,
}: GitSyncPanelProps) {
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState("Update docs");
  const [doPush, setDoPush] = useState(true);
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [result, setResult] = useState<GitSyncResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [gitignoreInfo, setGitignoreInfo] = useState<GitIgnoreSuggestion | null>(null);
  const [showGitignore, setShowGitignore] = useState(false);

  // ── Load status ─────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await gitStatus(projectRoot);
      setStatus(s);

      // Auto-disable push if no upstream
      if (!s.info.upstream) {
        setDoPush(false);
      }
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }, [projectRoot]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Sync flow ───────────────────────────────────────

  const handleStartSync = () => {
    if (isDirty) {
      onSave();
      // Give a moment for save to propagate, then proceed
      setTimeout(() => setPhase("confirm"), 300);
    } else {
      setPhase("confirm");
    }
  };

  const handleConfirmSync = async () => {
    setPhase("syncing");
    setResult(null);
    try {
      const r = await gitSync(projectRoot, commitMessage, doPush);
      setResult(r);
      setPhase("done");
      // Refresh status after sync
      refresh();
    } catch (err: unknown) {
      setResult({
        success: false,
        committed: false,
        pushed: false,
        commit_hash: null,
        files_committed: 0,
        message: "",
        error: err instanceof Error ? err.message : String(err),
        error_detail: null,
      });
      setPhase("done");
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setResult(null);
    setShowDetail(false);
  };

  // ── Gitignore ───────────────────────────────────────

  const handleCheckGitignore = async () => {
    try {
      const info = await gitCheckGitignore(projectRoot);
      setGitignoreInfo(info);
      setShowGitignore(true);
    } catch {
      // Ignore
    }
  };

  const handleWriteGitignore = async () => {
    if (!gitignoreInfo) return;
    try {
      await gitWriteGitignore(projectRoot, gitignoreInfo.suggested_content);
      setShowGitignore(false);
      refresh();
    } catch {
      // Ignore
    }
  };

  // ── Render helpers ──────────────────────────────────

  const renderNotInstalled = () => (
    <div className="git-sync-state">
      <div className="git-sync-state-icon git-sync-state-warning">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h3>Git Not Found</h3>
      <p className="git-sync-state-desc">
        Git was not found on this computer. Install Git to use sync features.
      </p>
      <a
        className="git-sync-help-link"
        href="#"
        onClick={(e) => { e.preventDefault(); window.open?.("https://git-scm.com"); }}
      >
        Download Git
      </a>
    </div>
  );

  const renderNotRepo = () => (
    <div className="git-sync-state">
      <div className="git-sync-state-icon git-sync-state-info">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </div>
      <h3>Not a Git Repository</h3>
      <p className="git-sync-state-desc">
        This project is not connected to Git yet. Initialize a repository to start tracking changes.
      </p>
      <div className="git-sync-init-help">
        <p className="git-sync-hint">To get started, open a terminal in your project folder and run:</p>
        <code className="git-sync-code">git init</code>
        <code className="git-sync-code">git remote add origin &lt;your-repo-url&gt;</code>
        <button
          className="git-sync-btn-secondary"
          onClick={() => openFolderInExplorer(projectRoot).catch(() => {})}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Open Project Folder
        </button>
      </div>
    </div>
  );

  const renderStatus = () => {
    if (!status) return null;
    const { info, files, ahead, behind, has_changes } = status;

    return (
      <div className="git-sync-content">
        {/* Repository info */}
        <div className="git-sync-info">
          <div className="git-sync-info-row">
            <span className="git-sync-info-label">Branch</span>
            <span className="git-sync-info-value git-sync-branch">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              {info.branch || "detached HEAD"}
            </span>
          </div>
          {info.remote && (
            <div className="git-sync-info-row">
              <span className="git-sync-info-label">Remote</span>
              <span className="git-sync-info-value">{info.upstream || `${info.remote} (no upstream)`}</span>
            </div>
          )}
          {!info.remote && (
            <div className="git-sync-info-row">
              <span className="git-sync-info-label">Remote</span>
              <span className="git-sync-info-value git-sync-warning-text">No remote configured</span>
            </div>
          )}
          {info.last_commit && (
            <div className="git-sync-info-row">
              <span className="git-sync-info-label">Last commit</span>
              <span className="git-sync-info-value" title={info.last_commit}>
                {info.last_commit.length > 50
                  ? info.last_commit.slice(0, 47) + "..."
                  : info.last_commit}
                {info.last_commit_date && (
                  <span className="git-sync-date"> ({info.last_commit_date})</span>
                )}
              </span>
            </div>
          )}
          {(ahead > 0 || behind > 0) && (
            <div className="git-sync-info-row">
              <span className="git-sync-info-label">Sync</span>
              <span className="git-sync-info-value">
                {ahead > 0 && <span className="git-sync-ahead">{ahead} ahead</span>}
                {ahead > 0 && behind > 0 && " · "}
                {behind > 0 && <span className="git-sync-behind">{behind} behind</span>}
              </span>
            </div>
          )}
        </div>

        {/* Behind remote warning */}
        {behind > 0 && (
          <div className="git-sync-warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              Your branch is {behind} commit{behind > 1 ? "s" : ""} behind the remote.
              Pull from your Git client before syncing.
            </span>
          </div>
        )}

        {/* File list */}
        {has_changes ? (
          <div className="git-sync-files">
            <div className="git-sync-files-header">
              <span>Changed files</span>
              <span className="git-sync-file-count">{files.length}</span>
            </div>
            <div className="git-sync-file-list">
              {files.map((f, i) => (
                <div key={i} className="git-sync-file">
                  <span
                    className="git-sync-file-status"
                    style={{ color: statusColor(f.status) }}
                    title={statusLabel(f.status)}
                  >
                    {f.status === "??" ? "N" : f.status}
                  </span>
                  <span className="git-sync-file-path" title={f.path}>
                    {f.path}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="git-sync-clean">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Working tree is clean. No changes to commit.</span>
          </div>
        )}

        {/* Commit message & actions */}
        {phase === "idle" && has_changes && (
          <div className="git-sync-actions">
            <div className="git-sync-message-group">
              <label className="git-sync-label">Commit message</label>
              <div className="git-sync-message-row">
                <input
                  type="text"
                  className="git-sync-input"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Update docs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && commitMessage.trim()) {
                      handleStartSync();
                    }
                  }}
                />
                <div className="git-sync-presets">
                  {MESSAGE_PRESETS.filter((p) => p !== commitMessage).slice(0, 2).map((preset) => (
                    <button
                      key={preset}
                      className="git-sync-preset-btn"
                      onClick={() => setCommitMessage(preset)}
                      title={preset}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="git-sync-options">
              <label className="git-sync-checkbox-label">
                <input
                  type="checkbox"
                  checked={doPush}
                  onChange={(e) => setDoPush(e.target.checked)}
                  disabled={!info.upstream}
                />
                <span>Push after commit</span>
                {!info.upstream && (
                  <span className="git-sync-checkbox-hint">(no upstream configured)</span>
                )}
              </label>
            </div>

            {isDirty && (
              <div className="git-sync-save-notice">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>Current page has unsaved changes. They will be saved before syncing.</span>
              </div>
            )}

            <button
              className="git-sync-btn-primary"
              onClick={handleStartSync}
              disabled={!commitMessage.trim()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Sync Changes
            </button>
          </div>
        )}

        {/* Confirmation step */}
        {phase === "confirm" && (
          <div className="git-sync-confirm">
            <h4>Confirm Sync</h4>
            <div className="git-sync-confirm-summary">
              <div className="git-sync-confirm-row">
                <span>Branch:</span> <strong>{info.branch}</strong>
              </div>
              {info.upstream && (
                <div className="git-sync-confirm-row">
                  <span>Push to:</span> <strong>{info.upstream}</strong>
                </div>
              )}
              <div className="git-sync-confirm-row">
                <span>Files:</span> <strong>{files.length} changed</strong>
              </div>
              <div className="git-sync-confirm-row">
                <span>Message:</span> <strong>{commitMessage}</strong>
              </div>
              {doPush && !info.upstream && (
                <div className="git-sync-confirm-row git-sync-warning-text">
                  Push skipped — no upstream branch configured.
                </div>
              )}
            </div>
            <div className="git-sync-confirm-buttons">
              <button className="git-sync-btn-secondary" onClick={handleReset}>
                Cancel
              </button>
              <button className="git-sync-btn-primary" onClick={handleConfirmSync}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirm Sync
              </button>
            </div>
          </div>
        )}

        {/* Syncing spinner */}
        {phase === "syncing" && (
          <div className="git-sync-syncing">
            <div className="git-sync-spinner" />
            <span>Syncing changes...</span>
          </div>
        )}

        {/* Result */}
        {phase === "done" && result && (
          <div className={`git-sync-result ${result.success ? "success" : "error"}`}>
            <div className="git-sync-result-icon">
              {result.success ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </div>
            <p className="git-sync-result-message">{result.message || result.error}</p>
            {result.commit_hash && (
              <p className="git-sync-result-hash">Commit: {result.commit_hash}</p>
            )}
            {result.error && result.error_detail && (
              <div className="git-sync-result-detail">
                <button
                  className="git-sync-detail-toggle"
                  onClick={() => setShowDetail(!showDetail)}
                >
                  {showDetail ? "Hide" : "Show"} technical details
                </button>
                {showDetail && (
                  <pre className="git-sync-detail-pre">{result.error_detail}</pre>
                )}
              </div>
            )}
            <button className="git-sync-btn-secondary" onClick={handleReset}>
              {result.success ? "Done" : "Try Again"}
            </button>
          </div>
        )}

        {/* Gitignore helper */}
        {phase === "idle" && !showGitignore && (
          <button className="git-sync-gitignore-btn" onClick={handleCheckGitignore}>
            Check .gitignore
          </button>
        )}

        {showGitignore && gitignoreInfo && (
          <div className="git-sync-gitignore">
            <h4>.gitignore</h4>
            {gitignoreInfo.missing_entries.length === 0 ? (
              <p className="git-sync-gitignore-ok">
                Your .gitignore covers all recommended entries.
              </p>
            ) : (
              <>
                <p className="git-sync-gitignore-missing">
                  {gitignoreInfo.has_gitignore
                    ? `Missing ${gitignoreInfo.missing_entries.length} recommended entries:`
                    : "No .gitignore found. Recommended entries:"}
                </p>
                <ul className="git-sync-gitignore-list">
                  {gitignoreInfo.missing_entries.map((e) => (
                    <li key={e}><code>{e}</code></li>
                  ))}
                </ul>
                <button className="git-sync-btn-secondary" onClick={handleWriteGitignore}>
                  {gitignoreInfo.has_gitignore ? "Add Missing Entries" : "Create .gitignore"}
                </button>
              </>
            )}
            <button
              className="git-sync-gitignore-close"
              onClick={() => setShowGitignore(false)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────

  return (
    <div className="git-sync-panel">
      <div className="git-sync-header">
        <h3 className="git-sync-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <path d="M11 18H8a2 2 0 0 1-2-2V9" />
          </svg>
          Git Sync
        </h3>
        <div className="git-sync-header-actions">
          <button
            className="git-sync-icon-btn"
            onClick={() => { handleReset(); refresh(); }}
            disabled={loading || phase === "syncing"}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "git-sync-spin" : ""}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <button className="git-sync-icon-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="git-sync-body">
        {loading ? (
          <div className="git-sync-loading">
            <div className="git-sync-spinner" />
            <span>Loading Git status...</span>
          </div>
        ) : !status ? (
          <div className="git-sync-state">
            <p>Failed to load Git status.</p>
            <button className="git-sync-btn-secondary" onClick={refresh}>
              Retry
            </button>
          </div>
        ) : !status.info.git_installed ? (
          renderNotInstalled()
        ) : !status.info.is_repo ? (
          renderNotRepo()
        ) : status.error ? (
          <div className="git-sync-state">
            <p className="git-sync-error-text">{status.error}</p>
            <button className="git-sync-btn-secondary" onClick={refresh}>
              Retry
            </button>
          </div>
        ) : (
          renderStatus()
        )}
      </div>
    </div>
  );
}
