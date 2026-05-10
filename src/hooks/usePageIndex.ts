/**
 * usePageIndex — builds a searchable page index from project data.
 *
 * For each page, we compute:
 *   - title (nav label > first heading > filename)
 *   - relative path from docs root
 *   - nav section/folder
 *   - whether page is listed in nav
 *
 * The index is rebuilt when project.pages or project.nav changes.
 */
import { useMemo } from "react";
import type { PageEntry, NavEntry } from "../types/project";

export interface PageIndexEntry {
  /** Display title (nav label > filename title) */
  title: string;
  /** Relative path from docs root, forward slashes */
  relativePath: string;
  /** Absolute file path */
  filePath: string;
  /** Section/folder name (e.g. "Plugins", "LocCheck") */
  section: string;
  /** Whether page appears in nav */
  inNav: boolean;
  /** Nav label if different from title */
  navLabel: string | null;
  /** Search-friendly lowercase strings */
  searchText: string;
}

/**
 * Walk the nav tree and build a map of relativePath -> navLabel.
 */
function buildNavMap(nav: NavEntry[] | null): Map<string, { label: string; section: string }> {
  const map = new Map<string, { label: string; section: string }>();
  if (!nav) return map;

  function walk(entries: NavEntry[], parentSection: string) {
    for (const entry of entries) {
      if (entry.path) {
        map.set(entry.path, { label: entry.title, section: parentSection });
      }
      if (entry.children.length > 0) {
        // This entry is a section/group
        const sectionName = entry.title;
        walk(entry.children, sectionName);
      }
    }
  }

  walk(nav, "");
  return map;
}

/**
 * Compute a relative path from one page to another, both relative to docs root.
 * Uses POSIX forward slashes.
 *
 * Examples:
 *   from "index.md" to "plugins.md" -> "plugins.md"
 *   from "index.md" to "loccheck/user-manual.md" -> "loccheck/user-manual.md"
 *   from "loccheck/readme.md" to "plugins.md" -> "../plugins.md"
 *   from "loccheck/readme.md" to "loccheck/user-manual.md" -> "user-manual.md"
 *   from "a/b/deep.md" to "plugins.md" -> "../../plugins.md"
 */
export function computeRelativePath(fromRelative: string, toRelative: string): string {
  // Normalize to forward slashes
  const from = fromRelative.replace(/\\/g, "/");
  const to = toRelative.replace(/\\/g, "/");

  // Get directory parts
  const fromDir = from.includes("/") ? from.substring(0, from.lastIndexOf("/")) : "";
  const toDir = to.includes("/") ? to.substring(0, to.lastIndexOf("/")) : "";
  const toFile = to.includes("/") ? to.substring(to.lastIndexOf("/") + 1) : to;

  if (fromDir === toDir) {
    // Same directory
    return toFile;
  }

  const fromParts = fromDir ? fromDir.split("/") : [];
  const toParts = toDir ? toDir.split("/") : [];

  // Find common prefix length
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }

  // Go up from current dir
  const ups = fromParts.length - common;
  const upStr = "../".repeat(ups);

  // Go down to target dir
  const downParts = toParts.slice(common);
  const downStr = downParts.length > 0 ? downParts.join("/") + "/" : "";

  return upStr + downStr + toFile;
}

/**
 * Extract section/folder from a relative path.
 * "plugins/overview.md" -> "plugins"
 * "index.md" -> ""
 */
function folderFromPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const slash = normalized.indexOf("/");
  return slash !== -1 ? normalized.substring(0, slash) : "";
}

/**
 * Build searchable page index from project data.
 */
export function buildPageIndex(
  pages: PageEntry[],
  nav: NavEntry[] | null,
): PageIndexEntry[] {
  const navMap = buildNavMap(nav);

  return pages.map((page) => {
    const navInfo = navMap.get(page.relative_path);
    const title = navInfo?.label || page.title;
    const section = navInfo?.section || folderFromPath(page.relative_path);
    const inNav = navMap.has(page.relative_path);

    // Build search text: title + filename + path + nav label
    const filename = page.relative_path.replace(/\\/g, "/").split("/").pop() ?? "";
    const filenameNoExt = filename.replace(/\.md$/i, "");
    const searchParts = [title, filenameNoExt, page.relative_path.replace(/\\/g, "/")];
    if (navInfo?.label && navInfo.label !== title) {
      searchParts.push(navInfo.label);
    }

    return {
      title,
      relativePath: page.relative_path.replace(/\\/g, "/"),
      filePath: page.file_path,
      section,
      inNav,
      navLabel: navInfo?.label ?? null,
      searchText: searchParts.join(" ").toLowerCase(),
    };
  });
}

/**
 * Search the page index by query string.
 * Returns results scored by relevance.
 */
export function searchPageIndex(
  index: PageIndexEntry[],
  query: string,
  currentPagePath?: string,
): PageIndexEntry[] {
  if (!query.trim()) {
    // Return all pages except current, nav pages first
    return index
      .filter((p) => p.relativePath !== currentPagePath)
      .sort((a, b) => {
        if (a.inNav !== b.inNav) return a.inNav ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
  }

  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/);

  const scored = index
    .filter((p) => p.relativePath !== currentPagePath)
    .map((p) => {
      let score = 0;
      const titleLower = p.title.toLowerCase();
      const filenameLower = p.relativePath.split("/").pop()?.replace(/\.md$/i, "").toLowerCase() ?? "";

      // All terms must match somewhere
      const allMatch = terms.every((t) => p.searchText.includes(t));
      if (!allMatch) return { entry: p, score: 0 };

      // Exact title match
      if (titleLower === q) score += 100;
      // Title starts with query
      else if (titleLower.startsWith(q)) score += 80;
      // Title contains query
      else if (titleLower.includes(q)) score += 60;

      // Filename match
      if (filenameLower === q) score += 50;
      else if (filenameLower.startsWith(q)) score += 40;
      else if (filenameLower.includes(q)) score += 30;

      // Nav pages ranked higher
      if (p.inNav) score += 10;

      // Fallback: any term match
      if (score === 0) score = 1;

      return { entry: p, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((r) => r.entry);
}

/**
 * React hook that builds and maintains a page index.
 */
export function usePageIndex(
  pages: PageEntry[] | undefined,
  nav: NavEntry[] | null | undefined,
): PageIndexEntry[] {
  return useMemo(
    () => buildPageIndex(pages ?? [], nav ?? null),
    [pages, nav],
  );
}
