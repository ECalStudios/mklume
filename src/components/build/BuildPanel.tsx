/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  checkMkdocs,
  buildSite,
  buildSiteExport,
  startServe,
  stopServe,
  isServeRunning,
  openUrlInBrowser,
  openFolderInExplorer,
} from "../../services/projectService";
import type { BuildOutputMode, BuildExportResult } from "../../services/projectService";

interface BuildPanelProps {
  projectRoot: string;
  onClose: () => void;
  onPreviewUrlChange?: (url: string | null) => void;
  onServingChange?: (serving: boolean) => void;
  onOpenDeployAssistant?: () => void;
}

interface LogEntry {
  text: string;
  type: "system" | "stdout" | "stderr" | "success" | "error";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BuildPanel({ projectRoot, onClose, onPreviewUrlChange, onServingChange, onOpenDeployAssistant }: BuildPanelProps) {
  const [mkdocsVersion, setMkdocsVersion] = useState<string | null>(null);
  const [mkdocsError, setMkdocsError] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [serving, setServing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Build output options
  const [buildMode, setBuildMode] = useState<BuildOutputMode>("Folder");
  const [lastExport, setLastExport] = useState<BuildExportResult | null>(null);
  const [showDeployGuide, setShowDeployGuide] = useState(false);

  // Check serve status on mount
  useEffect(() => {
    isServeRunning().then(setServing).catch(() => {});
  }, []);

  // Listen for serve output events
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      const unlisten = await listen<{ line: string; stream: string }>(
        "serve-output",
        (event) => {
          if (cancelled) return;
          const { line, stream } = event.payload;
          setLog((prev) => [
            ...prev,
            {
              text: line,
              type: stream === "system" ? "system" : stream === "stdout" ? "stdout" : "stderr",
            },
          ]);
          // Parse preview URL from mkdocs serve output
          const urlMatch = line.match(/https?:\/\/[\w.:]+\/?/);
          if (urlMatch && line.toLowerCase().includes("serving")) {
            const url = urlMatch[0];
            setPreviewUrl(url);
            onPreviewUrlChange?.(url);
          }
        },
      );
      return unlisten;
    };

    const promise = setup();
    return () => {
      cancelled = true;
      promise.then((unlisten) => unlisten());
    };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function pushLog(text: string, type: LogEntry["type"] = "system") {
    setLog((prev) => [...prev, { text, type }]);
  }

  async function handleCheckMkdocs() {
    pushLog("▸ Checking MkDocs…");
    setMkdocsVersion(null);
    setMkdocsError(null);
    try {
      const version = await checkMkdocs();
      setMkdocsVersion(version);
      pushLog(`✓ ${version}`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMkdocsError(msg);
      pushLog(`✕ ${msg}`, "error");
    }
  }

  async function handleBuild() {
    setIsBuilding(true);
    setLastExport(null);

    if (buildMode === "Folder") {
      // Use the original simple build for folder-only
      pushLog("▸ Running mkdocs build…");
      try {
        const output = await buildSite(projectRoot);
        pushLog(output || "Build completed.", "success");
        pushLog("✓ Site built successfully.", "success");
        setLastExport({
          success: true,
          site_dir: `${projectRoot}/site`,
          zip_path: null,
          zip_size: null,
          message: "Site built successfully.",
          error: null,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pushLog(msg, "error");
        pushLog("✕ Build failed.", "error");
      } finally {
        setIsBuilding(false);
      }
    } else {
      // Use the export command for ZIP and Both modes
      const modeLabel = buildMode === "Zip" ? "ZIP" : "Folder + ZIP";
      pushLog(`▸ Building site (${modeLabel})…`);
      try {
        const result = await buildSiteExport(projectRoot, buildMode);
        setLastExport(result);
        if (result.success) {
          pushLog(result.message || "Build completed.", "success");
          if (result.zip_path && result.zip_size != null) {
            pushLog(`✓ ZIP created: ${formatSize(result.zip_size)}`, "success");
          }
        } else {
          pushLog(result.error || "Build failed.", "error");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pushLog(`✕ ${msg}`, "error");
      } finally {
        setIsBuilding(false);
      }
    }
  }

  async function handleStartServe() {
    pushLog("▸ Starting mkdocs serve…");
    try {
      await startServe(projectRoot);
      setServing(true);
      onServingChange?.(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushLog(`✕ ${msg}`, "error");
    }
  }

  async function handleStopServe() {
    pushLog("▸ Stopping server…");
    try {
      await stopServe();
      setServing(false);
      setPreviewUrl(null);
      onServingChange?.(false);
      onPreviewUrlChange?.(null);
      pushLog("✓ Server stopped.", "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushLog(`✕ ${msg}`, "error");
      setServing(false);
      setPreviewUrl(null);
      onServingChange?.(false);
      onPreviewUrlChange?.(null);
    }
  }

  async function handleOpenInBrowser() {
    const url = previewUrl || "http://127.0.0.1:8000/";
    try {
      await openUrlInBrowser(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushLog(`✕ Could not open browser: ${msg}`, "error");
    }
  }

  return (
    <div className="build-panel">
      <div className="build-header">
        <div className="build-header-left">
          <h3 className="build-title">Build &amp; Preview</h3>
          {serving && <span className="build-badge running">Server Running</span>}
        </div>
        <button className="health-close-btn" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Build output mode selector */}
      <div className="build-output-section">
        <span className="build-output-label">Build output</span>
        <div className="build-output-options">
          {(["Folder", "Zip", "Both"] as BuildOutputMode[]).map((mode) => (
            <label key={mode} className="build-output-option">
              <input
                type="radio"
                name="buildMode"
                checked={buildMode === mode}
                onChange={() => setBuildMode(mode)}
              />
              <span>
                {mode === "Folder" ? "Folder" : mode === "Zip" ? "ZIP" : "Folder + ZIP"}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="build-toolbar">
        <button className="build-action-btn" onClick={handleCheckMkdocs}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Check MkDocs
        </button>
        <button
          className="build-action-btn"
          onClick={handleBuild}
          disabled={isBuilding}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          {isBuilding ? "Building…" : "Build Site"}
        </button>

        <span className="build-toolbar-sep" />

        {!serving ? (
          <button className="build-action-btn accent" onClick={handleStartServe}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Preview
          </button>
        ) : (
          <>
            <button className="build-action-btn danger" onClick={handleStopServe}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop Preview
            </button>
            <button
              className="build-action-btn open-browser"
              onClick={handleOpenInBrowser}
              title={`Open ${previewUrl || "http://127.0.0.1:8000/"} in browser`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Open in Browser
            </button>
          </>
        )}

        <button
          className="build-action-btn small"
          onClick={() => { setLog([]); setLastExport(null); }}
          title="Clear log"
        >
          Clear
        </button>
      </div>

      {/* Status hints */}
      {serving && (
        <div className="build-status-bar serving">
          <span className="build-serving-dot" />
          Serving at{" "}
          <span className="build-serving-url">
            {previewUrl || "http://127.0.0.1:8000/"}
          </span>
        </div>
      )}
      {mkdocsVersion && !mkdocsError && (
        <div className="build-status-bar success">{mkdocsVersion}</div>
      )}
      {mkdocsError && (
        <div className="build-status-bar error">{mkdocsError}</div>
      )}

      {/* Build result card */}
      {lastExport && lastExport.success && (
        <div className="build-export-result">
          <div className="build-export-result-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{lastExport.message}</span>
          </div>

          <div className="build-export-outputs">
            {lastExport.site_dir && (
              <div className="build-export-output-row">
                <div className="build-export-output-info">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="build-export-output-label">Site folder</span>
                </div>
                <button
                  className="build-export-open-btn"
                  onClick={() => openFolderInExplorer(lastExport.site_dir!).catch(() => {})}
                >
                  Open
                </button>
              </div>
            )}
            {lastExport.zip_path && (
              <div className="build-export-output-row">
                <div className="build-export-output-info">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
                    <path d="M7 12h14" />
                    <path d="m11 8-4 4 4 4" />
                  </svg>
                  <span className="build-export-output-label">
                    ZIP archive
                    {lastExport.zip_size != null && (
                      <span className="build-export-size">
                        {" "}({formatSize(lastExport.zip_size)})
                      </span>
                    )}
                  </span>
                </div>
                <button
                  className="build-export-open-btn"
                  onClick={() => {
                    // Open the dist/ folder containing the ZIP
                    const distDir = lastExport.zip_path!.replace(/[/\\][^/\\]+$/, "");
                    openFolderInExplorer(distDir).catch(() => {});
                  }}
                >
                  Open
                </button>
              </div>
            )}
          </div>

          {/* Deploy guidance toggle */}
          <button
            className="build-deploy-guide-toggle"
            onClick={() => setShowDeployGuide(!showDeployGuide)}
          >
            {showDeployGuide ? "Hide" : "Show"} deployment guide
          </button>

          {showDeployGuide && (
            <div className="build-deploy-guide">
              <p>
                <strong>MkLume does not need access to your hosting account.</strong>
              </p>
              <p>
                To publish, upload the contents of the <em>site</em> folder to your static hosting provider.
                If your host accepts ZIP uploads, use the generated ZIP file.
              </p>
              <p>
                The site folder contains the finished HTML, CSS, JavaScript, images, and search files.
                You do not upload your Markdown source files unless your host builds MkDocs for you.
              </p>
              <p className="build-deploy-hint">
                <strong>GitHub Pages with Actions:</strong> commit and push your source project.{" "}
                <strong>Static file hosts:</strong> upload the built site folder or ZIP.
              </p>
            </div>
          )}
        </div>
      )}

      {/* GitHub Pages deploy link */}
      {onOpenDeployAssistant && (
        <button className="build-deploy-assistant-link" onClick={onOpenDeployAssistant}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          Prepare GitHub Pages Deployment
        </button>
      )}

      {/* Output log */}
      <div className="build-log">
        {log.length === 0 && (
          <div className="build-log-empty">
            Click an action above to see output here.
          </div>
        )}
        {log.map((entry, i) => (
          <div key={i} className={`build-log-line ${entry.type}`}>
            {entry.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default BuildPanel;
