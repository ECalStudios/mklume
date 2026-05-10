import { useRef } from "react";
import type { RecentProject } from "../../types/project";
import MkLumeIcon from "../common/MkLumeIcon";

interface WelcomeScreenProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (project: RecentProject) => void;
  onRemoveRecentProject: (rootPath: string) => void;
  onClearRecentProjects: () => void;
  recentProjects: RecentProject[];
  error: string;
  onDismissError: () => void;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

function shortenPath(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/");
  if (parts.length <= 3) return normalized;
  return `…/${parts.slice(-2).join("/")}`;
}

function WelcomeScreen({
  onNewProject,
  onOpenProject,
  onOpenRecentProject,
  onRemoveRecentProject,
  onClearRecentProjects,
  recentProjects,
  error,
  onDismissError,
}: WelcomeScreenProps) {
  const hasRecents = recentProjects.length > 0;
  const recentRef = useRef<HTMLDivElement>(null);

  function handleRecentCardClick() {
    if (hasRecents) {
      recentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-header">
        <div className="welcome-icon">
          <MkLumeIcon size={48} />
        </div>
        <h1 className="welcome-heading">MkLume</h1>
        <p className="welcome-tagline">
          A visual desktop editor for MkDocs Material documentation
        </p>
        <span className="welcome-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          Local-first · Privacy-respecting
        </span>
      </div>

      {/* Three action cards — always visible */}
      <div className="welcome-cards">
        <div className="welcome-card" onClick={onNewProject} role="button" tabIndex={0} aria-label="New Project" onKeyDown={(e) => e.key === "Enter" && onNewProject()}>
          <div className="welcome-card-icon accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </div>
          <span className="welcome-card-title">
            New Project
            <svg className="welcome-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </span>
          <span className="welcome-card-desc">
            Create a fresh MkDocs Material documentation site from a starter template.
          </span>
        </div>

        <div className="welcome-card" onClick={onOpenProject} role="button" tabIndex={0} aria-label="Open Existing Project" onKeyDown={(e) => e.key === "Enter" && onOpenProject()}>
          <div className="welcome-card-icon teal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
          </div>
          <span className="welcome-card-title">
            Open Existing Project
            <svg className="welcome-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </span>
          <span className="welcome-card-desc">
            Open a folder that already contains an MkDocs project with mkdocs.yml.
          </span>
        </div>

        <div className="welcome-card" onClick={handleRecentCardClick} role="button" tabIndex={0} aria-label="Recent Projects" onKeyDown={(e) => e.key === "Enter" && handleRecentCardClick()}>
          <div className="welcome-card-icon amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <span className="welcome-card-title">
            Recent Projects
            <svg className="welcome-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </span>
          <span className="welcome-card-desc">
            {hasRecents
              ? `${recentProjects.length} recent ${recentProjects.length === 1 ? "project" : "projects"}. Click to jump to the list below.`
              : "No recent projects yet. Open a project and it will appear here."}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="welcome-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="welcome-error-text">{error}</span>
          <button className="welcome-error-dismiss" onClick={onDismissError}>
            ✕
          </button>
        </div>
      )}

      {/* Recent Projects Section */}
      <div className="recent-section" ref={recentRef}>
        {hasRecents ? (
          <>
            <div className="recent-header">
              <span className="recent-label">Recent Projects</span>
              <button className="recent-clear-btn" onClick={onClearRecentProjects}>
                Clear all
              </button>
            </div>
            <div className="recent-list">
              {recentProjects.map((rp) => (
                <div
                  key={rp.root_path}
                  className="recent-item"
                  onClick={() => onOpenRecentProject(rp)}
                >
                  <div className="recent-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  </div>
                  <div className="recent-item-info">
                    <span className="recent-item-name">{rp.name}</span>
                    <span className="recent-item-path">{shortenPath(rp.root_path)}</span>
                  </div>
                  <span className="recent-item-time">{formatDate(rp.last_opened)}</span>
                  <button
                    className="recent-item-remove"
                    title="Remove from recent"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecentProject(rp.root_path);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="recent-empty">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>No recent projects yet. Open an MkDocs project to see it here.</span>
          </div>
        )}
      </div>

      <div className="welcome-footer">
        <span className="welcome-footer-item">
          <kbd>Ctrl</kbd><kbd>O</kbd> Open
        </span>
        <span className="welcome-footer-sep" />
        <span className="welcome-footer-item">
          <kbd>Ctrl</kbd><kbd>N</kbd> New
        </span>
        <span className="welcome-footer-sep" />
        <span className="welcome-footer-item">
          <kbd>Ctrl</kbd><kbd>,</kbd> Settings
        </span>
      </div>
    </div>
  );
}

export default WelcomeScreen;
