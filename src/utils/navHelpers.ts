import type { NavEntry, PageEntry } from "../types/project";

// ── Move ─────────────────────────────────────────────────

/**
 * Swap a nav entry with its sibling at the given index path.
 * Returns null if the move is out of bounds.
 */
export function moveNavEntry(
  nav: NavEntry[],
  path: number[],
  direction: "up" | "down",
): NavEntry[] | null {
  const result = structuredClone(nav);
  let arr = result;
  for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;

  const idx = path[path.length - 1];
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= arr.length) return null;

  [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
  return result;
}

// ── Remove by index path ─────────────────────────────────

/**
 * Remove a nav entry at the given index path (used by "Remove from nav").
 */
export function removeNavEntry(nav: NavEntry[], path: number[]): NavEntry[] {
  const result = structuredClone(nav);
  let arr = result;
  for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;
  arr.splice(path[path.length - 1], 1);
  return result;
}

// ── Remove by file path (recursive) ─────────────────────

/**
 * Remove every nav entry whose `path` matches `targetPath`, at any
 * nesting depth. Sections (groups) are never removed — only leaf
 * entries that point to the deleted file.
 */
export function removeNavEntryByPath(
  nav: NavEntry[],
  targetPath: string,
): NavEntry[] {
  return nav.reduce<NavEntry[]>((acc, entry) => {
    // Skip leaf entries that match
    if (entry.path === targetPath) return acc;

    if (entry.children.length > 0) {
      acc.push({
        ...entry,
        children: removeNavEntryByPath(entry.children, targetPath),
      });
    } else {
      acc.push(entry);
    }
    return acc;
  }, []);
}

// ── Remove all missing entries ───────────────────────────

/**
 * Remove every nav leaf whose path doesn't match any existing page.
 * Sections are kept even if emptied.
 */
export function removeAllMissingEntries(
  nav: NavEntry[],
  existingPaths: Set<string>,
): NavEntry[] {
  return nav.reduce<NavEntry[]>((acc, entry) => {
    if (entry.path && !existingPaths.has(entry.path)) {
      return acc; // skip missing
    }
    if (entry.children.length > 0) {
      acc.push({
        ...entry,
        children: removeAllMissingEntries(entry.children, existingPaths),
      });
    } else {
      acc.push(entry);
    }
    return acc;
  }, []);
}

// ── Collect all paths in a nav tree ──────────────────────

export function collectNavPaths(
  entries: NavEntry[],
  out: Set<string>,
): void {
  for (const e of entries) {
    if (e.path) out.add(e.path);
    if (e.children.length > 0) collectNavPaths(e.children, out);
  }
}

// ── Deep insert into matching nav group ──────────────────

/**
 * Determine the "folder prefix" a nav section owns by scanning all
 * leaf paths in its subtree and finding the most common first folder
 * segment. Returns `null` for sections with no folder-based children.
 */
function sectionOwnsFolder(entry: NavEntry): string | null {
  if (entry.path || entry.children.length === 0) return null;

  const leafPaths: string[] = [];
  collectLeafPaths(entry, leafPaths);

  // Count first-folder-segment frequency
  const counts = new Map<string, number>();
  for (const p of leafPaths) {
    const slash = p.indexOf("/");
    if (slash === -1) continue;
    const folder = p.substring(0, slash);
    counts.set(folder, (counts.get(folder) || 0) + 1);
  }

  if (counts.size === 0) return null;

  // Return the folder with the most entries
  let best = "";
  let bestCount = 0;
  for (const [folder, count] of counts) {
    if (count > bestCount) {
      best = folder;
      bestCount = count;
    }
  }
  return best || null;
}

function collectLeafPaths(entry: NavEntry, out: string[]): void {
  if (entry.path) {
    out.push(entry.path);
    return;
  }
  for (const child of entry.children) {
    collectLeafPaths(child, out);
  }
}

/**
 * Recursively search the nav tree for the deepest section that "owns"
 * a given folder prefix. Returns the children array where the new
 * entry should be pushed, or null if no match is found.
 *
 * "Owns" means the section's leaf paths predominantly start with
 * `folder + "/"`.
 */
function findBestSection(
  nav: NavEntry[],
  folder: string,
): NavEntry[] | null {
  for (const entry of nav) {
    if (entry.children.length === 0) continue;

    const owned = sectionOwnsFolder(entry);
    if (owned === folder) {
      // Check if a deeper child section also owns this folder
      const deeper = findBestSection(entry.children, folder);
      return deeper || entry.children;
    }

    // Even if this section doesn't directly own the folder,
    // a nested section might
    const deeper = findBestSection(entry.children, folder);
    if (deeper) return deeper;
  }
  return null;
}

/**
 * Add a page into the correct nav section based on its folder.
 * Searches the full nav tree recursively to find the deepest section
 * that owns files with the same folder prefix. Falls back to top level.
 */
export function addPageToNavSmart(
  nav: NavEntry[],
  title: string,
  relativePath: string,
  folder: string,
): NavEntry[] {
  const result = structuredClone(nav);
  const newEntry: NavEntry = { title, path: relativePath, children: [] };

  if (folder) {
    const target = findBestSection(result, folder);
    if (target) {
      target.push(newEntry);
      return result;
    }
  }

  // No matching section found — add at top level
  result.push(newEntry);
  return result;
}

/**
 * Simple top-level append (used by the "Add to nav" button on unlisted
 * pages when there's no folder context).
 */
export function addPageToNav(
  nav: NavEntry[],
  page: PageEntry,
): NavEntry[] {
  return [
    ...nav,
    { title: page.title, path: page.relative_path, children: [] },
  ];
}

// ── Count missing entries ────────────────────────────────

export function countMissingEntries(
  nav: NavEntry[],
  existingPaths: Set<string>,
): number {
  let count = 0;
  for (const entry of nav) {
    if (entry.path && !existingPaths.has(entry.path)) count++;
    if (entry.children.length > 0) {
      count += countMissingEntries(entry.children, existingPaths);
    }
  }
  return count;
}

// ── Drag-and-drop move ──────────────────────────────────

/**
 * Remove an item from a nav tree at the given index path.
 * Returns the removed item.
 */
function removeAtPath(nav: NavEntry[], path: number[]): NavEntry {
  let arr = nav;
  for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;
  return arr.splice(path[path.length - 1], 1)[0];
}

/**
 * Insert an item into a nav tree at the given index path and position.
 */
function insertAtPath(
  nav: NavEntry[],
  path: number[],
  position: "before" | "after" | "inside",
  item: NavEntry,
): void {
  if (position === "inside") {
    // Append as last child of the group at `path`
    let arr = nav;
    for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;
    arr[path[path.length - 1]].children.push(item);
    return;
  }

  let arr = nav;
  for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;
  const idx = path[path.length - 1];
  const insertIdx = position === "before" ? idx : idx + 1;
  arr.splice(insertIdx, 0, item);
}

/**
 * Check if pathA is a prefix of (or equal to) pathB.
 * Used to prevent dropping a group inside itself.
 */
function isAncestorOrSelf(pathA: number[], pathB: number[]): boolean {
  if (pathA.length > pathB.length) return false;
  for (let i = 0; i < pathA.length; i++) {
    if (pathA[i] !== pathB[i]) return false;
  }
  return true;
}

/**
 * Adjust the target path after removing the source item.
 * If both paths share the same parent and the source comes before
 * the target, the target index needs to shift down by 1.
 */
function adjustPathAfterRemoval(
  fromPath: number[],
  toPath: number[],
): number[] {
  if (fromPath.length !== toPath.length) return toPath;

  // Check if they share the same parent (all indices except the last match)
  for (let i = 0; i < fromPath.length - 1; i++) {
    if (fromPath[i] !== toPath[i]) return toPath;
  }

  const fromIdx = fromPath[fromPath.length - 1];
  const toIdx = toPath[toPath.length - 1];

  if (fromIdx < toIdx) {
    const adjusted = [...toPath];
    adjusted[adjusted.length - 1] = toIdx - 1;
    return adjusted;
  }
  return toPath;
}

/**
 * Move a nav entry from one position to another via drag-and-drop.
 * Returns null if the move is invalid.
 */
export function dragMoveNavEntry(
  nav: NavEntry[],
  fromPath: number[],
  toPath: number[],
  position: "before" | "after" | "inside",
): NavEntry[] | null {
  // Can't drop a group inside itself
  if (position === "inside" && isAncestorOrSelf(fromPath, toPath)) return null;
  if (isAncestorOrSelf(fromPath, toPath) && fromPath.length <= toPath.length) {
    // More nuanced check: don't drop into own subtree
    const toParent = toPath.slice(0, fromPath.length);
    if (isAncestorOrSelf(fromPath, toParent)) return null;
  }

  // Same position — no-op
  if (
    fromPath.length === toPath.length &&
    fromPath.every((v, i) => v === toPath[i])
  ) {
    if (position === "before" || position === "after") return null;
  }

  const result = structuredClone(nav);

  // Remove the item first
  const item = removeAtPath(result, fromPath);

  // Adjust target path since removal may have shifted indices
  const adjustedTo =
    position === "inside"
      ? toPath // "inside" targets the group itself, not affected by sibling removal
      : adjustPathAfterRemoval(fromPath, toPath);

  // Insert at target
  insertAtPath(result, adjustedTo, position, item);

  return result;
}
