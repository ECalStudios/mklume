/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useState, useEffect, useCallback } from "react";
import type {
  DeployReadiness,
  DeployGenerateResult,
} from "../../services/projectService";
import {
  deployCheckReadiness,
  deployGenerateWorkflow,
  deployGenerateWorkflowAlternate,
  deployGenerateRequirements,
  deployWriteCname,
  openFolderInExplorer,
} from "../../services/projectService";

interface DeployAssistantProps {
  projectRoot: string;
  onClose: () => void;
  onOpenGitSync: () => void;
  onOpenBuild: () => void;
}

type Step = "readiness" | "method" | "configure" | "done";

export default function DeployAssistant({
  projectRoot,
  onClose,
  onOpenGitSync,
  onOpenBuild,
}: DeployAssistantProps) {
  const [readiness, setReadiness] = useState<DeployReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("readiness");

  // Configure step state
  const [branch, setBranch] = useState("main");
  const [customDomain, setCustomDomain] = useState("");
  const [generateReqs, setGenerateReqs] = useState(false);

  // Existing workflow conflict
  const [conflictChoice, setConflictChoice] = useState<"replace" | "alternate" | "cancel" | null>(null);
  const [showExistingWorkflow, setShowExistingWorkflow] = useState(false);

  // Result
  const [results, setResults] = useState<DeployGenerateResult[]>([]);
  const [generating, setGenerating] = useState(false);

  // ── Load readiness ──────────────────────────────────

  const checkReadiness = useCallback(async () => {
    setLoading(true);
    try {
      const r = await deployCheckReadiness(projectRoot);
      setReadiness(r);

      // Set branch to detected branch or default
      if (r.branch) {
        setBranch(r.branch === "master" ? "master" : r.branch === "main" ? "main" : r.branch);
      }

      // Auto-suggest requirements.txt creation
      if (!r.has_requirements_txt) {
        setGenerateReqs(true);
      }

      // Pre-fill custom domain from existing CNAME
      if (r.cname_value) {
        setCustomDomain(r.cname_value);
      }
    } catch {
      setReadiness(null);
    }
    setLoading(false);
  }, [projectRoot]);

  useEffect(() => {
    checkReadiness();
  }, [checkReadiness]);

  // ── Generate files ──────────────────────────────────

  const handleGenerate = async () => {
    if (!readiness) return;
    setGenerating(true);
    const newResults: DeployGenerateResult[] = [];

    try {
      // 1. Generate workflow
      const workflowOpts = { branch, site_dir: readiness.site_dir };

      if (readiness.existing_deploy_workflow && conflictChoice === "alternate") {
        const wfResult = await deployGenerateWorkflowAlternate(projectRoot, workflowOpts);
        newResults.push(wfResult);
      } else {
        const wfResult = await deployGenerateWorkflow(projectRoot, workflowOpts);
        newResults.push(wfResult);
      }

      // 2. Generate requirements.txt if needed
      if (generateReqs && !readiness.has_requirements_txt) {
        const reqResult = await deployGenerateRequirements(projectRoot);
        newResults.push(reqResult);
      }

      // 3. Write CNAME if specified
      if (customDomain.trim()) {
        const cnameResult = await deployWriteCname(projectRoot, customDomain.trim());
        newResults.push(cnameResult);
      }

      setResults(newResults);
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResults([{
        success: false,
        file_path: null,
        message: "",
        error: msg,
      }]);
      setStep("done");
    }
    setGenerating(false);
  };

  // ── Render: Loading ─────────────────────────────────

  if (loading) {
    return (
      <div className="deploy-panel">
        <DeployHeader onClose={onClose} />
        <div className="deploy-body">
          <div className="deploy-loading">
            <div className="deploy-spinner" />
            <span>Checking project readiness...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!readiness) {
    return (
      <div className="deploy-panel">
        <DeployHeader onClose={onClose} />
        <div className="deploy-body">
          <div className="deploy-state">
            <p>Failed to check project readiness.</p>
            <button className="deploy-btn-secondary" onClick={checkReadiness}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Readiness ───────────────────────────────

  const renderReadiness = () => (
    <div className="deploy-step">
      <div className="deploy-notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>
          MkLume does not ask for GitHub tokens or passwords. This assistant creates the workflow and config files needed for GitHub Pages. You review them, then commit and push using Git Sync or your own Git client.
        </span>
      </div>

      <h4 className="deploy-section-title">Project Readiness</h4>
      <div className="deploy-checklist">
        <CheckItem
          label="Git repository"
          ok={readiness.is_repo}
          detail={readiness.is_repo ? "Detected" : "Not a Git repository"}
        />
        <CheckItem
          label="GitHub remote"
          ok={readiness.is_github}
          detail={
            readiness.is_github
              ? `${readiness.github_owner}/${readiness.github_repo}`
              : readiness.has_remote
                ? "Remote found, but not GitHub"
                : "No remote configured"
          }
        />
        <CheckItem
          label="MkDocs config"
          ok={true}
          detail={`site_dir: ${readiness.site_dir}`}
        />
        <CheckItem
          label="Existing Pages workflow"
          ok={!readiness.existing_deploy_workflow}
          detail={
            readiness.existing_deploy_workflow
              ? "deploy-mkdocs.yml exists"
              : readiness.other_pages_workflows.length > 0
                ? `Other workflows found: ${readiness.other_pages_workflows.join(", ")}`
                : "None found"
          }
          neutral={!readiness.existing_deploy_workflow}
        />
      </div>

      {readiness.other_pages_workflows.length > 0 && !readiness.existing_deploy_workflow && (
        <div className="deploy-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>This project already has GitHub Actions workflows. Review before adding another deployment workflow.</span>
        </div>
      )}

      {!readiness.is_repo && (
        <div className="deploy-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>Initialize a Git repository and add a GitHub remote before generating deployment files.</span>
        </div>
      )}

      <div className="deploy-step-actions">
        <button
          className="deploy-btn-primary"
          onClick={() => setStep("method")}
          disabled={!readiness.is_repo}
        >
          Continue
        </button>
      </div>
    </div>
  );

  // ── Render: Method ──────────────────────────────────

  const renderMethod = () => (
    <div className="deploy-step">
      <h4 className="deploy-section-title">Choose Deployment Method</h4>

      <div className="deploy-method-cards">
        <button
          className="deploy-method-card selected"
          onClick={() => setStep("configure")}
        >
          <div className="deploy-method-badge">Recommended</div>
          <div className="deploy-method-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </div>
          <h5>GitHub Actions</h5>
          <p>GitHub Actions will install MkDocs dependencies, build the site, and publish the generated static files to GitHub Pages.</p>
        </button>

        <button
          className="deploy-method-card"
          onClick={() => { onClose(); onOpenBuild(); }}
        >
          <div className="deploy-method-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <h5>Manual Static Upload</h5>
          <p>Build your site locally using Build Export, then upload the site folder or ZIP to a hosting provider manually.</p>
        </button>
      </div>

      <div className="deploy-step-actions">
        <button className="deploy-btn-secondary" onClick={() => setStep("readiness")}>
          Back
        </button>
      </div>
    </div>
  );

  // ── Render: Configure ───────────────────────────────

  const renderConfigure = () => {
    const hasConflict = !!readiness.existing_deploy_workflow;
    const canGenerate = !hasConflict || conflictChoice === "replace" || conflictChoice === "alternate";

    return (
      <div className="deploy-step">
        <h4 className="deploy-section-title">Configure Workflow</h4>

        {/* Existing workflow conflict */}
        {hasConflict && (
          <div className="deploy-conflict">
            <div className="deploy-conflict-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>deploy-mkdocs.yml already exists</span>
            </div>
            <div className="deploy-conflict-options">
              <button
                className={`deploy-btn-small ${showExistingWorkflow ? "active" : ""}`}
                onClick={() => setShowExistingWorkflow(!showExistingWorkflow)}
              >
                {showExistingWorkflow ? "Hide" : "View"} existing
              </button>
              <button
                className={`deploy-btn-small ${conflictChoice === "replace" ? "active" : ""}`}
                onClick={() => setConflictChoice("replace")}
              >
                Replace
              </button>
              <button
                className={`deploy-btn-small ${conflictChoice === "alternate" ? "active" : ""}`}
                onClick={() => setConflictChoice("alternate")}
              >
                Save as new file
              </button>
            </div>
            {showExistingWorkflow && readiness.existing_deploy_workflow && (
              <pre className="deploy-workflow-preview">
                {readiness.existing_deploy_workflow}
              </pre>
            )}
          </div>
        )}

        {/* Branch selection */}
        <div className="deploy-field">
          <label className="deploy-label">Trigger branch</label>
          <div className="deploy-branch-options">
            {["main", "master"].map((b) => (
              <label key={b} className="deploy-radio">
                <input
                  type="radio"
                  name="branch"
                  checked={branch === b}
                  onChange={() => setBranch(b)}
                />
                <span>{b}</span>
              </label>
            ))}
            {readiness.branch && readiness.branch !== "main" && readiness.branch !== "master" && (
              <label className="deploy-radio">
                <input
                  type="radio"
                  name="branch"
                  checked={branch === readiness.branch}
                  onChange={() => setBranch(readiness.branch!)}
                />
                <span>{readiness.branch} (current)</span>
              </label>
            )}
          </div>
          <p className="deploy-hint">The workflow will run when you push to this branch.</p>
        </div>

        {/* Site dir info */}
        <div className="deploy-field">
          <label className="deploy-label">Upload artifact path</label>
          <div className="deploy-value">{readiness.site_dir}</div>
          <p className="deploy-hint">Detected from your mkdocs.yml site_dir setting.</p>
        </div>

        {/* Requirements.txt */}
        <div className="deploy-field">
          <label className="deploy-checkbox-label">
            <input
              type="checkbox"
              checked={generateReqs}
              onChange={(e) => setGenerateReqs(e.target.checked)}
              disabled={readiness.has_requirements_txt}
            />
            <span>
              {readiness.has_requirements_txt
                ? "requirements.txt already exists"
                : "Create requirements.txt"}
            </span>
          </label>
          <p className="deploy-hint">
            GitHub Actions needs to install the same MkDocs packages your site uses locally. For simple Material sites, mkdocs-material is enough. If your site uses extra plugins, add them to requirements.txt.
          </p>
          {readiness.detected_plugins.length > 0 && (
            <p className="deploy-hint">
              Detected plugins: {readiness.detected_plugins.join(", ")}. If any require separate pip packages, add them to requirements.txt manually.
            </p>
          )}
        </div>

        {/* site_url suggestion */}
        {readiness.inferred_pages_url && !readiness.site_url && (
          <div className="deploy-field">
            <label className="deploy-label">Suggested site_url</label>
            <div className="deploy-value">{readiness.inferred_pages_url}</div>
            <p className="deploy-hint">
              You can set this in Site Settings after deploying. It helps MkDocs generate correct canonical URLs.
            </p>
          </div>
        )}

        {/* Custom domain */}
        <div className="deploy-field">
          <label className="deploy-label">Custom domain (optional)</label>
          <input
            type="text"
            className="deploy-input"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="docs.example.com"
          />
          {customDomain.trim() && (
            <p className="deploy-hint">
              MkLume will create a CNAME file in docs/. You must also configure DNS with your domain provider and set the custom domain in GitHub Pages settings.
            </p>
          )}
        </div>

        <div className="deploy-step-actions">
          <button className="deploy-btn-secondary" onClick={() => setStep("method")}>
            Back
          </button>
          <button
            className="deploy-btn-primary"
            onClick={handleGenerate}
            disabled={generating || (hasConflict && !canGenerate)}
          >
            {generating ? (
              <>
                <div className="deploy-spinner-small" />
                Generating...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Generate Files
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ── Render: Done ────────────────────────────────────

  const renderDone = () => {
    const allSuccess = results.every((r) => r.success);

    return (
      <div className="deploy-step">
        {/* Results */}
        <div className={`deploy-result-card ${allSuccess ? "success" : "error"}`}>
          <div className="deploy-result-icon">
            {allSuccess ? (
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
          <h4>{allSuccess ? "Files Generated Successfully" : "Some files failed"}</h4>
          <div className="deploy-result-files">
            {results.map((r, i) => (
              <div key={i} className={`deploy-result-file ${r.success ? "ok" : "fail"}`}>
                <span className="deploy-result-file-icon">
                  {r.success ? "✓" : "✗"}
                </span>
                <span>{r.message || r.error}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GitHub Pages setup instructions */}
        {allSuccess && (
          <div className="deploy-instructions">
            <h4 className="deploy-section-title">Next Steps</h4>
            <ol className="deploy-steps-list">
              <li>
                <strong>Commit and push</strong> the generated files to GitHub.
                <button
                  className="deploy-inline-btn"
                  onClick={() => { onClose(); onOpenGitSync(); }}
                >
                  Open Git Sync
                </button>
              </li>
              <li>
                On GitHub, open your repository.
              </li>
              <li>
                Go to <strong>Settings → Pages</strong>.
              </li>
              <li>
                Under "Build and deployment", choose <strong>"GitHub Actions"</strong> as the source.
              </li>
              <li>
                Wait for the workflow to run. Your site URL will appear in the Actions deployment output.
              </li>
            </ol>

            {readiness.inferred_pages_url && (
              <div className="deploy-pages-url">
                <span className="deploy-label">Expected site URL:</span>
                <span className="deploy-value">{readiness.inferred_pages_url}</span>
              </div>
            )}

            {customDomain.trim() && (
              <div className="deploy-custom-domain-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  Remember to configure DNS for <strong>{customDomain.trim()}</strong> with your domain provider and set the custom domain in GitHub Pages settings.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="deploy-done-actions">
          <button
            className="deploy-btn-primary"
            onClick={() => { onClose(); onOpenGitSync(); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" />
              <path d="M11 18H8a2 2 0 0 1-2-2V9" />
            </svg>
            Open Git Sync
          </button>
          <button
            className="deploy-btn-secondary"
            onClick={() => {
              const wfResult = results.find((r) => r.file_path && r.file_path.includes("workflows"));
              if (wfResult?.file_path) {
                const dir = wfResult.file_path.replace(/[\\/][^\\/]+$/, "");
                openFolderInExplorer(dir).catch(() => {});
              }
            }}
          >
            Open Workflow Folder
          </button>
          <button className="deploy-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────

  const stepLabels: { key: Step; label: string }[] = [
    { key: "readiness", label: "Check Project" },
    { key: "method", label: "Method" },
    { key: "configure", label: "Configure" },
    { key: "done", label: "Done" },
  ];

  return (
    <div className="deploy-panel">
      <DeployHeader onClose={onClose} />

      {/* Step indicator */}
      <div className="deploy-steps">
        {stepLabels.map((s, i) => (
          <div
            key={s.key}
            className={`deploy-step-indicator ${step === s.key ? "active" : ""} ${
              stepLabels.findIndex((x) => x.key === step) > i ? "completed" : ""
            }`}
          >
            <span className="deploy-step-num">{i + 1}</span>
            <span className="deploy-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="deploy-body">
        {step === "readiness" && renderReadiness()}
        {step === "method" && renderMethod()}
        {step === "configure" && renderConfigure()}
        {step === "done" && renderDone()}
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────

function DeployHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="deploy-header">
      <h3 className="deploy-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
          <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
        GitHub Pages Deploy Assistant
      </h3>
      <button className="deploy-close-btn" onClick={onClose} title="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function CheckItem({
  label,
  ok,
  detail,
  neutral,
}: {
  label: string;
  ok: boolean;
  detail: string;
  neutral?: boolean;
}) {
  return (
    <div className="deploy-check-item">
      <span className={`deploy-check-icon ${ok ? (neutral ? "neutral" : "ok") : "warn"}`}>
        {ok ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </span>
      <span className="deploy-check-label">{label}</span>
      <span className="deploy-check-detail">{detail}</span>
    </div>
  );
}
