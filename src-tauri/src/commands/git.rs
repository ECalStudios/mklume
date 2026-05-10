// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

//! Safe Git operations for MkDocs project synchronization.
//! Only performs: status, add (safe docs files), commit, push.
//! Never runs: reset, clean, checkout, merge, rebase, force push.

use serde::Serialize;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// ── Types ───────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct GitRepoInfo {
    pub git_installed: bool,
    pub is_repo: bool,
    pub repo_root: Option<String>,
    pub branch: Option<String>,
    pub remote: Option<String>,
    pub upstream: Option<String>,
    pub last_commit: Option<String>,
    pub last_commit_date: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "M", "A", "D", "??"", "R", etc.
    pub staged: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct GitStatusResult {
    pub info: GitRepoInfo,
    pub files: Vec<GitFileStatus>,
    pub ahead: i32,
    pub behind: i32,
    pub has_changes: bool,
    pub error: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct GitSyncResult {
    pub success: bool,
    pub committed: bool,
    pub pushed: bool,
    pub commit_hash: Option<String>,
    pub files_committed: i32,
    pub message: String,
    pub error: Option<String>,
    pub error_detail: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct GitIgnoreSuggestion {
    pub has_gitignore: bool,
    pub missing_entries: Vec<String>,
    pub suggested_content: String,
}

// ── Helpers ─────────────────────────────────────────────

/// Build a git command with hidden console window on Windows.
fn git_cmd(args: &[&str], cwd: &str) -> std::io::Result<std::process::Output> {
    let mut cmd = Command::new("git");
    for a in args {
        cmd.arg(a);
    }
    cmd.current_dir(cwd);

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    cmd.output()
}

/// Run a git command and return trimmed stdout on success.
fn git_output(args: &[&str], cwd: &str) -> Result<String, String> {
    let output = git_cmd(args, cwd)
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(stderr)
    }
}

/// Check if git is installed.
fn is_git_installed() -> bool {
    let mut cmd = Command::new("git");
    cmd.arg("--version");

    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

/// Folders that should never be staged (generated/build artifacts).
const EXCLUDED_PATTERNS: &[&str] = &[
    "site/",
    "node_modules/",
    ".venv/",
    "venv/",
    "__pycache__/",
    ".mklume/backups/",
    ".mklume/recovery/",
    ".opendocs/backups/",
    ".opendocs/recovery/",
    "target/",
    "dist/",
    "build/",
];

// ── Commands ────────────────────────────────────────────

#[tauri::command]
pub fn git_check_installed() -> bool {
    is_git_installed()
}

#[tauri::command]
pub fn git_get_repo_info(project_root: String) -> GitRepoInfo {
    if !is_git_installed() {
        return GitRepoInfo {
            git_installed: false,
            is_repo: false,
            repo_root: None,
            branch: None,
            remote: None,
            upstream: None,
            last_commit: None,
            last_commit_date: None,
        };
    }

    // Check if inside a git repo
    let repo_root = git_output(&["rev-parse", "--show-toplevel"], &project_root).ok();
    let is_repo = repo_root.is_some();

    if !is_repo {
        return GitRepoInfo {
            git_installed: true,
            is_repo: false,
            repo_root: None,
            branch: None,
            remote: None,
            upstream: None,
            last_commit: None,
            last_commit_date: None,
        };
    }

    let cwd = repo_root.as_deref().unwrap_or(&project_root);

    let branch = git_output(&["branch", "--show-current"], cwd).ok();
    let remote = git_output(&["remote"], cwd)
        .ok()
        .and_then(|r| r.lines().next().map(|s| s.to_string()));
    let upstream = git_output(
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        cwd,
    )
    .ok();

    let last_commit = git_output(
        &["log", "-1", "--format=%s", "--no-decorate"],
        cwd,
    )
    .ok()
    .filter(|s| !s.is_empty());

    let last_commit_date = git_output(
        &["log", "-1", "--format=%cr", "--no-decorate"],
        cwd,
    )
    .ok()
    .filter(|s| !s.is_empty());

    GitRepoInfo {
        git_installed: true,
        is_repo: true,
        repo_root,
        branch,
        remote,
        upstream,
        last_commit,
        last_commit_date,
    }
}

#[tauri::command]
pub fn git_status(project_root: String) -> GitStatusResult {
    let info = git_get_repo_info(project_root.clone());

    if !info.git_installed {
        return GitStatusResult {
            info,
            files: vec![],
            ahead: 0,
            behind: 0,
            has_changes: false,
            error: Some("Git is not installed on this computer.".to_string()),
        };
    }

    if !info.is_repo {
        return GitStatusResult {
            info,
            files: vec![],
            ahead: 0,
            behind: 0,
            has_changes: false,
            error: Some("This project is not connected to Git yet.".to_string()),
        };
    }

    let cwd = info.repo_root.as_deref().unwrap_or(&project_root);

    // Get file status using porcelain format
    let files = match git_output(&["status", "--porcelain"], cwd) {
        Ok(output) => {
            if output.is_empty() {
                vec![]
            } else {
                output
                    .lines()
                    .filter_map(|line| {
                        if line.len() < 4 {
                            return None;
                        }
                        let index_status = &line[0..1];
                        let worktree_status = &line[1..2];
                        let path = line[3..].to_string();

                        // Skip excluded patterns
                        let dominated = EXCLUDED_PATTERNS
                            .iter()
                            .any(|pat| path.starts_with(pat) || path.contains(&format!("/{}", pat)));
                        if dominated {
                            return None;
                        }

                        let status = if index_status == "?" {
                            "??".to_string()
                        } else if index_status != " " {
                            index_status.to_string()
                        } else {
                            worktree_status.to_string()
                        };

                        let staged = index_status != " " && index_status != "?";

                        Some(GitFileStatus {
                            path,
                            status,
                            staged,
                        })
                    })
                    .collect()
            }
        }
        Err(e) => {
            return GitStatusResult {
                info,
                files: vec![],
                ahead: 0,
                behind: 0,
                has_changes: false,
                error: Some(format!("Failed to get Git status: {}", e)),
            };
        }
    };

    // Get ahead/behind counts
    let (ahead, behind) = if info.upstream.is_some() {
        let ahead = git_output(&["rev-list", "--count", "@{u}..HEAD"], cwd)
            .ok()
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(0);
        let behind = git_output(&["rev-list", "--count", "HEAD..@{u}"], cwd)
            .ok()
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(0);
        (ahead, behind)
    } else {
        (0, 0)
    };

    let has_changes = !files.is_empty();

    GitStatusResult {
        info,
        files,
        ahead,
        behind,
        has_changes,
        error: None,
    }
}

#[tauri::command]
pub fn git_sync(
    project_root: String,
    commit_message: String,
    do_push: bool,
) -> GitSyncResult {
    let info = git_get_repo_info(project_root.clone());

    if !info.git_installed || !info.is_repo {
        return GitSyncResult {
            success: false,
            committed: false,
            pushed: false,
            commit_hash: None,
            files_committed: 0,
            message: String::new(),
            error: Some(if !info.git_installed {
                "Git is not installed.".to_string()
            } else {
                "Not a Git repository.".to_string()
            }),
            error_detail: None,
        };
    }

    let msg = commit_message.trim();
    if msg.is_empty() {
        return GitSyncResult {
            success: false,
            committed: false,
            pushed: false,
            commit_hash: None,
            files_committed: 0,
            message: String::new(),
            error: Some("Commit message cannot be empty.".to_string()),
            error_detail: None,
        };
    }

    let cwd = info.repo_root.as_deref().unwrap_or(&project_root);

    // Stage safe project files: mkdocs.yml + docs/** + overrides/**
    // We use targeted adds rather than `git add -A` for safety.

    // Find the docs_dir relative to repo root — it might be a subdirectory
    // if the project root isn't the repo root.
    let project_rel = if let Some(ref root) = info.repo_root {
        let repo = std::path::Path::new(root);
        let proj = std::path::Path::new(&project_root);
        proj.strip_prefix(repo)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    } else {
        String::new()
    };

    // Build paths to stage
    let mut paths_to_add: Vec<String> = Vec::new();

    // mkdocs.yml at project root
    let mkdocs_path = if project_rel.is_empty() {
        "mkdocs.yml".to_string()
    } else {
        format!("{}/mkdocs.yml", project_rel.replace('\\', "/"))
    };
    paths_to_add.push(mkdocs_path);

    // Also try mkdocs.yaml
    let mkdocs_yaml_path = if project_rel.is_empty() {
        "mkdocs.yaml".to_string()
    } else {
        format!("{}/mkdocs.yaml", project_rel.replace('\\', "/"))
    };
    paths_to_add.push(mkdocs_yaml_path);

    // docs/ directory
    let docs_path = if project_rel.is_empty() {
        "docs/".to_string()
    } else {
        format!("{}/docs/", project_rel.replace('\\', "/"))
    };
    paths_to_add.push(docs_path);

    // overrides/ directory (custom theme overrides)
    let overrides_path = if project_rel.is_empty() {
        "overrides/".to_string()
    } else {
        format!("{}/overrides/", project_rel.replace('\\', "/"))
    };
    paths_to_add.push(overrides_path);

    // .gitignore if it exists
    let gitignore_path = if project_rel.is_empty() {
        ".gitignore".to_string()
    } else {
        format!("{}/.gitignore", project_rel.replace('\\', "/"))
    };
    paths_to_add.push(gitignore_path);

    // Stage each path (ignore errors for paths that don't exist)
    for path in &paths_to_add {
        // Use -- to prevent path from being interpreted as an option
        let _ = git_cmd(&["add", "--", path], cwd);
    }

    // Check if there are actually staged changes
    let staged_check = git_output(&["diff", "--cached", "--name-only"], cwd)
        .unwrap_or_default();

    if staged_check.is_empty() {
        // Nothing was staged — check if there are changes at all
        let status = git_output(&["status", "--porcelain"], cwd)
            .unwrap_or_default();

        if status.is_empty() {
            return GitSyncResult {
                success: true,
                committed: false,
                pushed: false,
                commit_hash: None,
                files_committed: 0,
                message: "No changes to commit. Working tree is clean.".to_string(),
                error: None,
                error_detail: None,
            };
        } else {
            return GitSyncResult {
                success: true,
                committed: false,
                pushed: false,
                commit_hash: None,
                files_committed: 0,
                message: "No documentation files to commit. Changes exist outside docs/ and mkdocs.yml.".to_string(),
                error: None,
                error_detail: None,
            };
        }
    }

    let files_committed = staged_check.lines().count() as i32;

    // Commit
    match git_cmd(&["commit", "-m", msg], cwd) {
        Ok(output) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                return GitSyncResult {
                    success: false,
                    committed: false,
                    pushed: false,
                    commit_hash: None,
                    files_committed: 0,
                    message: String::new(),
                    error: Some("Commit failed.".to_string()),
                    error_detail: Some(stderr),
                };
            }
        }
        Err(e) => {
            return GitSyncResult {
                success: false,
                committed: false,
                pushed: false,
                commit_hash: None,
                files_committed: 0,
                message: String::new(),
                error: Some("Failed to run git commit.".to_string()),
                error_detail: Some(e.to_string()),
            };
        }
    }

    // Get commit hash
    let commit_hash = git_output(&["rev-parse", "--short", "HEAD"], cwd).ok();

    // Push if requested
    if do_push {
        match git_cmd(&["push"], cwd) {
            Ok(output) => {
                if output.status.success() {
                    GitSyncResult {
                        success: true,
                        committed: true,
                        pushed: true,
                        commit_hash,
                        files_committed,
                        message: format!(
                            "Committed and pushed {} file{}.",
                            files_committed,
                            if files_committed == 1 { "" } else { "s" }
                        ),
                        error: None,
                        error_detail: None,
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

                    // Detect common push errors
                    let friendly = if stderr.contains("Authentication") || stderr.contains("could not read Username") || stderr.contains("Permission denied") {
                        "Git could not authenticate with the remote. Check your Git credentials or try pushing from your terminal.".to_string()
                    } else if stderr.contains("rejected") || stderr.contains("non-fast-forward") {
                        "Push was rejected. Your branch may be behind the remote. Pull changes from your Git client first.".to_string()
                    } else if stderr.contains("Could not resolve host") || stderr.contains("unable to access") {
                        "Could not connect to the remote. Check your internet connection.".to_string()
                    } else {
                        format!("Push failed: {}", stderr)
                    };

                    GitSyncResult {
                        success: false,
                        committed: true,
                        pushed: false,
                        commit_hash,
                        files_committed,
                        message: format!("Committed {} file{} but push failed.", files_committed, if files_committed == 1 { "" } else { "s" }),
                        error: Some(friendly),
                        error_detail: Some(stderr),
                    }
                }
            }
            Err(e) => {
                GitSyncResult {
                    success: false,
                    committed: true,
                    pushed: false,
                    commit_hash,
                    files_committed,
                    message: format!("Committed {} file{} but could not push.", files_committed, if files_committed == 1 { "" } else { "s" }),
                    error: Some("Failed to run git push.".to_string()),
                    error_detail: Some(e.to_string()),
                }
            }
        }
    } else {
        GitSyncResult {
            success: true,
            committed: true,
            pushed: false,
            commit_hash,
            files_committed,
            message: format!(
                "Committed {} file{}.",
                files_committed,
                if files_committed == 1 { "" } else { "s" }
            ),
            error: None,
            error_detail: None,
        }
    }
}

#[tauri::command]
pub fn git_check_gitignore(project_root: String) -> GitIgnoreSuggestion {
    let gitignore_path = std::path::Path::new(&project_root).join(".gitignore");
    let has_gitignore = gitignore_path.exists();

    let existing_content = if has_gitignore {
        std::fs::read_to_string(&gitignore_path).unwrap_or_default()
    } else {
        String::new()
    };

    let recommended = vec![
        "site/",
        ".mklume/backups/",
        ".mklume/recovery/",
        "__pycache__/",
        ".venv/",
        "venv/",
    ];

    let missing: Vec<String> = recommended
        .iter()
        .filter(|entry| {
            !existing_content
                .lines()
                .any(|line| line.trim() == **entry)
        })
        .map(|s| s.to_string())
        .collect();

    let suggested_content = if has_gitignore {
        let mut content = existing_content.clone();
        if !missing.is_empty() {
            if !content.ends_with('\n') {
                content.push('\n');
            }
            content.push_str("\n# MkLume recommended\n");
            for entry in &missing {
                content.push_str(entry);
                content.push('\n');
            }
        }
        content
    } else {
        format!(
            "# MkDocs build output\nsite/\n\n# MkLume data\n.mklume/backups/\n.mklume/recovery/\n\n# Python\n__pycache__/\n.venv/\nvenv/\n"
        )
    };

    GitIgnoreSuggestion {
        has_gitignore,
        missing_entries: missing,
        suggested_content,
    }
}

#[tauri::command]
pub fn git_write_gitignore(project_root: String, content: String) -> Result<(), String> {
    let path = std::path::Path::new(&project_root).join(".gitignore");
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write .gitignore: {}", e))
}
