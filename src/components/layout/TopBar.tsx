import type { ProjectData, SaveStatus } from "../../types/project";
import MkLumeIcon from "../common/MkLumeIcon";

interface TopBarProps {
  project: ProjectData | null;
  onCloseProject: () => void;
  hasSelectedPage: boolean;
  isDirty: boolean;
  saveStatus: SaveStatus;
  onSave: () => void;
  onOpenHealth: () => void;
  onOpenBuild: () => void;
  onOpenSettings: () => void;
  isServing: boolean;
  onOpenInBrowser?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenGitSync?: () => void;
}

function TopBar({
  project,
  onCloseProject,
  hasSelectedPage,
  isDirty,
  saveStatus,
  onSave,
  onOpenHealth,
  onOpenBuild,
  onOpenSettings,
  isServing,
  onOpenInBrowser,
  onOpenCommandPalette,
  onOpenGitSync,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">
          <MkLumeIcon size={22} />
          <span className="topbar-title">
            {project ? project.site_name : "MkLume"}
          </span>
        </div>
        <span className="topbar-version">v1.0.1</span>
      </div>

      <div className="topbar-right">
        {project && hasSelectedPage && (
          <>
            <SaveIndicator saveStatus={saveStatus} isDirty={isDirty} />
            <button
              className={`topbar-save-btn${isDirty ? " active" : ""}`}
              onClick={onSave}
              disabled={!isDirty || saveStatus === "saving"}
              title="Save (Ctrl+S)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                <path d="M7 3v4a1 1 0 0 0 1 1h7" />
              </svg>
              <span>Save</span>
            </button>
          </>
        )}

        {project && (
          <button
            className={`topbar-btn${isServing ? " topbar-btn-active" : ""}`}
            title="Build &amp; Preview"
            aria-label="Build and Preview"
            onClick={onOpenBuild}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}

        {project && isServing && onOpenInBrowser && (
          <button
            className="topbar-btn topbar-btn-active"
            title="Open preview in browser"
            aria-label="Open preview in browser"
            onClick={onOpenInBrowser}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        )}

        {project && onOpenGitSync && (
          <button
            className="topbar-btn"
            title="Git Sync"
            aria-label="Git Sync"
            onClick={onOpenGitSync}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" />
              <path d="M11 18H8a2 2 0 0 1-2-2V9" />
            </svg>
          </button>
        )}

        {project && (
          <button
            className="topbar-btn"
            title="Project Health"
            aria-label="Project Health"
            onClick={onOpenHealth}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </button>
        )}

        {project && (
          <button
            className="topbar-btn"
            title="Close project"
            aria-label="Close project"
            onClick={onCloseProject}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        )}

        {onOpenCommandPalette && (
          <button
            className="topbar-btn"
            title="Command Palette (Ctrl+K)"
            aria-label="Command Palette"
            onClick={onOpenCommandPalette}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        )}

        <button
          className="topbar-btn"
          title="Settings (Ctrl+,)"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function SaveIndicator({
  saveStatus,
  isDirty,
}: {
  saveStatus: SaveStatus;
  isDirty: boolean;
}) {
  if (saveStatus === "saving") return <span className="save-indicator saving">Saving…</span>;
  if (saveStatus === "saved") return <span className="save-indicator saved">Saved ✓</span>;
  if (saveStatus === "error") return <span className="save-indicator error">Save failed</span>;
  if (isDirty) return <span className="save-indicator dirty"><span className="dirty-dot" />Unsaved</span>;
  return null;
}

export default TopBar;
