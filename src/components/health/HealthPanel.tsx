/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useMemo, useCallback } from "react";
import type { HealthReport, HealthIssue } from "../../types/project";

interface HealthPanelProps {
  report: HealthReport;
  isScanning: boolean;
  onRescan: () => void;
  onClose: () => void;
  onFixAction: (action: string) => void;
}

type Severity = "error" | "warning" | "info";

const SEVERITY_ORDER: Severity[] = ["error", "warning", "info"];

const severityConfig: Record<Severity, { label: string; icon: string }> = {
  error:   { label: "Errors",   icon: "✕" },
  warning: { label: "Warnings", icon: "⚠" },
  info:    { label: "Info",     icon: "ℹ" },
};

const CATEGORY_ICONS: Record<string, string> = {
  "Configuration":   "⚙",
  "Navigation":      "🧭",
  "Links":           "🔗",
  "Images":          "🖼",
  "Extensions":      "🧩",
  "Content Quality": "📝",
  "SEO":             "🔍",
  "Performance":     "⚡",
};

function getScoreLabel(score: number): { text: string; className: string } {
  if (score >= 90) return { text: "Excellent", className: "score-excellent" };
  if (score >= 70) return { text: "Good", className: "score-good" };
  if (score >= 50) return { text: "Fair", className: "score-fair" };
  return { text: "Needs Work", className: "score-poor" };
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = severityConfig[severity];
  return (
    <span className={`health-badge health-badge--${severity}`}>
      {cfg.icon}
    </span>
  );
}

function HealthPanel({
  report,
  isScanning,
  onRescan,
  onClose,
  onFixAction,
}: HealthPanelProps) {
  const { summary, issues } = report;
  const hasIssues = issues.length > 0;

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(
    new Set(SEVERITY_ORDER),
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // ── Derived data ──
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const issue of issues) {
      cats.set(issue.category, (cats.get(issue.category) || 0) + 1);
    }
    return cats;
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (!activeSeverities.has(issue.severity as Severity)) return false;
      if (activeCategory && issue.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = issue.message.toLowerCase().includes(q);
        const matchesFile = issue.file?.toLowerCase().includes(q);
        const matchesDetail = issue.detail?.toLowerCase().includes(q);
        if (!matchesMsg && !matchesFile && !matchesDetail) return false;
      }
      return true;
    });
  }, [issues, activeSeverities, activeCategory, searchQuery]);

  // Group filtered issues by category
  const grouped = useMemo(() => {
    const map = new Map<string, HealthIssue[]>();
    for (const issue of filteredIssues) {
      const list = map.get(issue.category) || [];
      list.push(issue);
      map.set(issue.category, list);
    }
    return map;
  }, [filteredIssues]);

  const toggleSeverity = useCallback((sev: Severity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(sev);
      } else {
        next.add(sev);
      }
      return next;
    });
  }, []);

  const handleCopyReport = useCallback(() => {
    const lines: string[] = [
      `# Project Health Report`,
      `Score: ${summary.score}/100`,
      `Pages: ${summary.total_pages} | In Nav: ${summary.nav_pages} | Unlisted: ${summary.unlisted_pages}`,
      `Errors: ${summary.errors} | Warnings: ${summary.warnings} | Info: ${summary.infos}`,
      "",
    ];

    const byCategory = new Map<string, HealthIssue[]>();
    for (const issue of issues) {
      const list = byCategory.get(issue.category) || [];
      list.push(issue);
      byCategory.set(issue.category, list);
    }

    for (const [cat, items] of byCategory.entries()) {
      lines.push(`## ${cat} (${items.length})`);
      for (const item of items) {
        const sev = item.severity === "error" ? "ERROR" : item.severity === "warning" ? "WARN" : "INFO";
        const loc = [item.file, item.line ? `line ${item.line}` : null].filter(Boolean).join(":");
        lines.push(`  [${sev}] ${item.message}${loc ? ` — ${loc}` : ""}`);
      }
      lines.push("");
    }

    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [issues, summary]);

  const scoreInfo = getScoreLabel(summary.score);

  return (
    <div className="health-panel">
      {/* ── Header ── */}
      <div className="health-header">
        <div className="health-header-left">
          <h3 className="health-title">Project Health</h3>
          <div className={`health-score-badge ${scoreInfo.className}`}>
            <span className="health-score-num">{summary.score}</span>
            <span className="health-score-label">{scoreInfo.text}</span>
          </div>
        </div>
        <div className="health-header-actions">
          <button
            className="health-action-btn"
            onClick={handleCopyReport}
            title="Copy report to clipboard"
            disabled={!hasIssues}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
          <button
            className="health-action-btn"
            onClick={onRescan}
            disabled={isScanning}
            title="Rescan"
          >
            {isScanning ? "Scanning…" : "Rescan"}
          </button>
          <button className="health-close-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="health-stats">
        <div className="health-stat">
          <span className="health-stat-num">{summary.total_pages}</span>
          <span className="health-stat-label">Pages</span>
        </div>
        <div className="health-stat">
          <span className="health-stat-num">{summary.nav_pages}</span>
          <span className="health-stat-label">In Nav</span>
        </div>
        <div className="health-stat">
          <span className="health-stat-num">{summary.unlisted_pages}</span>
          <span className="health-stat-label">Unlisted</span>
        </div>
        <div className="health-stat">
          <span className="health-stat-num">{summary.errors + summary.warnings + summary.infos}</span>
          <span className="health-stat-label">Issues</span>
        </div>
      </div>

      {/* ── Filters toolbar ── */}
      {hasIssues && (
        <div className="health-filters">
          {/* Severity toggles */}
          <div className="health-severity-filters">
            {SEVERITY_ORDER.map((sev) => {
              const count = sev === "error" ? summary.errors : sev === "warning" ? summary.warnings : summary.infos;
              if (count === 0) return null;
              return (
                <button
                  key={sev}
                  className={`health-sev-toggle health-sev-toggle--${sev} ${activeSeverities.has(sev) ? "active" : ""}`}
                  onClick={() => toggleSeverity(sev)}
                  title={`Toggle ${severityConfig[sev].label}`}
                >
                  {severityConfig[sev].icon} {count}
                </button>
              );
            })}
          </div>

          {/* Category chips */}
          <div className="health-cat-filters">
            <button
              className={`health-cat-chip ${activeCategory === null ? "active" : ""}`}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {Array.from(categories.entries()).map(([cat, count]) => (
              <button
                key={cat}
                className={`health-cat-chip ${activeCategory === cat ? "active" : ""}`}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {CATEGORY_ICONS[cat] || "📋"} {cat} ({count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="health-search">
            <svg className="health-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="health-search-input"
              type="text"
              placeholder="Filter issues…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="health-search-clear" onClick={() => setSearchQuery("")}>
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Issues list ── */}
      <div className="health-issues">
        {!hasIssues && (
          <div className="health-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success)" }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="health-empty-title">Your project looks healthy!</p>
            <p className="health-empty-sub">No issues detected across {summary.total_pages} pages.</p>
          </div>
        )}

        {hasIssues && filteredIssues.length === 0 && (
          <div className="health-empty">
            <p className="health-empty-sub">No issues match the current filters.</p>
          </div>
        )}

        {Array.from(grouped.entries()).map(([category, items]) => (
          <div className="health-group" key={category}>
            <div className="health-group-header">
              <span className="health-group-icon">{CATEGORY_ICONS[category] || "📋"}</span>
              <span className="health-group-name">{category}</span>
              <span className="health-group-count">{items.length}</span>
            </div>
            {items.map((issue, i) => (
              <div className="health-issue" key={`${issue.category}-${issue.message}-${i}`}>
                <SeverityBadge severity={issue.severity as Severity} />
                <div className="health-issue-body">
                  <span className="health-issue-msg">{issue.message}</span>
                  {(issue.file || issue.line) && (
                    <span className="health-issue-file">
                      {issue.file}
                      {issue.line ? `:${issue.line}` : ""}
                    </span>
                  )}
                  {issue.detail && (
                    <span className="health-issue-detail">{issue.detail}</span>
                  )}
                </div>
                {issue.action && (
                  <button
                    className="health-fix-btn"
                    onClick={() => onFixAction(issue.action!)}
                    title="Fix this issue"
                  >
                    Fix
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default HealthPanel;
