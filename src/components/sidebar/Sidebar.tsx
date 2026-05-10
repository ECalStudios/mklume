/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { PageEntry, NavEntry } from "../../types/project";
import { collectNavPaths, countMissingEntries } from "../../utils/navHelpers";
import {
  getCollapsedGroups,
  saveCollapsedGroups,
} from "../../services/projectService";

interface SidebarProps {
  pages: PageEntry[];
  nav: NavEntry[] | null;
  selectedPage: PageEntry | null;
  onSelectPage: (page: PageEntry) => void;
  onNewPage: () => void;
  onRefresh: () => void;
  onRenamePage: (page: PageEntry) => void;
  onDeletePage: (page: PageEntry) => void;
  onMoveNav: (path: number[], direction: "up" | "down") => void;
  onAddToNav: (page: PageEntry) => void;
  onRemoveFromNav: (path: number[], title: string) => void;
  onCleanMissing: () => void;
  onDragMoveNav: (
    fromPath: number[],
    toPath: number[],
    position: "before" | "after" | "inside",
  ) => void;
  onNewGroup: () => void;
  projectRoot: string;
}

function groupContainsPage(entries: NavEntry[], sel: string | null): boolean {
  if (!sel) return false;
  for (const e of entries) {
    if (e.path === sel) return true;
    if (e.children.length > 0 && groupContainsPage(e.children, sel)) return true;
  }
  return false;
}

function getFolderHint(p: string): string | null {
  const s = p.indexOf("/");
  return s === -1 ? null : p.substring(0, s);
}

type DropPosition = "before" | "after" | "inside";

// ── Icons ────────────────────────────────────────────────

function Ico({ children, size = 12 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IFile = (<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></>);
const IPencil = <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />;
const ITrash = (<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>);
const IPlus = (<><path d="M12 5v14" /><path d="M5 12h14" /></>);
const IMinus = <path d="M5 12h14" />;
const IFolder = <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />;
const IRefresh = (<><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></>);
const IClean = (<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M5 6l1 14h12l1-14" /><path d="M10 11v6" /><path d="M14 11v6" /></>);
const IChevron = <polyline points="6 9 12 15 18 9" />;
const IGrip = (<><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" /></>);

// ── Pointer drag helper ──────────────────────────────────

function findDropTargetAtPoint(x: number, y: number): {
  pathStr: string;
  isGroup: boolean;
  pos: DropPosition;
} | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const target = (el as HTMLElement).closest("[data-navpath]") as HTMLElement | null;
  if (!target) return null;

  const pathStr = target.dataset.navpath;
  const isGroup = target.dataset.navgroup === "true";
  if (!pathStr) return null;

  const rect = target.getBoundingClientRect();
  const ratio = (y - rect.top) / rect.height;

  let pos: DropPosition;
  if (isGroup) {
    if (ratio < 0.25) pos = "before";
    else if (ratio > 0.75) pos = "after";
    else pos = "inside";
  } else {
    pos = ratio < 0.5 ? "before" : "after";
  }

  return { pathStr, isGroup, pos };
}

/** Check if `from` is an ancestor of `to` (prevents dropping into own subtree). */
function isAncestor(from: string, to: string): boolean {
  return to.startsWith(from + ",");
}

// ── Sidebar ──────────────────────────────────────────────

function Sidebar({
  pages, nav, selectedPage,
  onSelectPage, onNewPage, onRefresh,
  onRenamePage, onDeletePage,
  onAddToNav, onRemoveFromNav,
  onCleanMissing, onDragMoveNav, onNewGroup, projectRoot,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; pos: DropPosition } | null>(null);
  const dragFromRef = useRef<string | null>(null);
  const expandTimer = useRef<number | null>(null);

  const pageMap = new Map<string, PageEntry>();
  pages.forEach((p) => pageMap.set(p.relative_path, p));
  const existingPaths = new Set(pageMap.keys());

  let unlistedPages: PageEntry[] = [];
  let missingCount = 0;
  if (nav) {
    const listed = new Set<string>();
    collectNavPaths(nav, listed);
    unlistedPages = pages.filter((p) => !listed.has(p.relative_path));
    missingCount = countMissingEntries(nav, existingPaths);
  }
  const hasNav = nav && nav.length > 0;

  // ── Collapse ──────────────────────────────────────────

  useEffect(() => {
    if (!projectRoot) return;
    getCollapsedGroups(projectRoot)
      .then((keys) => { setCollapsed(new Set(keys)); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [projectRoot]);

  const persist = useCallback(
    (next: Set<string>) => { if (projectRoot) saveCollapsedGroups(projectRoot, Array.from(next)).catch(() => {}); },
    [projectRoot],
  );

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      persist(next);
      return next;
    });
  }

  useEffect(() => {
    if (!selectedPage || !loaded) return;
    const rel = selectedPage.relative_path;
    let changed = false;
    const next = new Set(collapsed);
    if (nav) for (const entry of nav) {
      if (!entry.path && entry.children.length > 0 && next.has(entry.title) && groupContainsPage(entry.children, rel)) { next.delete(entry.title); changed = true; }
    }
    if (next.has("__unlisted__") && unlistedPages.some((p) => p.file_path === selectedPage.file_path)) { next.delete("__unlisted__"); changed = true; }
    if (changed) { setCollapsed(next); persist(next); }
  }, [selectedPage?.file_path]);

  // ── Pointer drag system ───────────────────────────────
  // Uses raw pointer events instead of the HTML Drag API. This gives us
  // pixel-level hit-testing for "before / after / inside" drop positions
  // and works reliably across platforms (HTML DnD is inconsistent on Tauri).

  function startPointerDrag(pathStr: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();

    dragFromRef.current = pathStr;
    setDragFrom(pathStr);
    setDropTarget(null);
    document.body.style.cursor = "grabbing";

    function onMove(ev: PointerEvent) {
      const hit = findDropTargetAtPoint(ev.clientX, ev.clientY);
      if (!hit) {
        setDropTarget(null);
        return;
      }

      // Validate: no self-drop, no drop into own subtree
      if (hit.pathStr === dragFromRef.current) {
        setDropTarget(null);
        return;
      }
      if (dragFromRef.current && isAncestor(dragFromRef.current, hit.pathStr)) {
        setDropTarget(null);
        return;
      }

      setDropTarget({ key: hit.pathStr, pos: hit.pos });

      // Auto-expand collapsed group on sustained hover over "inside"
      if (hit.isGroup && hit.pos === "inside") {
        const el = document.querySelector(`[data-navpath="${hit.pathStr}"]`) as HTMLElement | null;
        const groupKey = el?.dataset.navgroupkey;
        if (groupKey && !expandTimer.current) {
          expandTimer.current = window.setTimeout(() => {
            setCollapsed((prev) => {
              if (!prev.has(groupKey)) return prev;
              const next = new Set(prev);
              next.delete(groupKey);
              persist(next);
              return next;
            });
            expandTimer.current = null;
          }, 600);
        }
      } else {
        if (expandTimer.current) { clearTimeout(expandTimer.current); expandTimer.current = null; }
      }
    }

    function onUp(ev: PointerEvent) {
      cleanup();
      const hit = findDropTargetAtPoint(ev.clientX, ev.clientY);
      const from = dragFromRef.current;

      if (from && hit && hit.pathStr !== from && !isAncestor(from, hit.pathStr)) {
        const fromArr = from.split(",").map(Number);
        const toArr = hit.pathStr.split(",").map(Number);
        onDragMoveNav(fromArr, toArr, hit.pos);
      } else {
      }

      reset();
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        cleanup();
        reset();
      }
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.cursor = "";
      if (expandTimer.current) { clearTimeout(expandTimer.current); expandTimer.current = null; }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKeyDown);
  }

  function reset() {
    dragFromRef.current = null;
    setDragFrom(null);
    setDropTarget(null);
  }

  function dc(pathStr: string): string {
    if (!dropTarget || dropTarget.key !== pathStr) return "";
    return ` drop-${dropTarget.pos}`;
  }

  const isDragging = dragFrom !== null;

  // ── Render ────────────────────────────────────────────

  return (
    <aside className={`sidebar${isDragging ? " sidebar-is-dragging" : ""}`}>
      <div className="sidebar-header">
        <span className="sidebar-label">{hasNav ? "Navigation" : "Pages"}</span>
        <div className="sidebar-header-actions">
          <span className="sidebar-count">{pages.length}</span>
          {missingCount > 0 && (
            <button className="sidebar-action-btn" title={`Clean up ${missingCount} missing`} onClick={onCleanMissing}><Ico size={13}>{IClean}</Ico></button>
          )}
          <button className="sidebar-action-btn" title="Refresh" onClick={onRefresh}><Ico size={13}>{IRefresh}</Ico></button>
          <button className="sidebar-action-btn" title="New group" onClick={onNewGroup}><Ico size={13}>{IFolder}</Ico></button>
          <button className="sidebar-action-btn accent" title="New page" onClick={onNewPage}><Ico size={14}>{IPlus}</Ico></button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {hasNav ? (
          <>
            {nav!.map((entry, i) => (
              <NavRow
                key={`nav-${i}`}
                entry={entry}
                path={[i]}
                pathStr={String(i)}
                pageMap={pageMap}
                selectedPage={selectedPage}
                onSelectPage={onSelectPage}
                onRenamePage={onRenamePage}
                onDeletePage={onDeletePage}
                onRemoveFromNav={onRemoveFromNav}
                depth={0}
                collapsed={collapsed}
                onToggle={toggle}
                startDrag={startPointerDrag}
                dc={dc}
                dragFrom={dragFrom}
              />
            ))}

            {unlistedPages.length > 0 && (
              <div className="sidebar-group" style={{ marginTop: 12 }}>
                <div className="sidebar-group-header sidebar-group-toggle" onClick={() => toggle("__unlisted__")}>
                  <span className={`sidebar-chevron${collapsed.has("__unlisted__") ? "" : " open"}`}><Ico size={12}>{IChevron}</Ico></span>
                  <Ico size={14}>{IFile}</Ico>
                  <span className="sidebar-group-name">Unlisted Pages</span>
                  <span className="sidebar-group-count">{unlistedPages.length}</span>
                </div>
                {!collapsed.has("__unlisted__") && unlistedPages.map((page) => (
                  <SimpleRow key={page.relative_path} page={page} isActive={selectedPage?.file_path === page.file_path}
                    onSelect={onSelectPage} onRename={onRenamePage} onDelete={onDeletePage}
                    extra={<button className="sidebar-action-btn-sm" title="Add to nav" onClick={() => onAddToNav(page)}><Ico>{IPlus}</Ico></button>}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          pages.map((page) => (
            <SimpleRow key={page.relative_path} page={page} isActive={selectedPage?.file_path === page.file_path}
              onSelect={onSelectPage} onRename={onRenamePage} onDelete={onDeletePage} />
          ))
        )}
      </nav>
    </aside>
  );
}

// ── Nav row (recursive) with pointer drag on grip ────────

function NavRow({
  entry, path, pathStr, pageMap, selectedPage,
  onSelectPage, onRenamePage, onDeletePage, onRemoveFromNav,
  depth, collapsed, onToggle,
  startDrag, dc, dragFrom,
}: {
  entry: NavEntry; path: number[]; pathStr: string;
  pageMap: Map<string, PageEntry>; selectedPage: PageEntry | null;
  onSelectPage: (p: PageEntry) => void;
  onRenamePage: (p: PageEntry) => void;
  onDeletePage: (p: PageEntry) => void;
  onRemoveFromNav: (path: number[], title: string) => void;
  depth: number; collapsed: Set<string>; onToggle: (k: string) => void;
  startDrag: (pathStr: string, e: React.PointerEvent) => void;
  dc: (pathStr: string) => string;
  dragFrom: string | null;
}) {
  const isBeingDragged = dragFrom === pathStr;

  // ── Group ─────────────────────────────────────────────
  if (!entry.path && entry.children.length > 0) {
    const key = entry.title;
    const isCol = collapsed.has(key);
    return (
      <div
        className={`sidebar-dnd-row${dc(pathStr)}${isBeingDragged ? " dragging-source" : ""}`}
        data-navpath={pathStr}
        data-navgroup="true"
        data-navgroupkey={key}
      >
        <div className="sidebar-group">
          <div className="sidebar-group-header sidebar-group-toggle">
            <span
              className="sidebar-drag-grip"
              onPointerDown={(e) => startDrag(pathStr, e)}
            >
              <Ico size={10}>{IGrip}</Ico>
            </span>
            <span className={`sidebar-chevron${isCol ? "" : " open"}`}
              onClick={(e) => { e.stopPropagation(); onToggle(key); }}>
              <Ico size={12}>{IChevron}</Ico>
            </span>
            <div className="sidebar-group-label" onClick={() => onToggle(key)}>
              <Ico size={14}>{IFolder}</Ico>
              <span className="sidebar-group-name">{entry.title}</span>
              <span className="sidebar-group-count">{entry.children.length}</span>
            </div>
          </div>
          {!isCol && entry.children.map((child, i) => (
            <NavRow key={`nav-${pathStr}-${i}`}
              entry={child} path={[...path, i]} pathStr={`${pathStr},${i}`}
              pageMap={pageMap} selectedPage={selectedPage}
              onSelectPage={onSelectPage} onRenamePage={onRenamePage}
              onDeletePage={onDeletePage} onRemoveFromNav={onRemoveFromNav}
              depth={depth + 1} collapsed={collapsed} onToggle={onToggle}
              startDrag={startDrag} dc={dc} dragFrom={dragFrom}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Page ──────────────────────────────────────────────
  if (entry.path) {
    const page = pageMap.get(entry.path);
    if (!page) {
      return (
        <div className="sidebar-item nested sidebar-missing">
          <div className="sidebar-item-label">
            <Ico size={14}>{IFile}</Ico>
            <span className="sidebar-item-title">{entry.title}</span>
            <span style={{ color: "var(--error)", fontSize: 11 }}>missing</span>
          </div>
          <div className="sidebar-item-actions">
            <button className="sidebar-action-btn-sm" title="Remove from nav"
              onClick={() => onRemoveFromNav(path, entry.title)}><Ico>{IMinus}</Ico></button>
          </div>
        </div>
      );
    }

    const hint = depth === 0 ? getFolderHint(entry.path) : null;
    const active = selectedPage?.file_path === page.file_path;

    return (
      <div
        className={`sidebar-dnd-row${dc(pathStr)}${isBeingDragged ? " dragging-source" : ""}`}
        data-navpath={pathStr}
        data-navgroup="false"
      >
        <div className={`sidebar-item${depth > 0 ? " nested" : ""}${active ? " active" : ""}`}>
          <span
            className="sidebar-drag-grip"
            onPointerDown={(e) => startDrag(pathStr, e)}
          >
            <Ico size={10}>{IGrip}</Ico>
          </span>
          <div className="sidebar-item-label"
            onClick={() => onSelectPage(page)}
            title={page.relative_path}>
            <Ico size={14}>{IFile}</Ico>
            <span className="sidebar-item-title">{entry.title}</span>
            {hint && <span className="sidebar-item-folder">{hint}/</span>}
          </div>
          <div className="sidebar-item-actions">
            <button className="sidebar-action-btn-sm" title="Rename"
              onClick={(e) => { e.stopPropagation(); onRenamePage(page); }}><Ico>{IPencil}</Ico></button>
            <button className="sidebar-action-btn-sm" title="Delete"
              onClick={(e) => { e.stopPropagation(); onDeletePage(page); }}><Ico>{ITrash}</Ico></button>
            <button className="sidebar-action-btn-sm" title="Remove from nav"
              onClick={() => onRemoveFromNav(path, entry.title)}><Ico>{IMinus}</Ico></button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ── Simple row (unlisted / no-nav) ───────────────────────

function SimpleRow({ page, isActive, onSelect, onRename, onDelete, extra }: {
  page: PageEntry; isActive: boolean;
  onSelect: (p: PageEntry) => void; onRename: (p: PageEntry) => void; onDelete: (p: PageEntry) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`sidebar-item${isActive ? " active" : ""}`}>
      <div className="sidebar-item-label"
        onClick={() => onSelect(page)} title={page.relative_path}>
        <Ico size={14}>{IFile}</Ico>
        <span className="sidebar-item-title">{page.title}</span>
      </div>
      <div className="sidebar-item-actions">
        {extra}
        <button className="sidebar-action-btn-sm" title="Rename" onClick={(e) => { e.stopPropagation(); onRename(page); }}><Ico>{IPencil}</Ico></button>
        <button className="sidebar-action-btn-sm" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(page); }}><Ico>{ITrash}</Ico></button>
      </div>
    </div>
  );
}

export default Sidebar;
