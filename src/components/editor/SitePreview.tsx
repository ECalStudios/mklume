/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useMemo, useCallback } from "react";
import MarkdownPreview from "./MarkdownPreview";
import type { NavEntry, PageEntry } from "../../types/project";
import type { SiteConfig } from "../../services/projectService";

interface SitePreviewProps {
  content: string;
  docsDir: string;
  pageRelativePath: string;
  nav: NavEntry[] | null;
  selectedPage: PageEntry | null;
  siteName: string;
  siteConfig: SiteConfig | null;
  onNavigate?: (page: PageEntry) => void;
  pages: PageEntry[];
}

/** Extract headings from markdown content for the right TOC */
function extractHeadings(content: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`\[\]()]/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ level, text, id });
    }
  }
  return headings;
}

/** Check if a nav path matches the current page */
function isActivePath(navPath: string | null, currentPath: string): boolean {
  if (!navPath) return false;
  return navPath === currentPath;
}

/** Recursively check if a nav section contains the current page */
function sectionContainsPage(entry: NavEntry, currentPath: string): boolean {
  if (isActivePath(entry.path, currentPath)) return true;
  return entry.children.some((c) => sectionContainsPage(c, currentPath));
}

/** Check if current page is in the nav at all */
function isPageInNav(nav: NavEntry[] | null, currentPath: string): boolean {
  if (!nav) return false;
  return nav.some((entry) => sectionContainsPage(entry, currentPath));
}

/** Render the sidebar nav tree recursively */
function NavTree({
  entries,
  currentPath,
  pages,
  onNavigate,
  depth,
}: {
  entries: NavEntry[];
  currentPath: string;
  pages: PageEntry[];
  onNavigate?: (page: PageEntry) => void;
  depth: number;
}) {
  return (
    <ul className={`site-preview-nav-list${depth === 0 ? " root" : ""}`}>
      {entries.map((entry, i) => {
        const isActive = isActivePath(entry.path, currentPath);
        const isExpanded = sectionContainsPage(entry, currentPath);
        const hasChildren = entry.children.length > 0;

        const handleClick = () => {
          if (entry.path && onNavigate) {
            const page = pages.find((p) => p.relative_path === entry.path);
            if (page) onNavigate(page);
          }
        };

        return (
          <li key={`${entry.title}-${i}`} className="site-preview-nav-item">
            <button
              className={`site-preview-nav-link${isActive ? " active" : ""}${isExpanded && hasChildren ? " expanded" : ""}`}
              onClick={handleClick}
              title={entry.path || entry.title}
              style={{ paddingLeft: `${12 + depth * 12}px` }}
            >
              {hasChildren && (
                <svg
                  className="site-preview-nav-arrow"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
              <span>{entry.title}</span>
            </button>
            {hasChildren && isExpanded && (
              <NavTree
                entries={entry.children}
                currentPath={currentPath}
                pages={pages}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SitePreview({
  content,
  docsDir,
  pageRelativePath,
  nav,
  siteName,
  siteConfig,
  onNavigate,
  pages,
}: SitePreviewProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const hasTabs = siteConfig?.features.includes("navigation.tabs") ?? false;
  const hasRepoUrl = !!siteConfig?.repo_url;
  const repoName = siteConfig?.repo_name || "Repository";
  const copyright = siteConfig?.copyright || null;
  const inNav = useMemo(() => isPageInNav(nav, pageRelativePath), [nav, pageRelativePath]);

  // For navigation.tabs, top-level nav entries become tabs
  const topLevelTabs = useMemo(() => {
    if (!hasTabs || !nav) return null;
    return nav.filter((e) => e.children.length > 0);
  }, [hasTabs, nav]);

  // Determine which tab section is active (for sub-nav)
  const activeTabSection = useMemo(() => {
    if (!topLevelTabs || !nav) return nav;
    for (const tab of topLevelTabs) {
      if (sectionContainsPage(tab, pageRelativePath)) {
        return tab.children;
      }
    }
    // Page not in any tab — show first tab's children
    return topLevelTabs[0]?.children ?? nav;
  }, [topLevelTabs, nav, pageRelativePath]);

  const sidebarNav = hasTabs ? activeTabSection : nav;

  const handleNavClick = useCallback(
    (page: PageEntry) => {
      if (onNavigate) onNavigate(page);
    },
    [onNavigate],
  );

  // Get primary palette color for header
  const primaryColor = useMemo(() => {
    if (!siteConfig?.palette.length) return null;
    const lightPalette = siteConfig.palette.find(
      (p) => p.scheme === "default" || p.scheme === null,
    );
    const anyPalette = lightPalette || siteConfig.palette[0];
    return anyPalette?.primary || null;
  }, [siteConfig]);

  const headerStyle = primaryColor
    ? { "--site-header-bg": getMaterialColor(primaryColor) } as React.CSSProperties
    : undefined;

  return (
    <div className="site-preview">
      {/* Header */}
      <header className="site-preview-header" style={headerStyle}>
        <div className="site-preview-header-inner">
          <div className="site-preview-header-left">
            <span className="site-preview-site-name">{siteName}</span>
          </div>

          {hasTabs && topLevelTabs && (
            <nav className="site-preview-tabs">
              {topLevelTabs.map((tab, i) => (
                <button
                  key={`tab-${i}`}
                  className={`site-preview-tab${sectionContainsPage(tab, pageRelativePath) ? " active" : ""}`}
                  onClick={() => {
                    // Navigate to first page in tab section
                    const firstPath = findFirstPath(tab);
                    if (firstPath && onNavigate) {
                      const page = pages.find((p) => p.relative_path === firstPath);
                      if (page) onNavigate(page);
                    }
                  }}
                >
                  {tab.title}
                </button>
              ))}
            </nav>
          )}

          {hasRepoUrl && (
            <div className="site-preview-header-right">
              <span className="site-preview-repo-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                {repoName}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Body: sidebar + content + TOC */}
      <div className="site-preview-body">
        {/* Left Sidebar */}
        {sidebarNav && sidebarNav.length > 0 && (
          <aside className="site-preview-sidebar">
            <NavTree
              entries={sidebarNav}
              currentPath={pageRelativePath}
              pages={pages}
              onNavigate={handleNavClick}
              depth={0}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className="site-preview-main">
          {!inNav && (
            <div className="site-preview-not-in-nav">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>This page is not in the navigation (nav)</span>
            </div>
          )}
          <div className="site-preview-content">
            <MarkdownPreview
              content={content}
              docsDir={docsDir}
              pageRelativePath={pageRelativePath}
            />
          </div>

          {/* Reminder notice */}
          <div className="site-preview-reminder">
            Use "Open in Browser" for the exact MkDocs Material output.
          </div>
        </main>

        {/* Right TOC */}
        {headings.length > 0 && (
          <aside className="site-preview-toc">
            <div className="site-preview-toc-title">Table of contents</div>
            <ul className="site-preview-toc-list">
              {headings.map((h, i) => (
                <li
                  key={`${h.id}-${i}`}
                  className="site-preview-toc-item"
                  style={{ paddingLeft: `${(h.level - 1) * 10}px` }}
                >
                  <span className="site-preview-toc-link">{h.text}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {/* Footer */}
      {copyright && (
        <footer className="site-preview-footer">
          <span dangerouslySetInnerHTML={{ __html: copyright }} />
        </footer>
      )}
    </div>
  );
}

/** Find the first page path in a nav subtree */
function findFirstPath(entry: NavEntry): string | null {
  if (entry.path) return entry.path;
  for (const child of entry.children) {
    const found = findFirstPath(child);
    if (found) return found;
  }
  return null;
}

/** Map Material theme primary color name to CSS color */
function getMaterialColor(name: string): string {
  const colors: Record<string, string> = {
    red: "#ef5350",
    pink: "#e91e63",
    purple: "#ab47bc",
    "deep purple": "#7e57c2",
    indigo: "#3f51b5",
    blue: "#2094f3",
    "light blue": "#02a6f2",
    cyan: "#00bcd4",
    teal: "#009485",
    green: "#4cae4f",
    "light green": "#7cb342",
    lime: "#c0ca33",
    yellow: "#f9a825",
    amber: "#ffa000",
    orange: "#ff9100",
    "deep orange": "#ff6e42",
    brown: "#795548",
    grey: "#757575",
    "blue grey": "#546e7a",
    black: "#000000",
    white: "#ffffff",
  };
  return colors[name.toLowerCase()] || "#3f51b5";
}

export default SitePreview;
