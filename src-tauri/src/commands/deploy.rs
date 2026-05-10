// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

//! GitHub Pages Deploy Assistant.
//! Generates workflow and config files for GitHub Pages deployment.
//! Does NOT store tokens, credentials, or make API calls to GitHub.
//! The user reviews, commits, pushes, and enables Pages on GitHub.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// ── Types ───────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct DeployReadiness {
    pub git_installed: bool,
    pub is_repo: bool,
    pub has_remote: bool,
    pub remote_url: Option<String>,
    pub is_github: bool,
    pub github_owner: Option<String>,
    pub github_repo: Option<String>,
    pub branch: Option<String>,
    pub has_workflows_dir: bool,
    pub existing_deploy_workflow: Option<String>,
    pub other_pages_workflows: Vec<String>,
    pub site_dir: String,
    pub site_url: Option<String>,
    pub has_requirements_txt: bool,
    pub has_cname: bool,
    pub cname_value: Option<String>,
    pub inferred_pages_url: Option<String>,
    pub detected_plugins: Vec<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct WorkflowOptions {
    pub branch: String,
    pub site_dir: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct DeployGenerateResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub message: String,
    pub error: Option<String>,
}

// ── Helpers ─────────────────────────────────────────────

fn git_output(args: &[&str], cwd: &str) -> Result<String, String> {
    let mut cmd = Command::new("git");
    for a in args {
        cmd.arg(a);
    }
    cmd.current_dir(cwd);

    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(stderr)
    }
}

fn is_git_installed() -> bool {
    let mut cmd = Command::new("git");
    cmd.arg("--version");

    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

/// Parse a GitHub remote URL into (owner, repo).
fn parse_github_remote(url: &str) -> Option<(String, String)> {
    // https://github.com/user/repo.git
    // git@github.com:user/repo.git
    // https://github.com/user/repo
    let trimmed = url.trim();

    if let Some(rest) = trimmed.strip_prefix("https://github.com/") {
        let cleaned = rest.trim_end_matches(".git");
        let parts: Vec<&str> = cleaned.splitn(2, '/').collect();
        if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }
    }

    if let Some(rest) = trimmed.strip_prefix("git@github.com:") {
        let cleaned = rest.trim_end_matches(".git");
        let parts: Vec<&str> = cleaned.splitn(2, '/').collect();
        if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }
    }

    None
}

/// Read site_dir from mkdocs.yml.
fn read_site_dir(project_root: &str) -> String {
    let yml = Path::new(project_root).join("mkdocs.yml");
    let yaml = Path::new(project_root).join("mkdocs.yaml");
    let config_path = if yml.exists() { yml } else { yaml };

    if let Ok(content) = std::fs::read_to_string(&config_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("site_dir:") {
                let val = rest.trim().trim_matches('"').trim_matches('\'').to_string();
                if !val.is_empty() {
                    return val;
                }
            }
        }
    }
    "site".to_string()
}

/// Read site_url from mkdocs.yml.
fn read_site_url(project_root: &str) -> Option<String> {
    let yml = Path::new(project_root).join("mkdocs.yml");
    let yaml = Path::new(project_root).join("mkdocs.yaml");
    let config_path = if yml.exists() { yml } else { yaml };

    if let Ok(content) = std::fs::read_to_string(&config_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("site_url:") {
                let val = rest.trim().trim_matches('"').trim_matches('\'').to_string();
                if !val.is_empty() {
                    return Some(val);
                }
            }
        }
    }
    None
}

/// Detect commonly used plugins from mkdocs.yml.
fn detect_plugins(project_root: &str) -> Vec<String> {
    let yml = Path::new(project_root).join("mkdocs.yml");
    let yaml = Path::new(project_root).join("mkdocs.yaml");
    let config_path = if yml.exists() { yml } else { yaml };

    let mut plugins = Vec::new();

    if let Ok(content) = std::fs::read_to_string(&config_path) {
        let known = [
            "search", "minify", "git-revision-date-localized",
            "git-revision-date", "macros", "i18n", "social",
            "tags", "blog", "rss", "glightbox", "mike",
            "awesome-pages", "redirects", "autorefs",
        ];

        for line in content.lines() {
            let trimmed = line.trim().trim_start_matches('-').trim();
            for k in &known {
                if trimmed == *k || trimmed.starts_with(&format!("{}:", k)) {
                    if !plugins.contains(&k.to_string()) {
                        plugins.push(k.to_string());
                    }
                }
            }
        }
    }

    plugins
}

/// Check for existing CNAME file in docs/.
fn read_cname(project_root: &str) -> Option<String> {
    let cname = Path::new(project_root).join("docs").join("CNAME");
    if cname.exists() {
        std::fs::read_to_string(&cname).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
    } else {
        None
    }
}

// ── Commands ────────────────────────────────────────────

#[tauri::command]
pub fn deploy_check_readiness(project_root: String) -> DeployReadiness {
    let git_installed = is_git_installed();

    if !git_installed {
        return DeployReadiness {
            git_installed: false,
            is_repo: false,
            has_remote: false,
            remote_url: None,
            is_github: false,
            github_owner: None,
            github_repo: None,
            branch: None,
            has_workflows_dir: false,
            existing_deploy_workflow: None,
            other_pages_workflows: vec![],
            site_dir: read_site_dir(&project_root),
            site_url: read_site_url(&project_root),
            has_requirements_txt: Path::new(&project_root).join("requirements.txt").exists(),
            has_cname: false,
            cname_value: None,
            inferred_pages_url: None,
            detected_plugins: vec![],
        };
    }

    let is_repo = git_output(&["rev-parse", "--show-toplevel"], &project_root).is_ok();

    if !is_repo {
        return DeployReadiness {
            git_installed: true,
            is_repo: false,
            has_remote: false,
            remote_url: None,
            is_github: false,
            github_owner: None,
            github_repo: None,
            branch: None,
            has_workflows_dir: false,
            existing_deploy_workflow: None,
            other_pages_workflows: vec![],
            site_dir: read_site_dir(&project_root),
            site_url: read_site_url(&project_root),
            has_requirements_txt: Path::new(&project_root).join("requirements.txt").exists(),
            has_cname: read_cname(&project_root).is_some(),
            cname_value: read_cname(&project_root),
            inferred_pages_url: None,
            detected_plugins: detect_plugins(&project_root),
        };
    }

    let branch = git_output(&["branch", "--show-current"], &project_root).ok();
    let remote_url = git_output(&["remote", "get-url", "origin"], &project_root).ok();

    let has_remote = remote_url.is_some();
    let (is_github, github_owner, github_repo) = if let Some(ref url) = remote_url {
        if let Some((owner, repo)) = parse_github_remote(url) {
            (true, Some(owner), Some(repo))
        } else {
            (false, None, None)
        }
    } else {
        (false, None, None)
    };

    // Infer Pages URL
    let inferred_pages_url = if let (Some(ref owner), Some(ref repo)) = (&github_owner, &github_repo) {
        let owner_lower = owner.to_lowercase();
        let repo_lower = repo.to_lowercase();
        if repo_lower == format!("{}.github.io", owner_lower) {
            Some(format!("https://{}.github.io/", owner_lower))
        } else {
            Some(format!("https://{}.github.io/{}/", owner_lower, repo))
        }
    } else {
        None
    };

    // Check for existing workflows
    let workflows_dir = Path::new(&project_root).join(".github").join("workflows");
    let has_workflows_dir = workflows_dir.exists();

    let deploy_workflow_path = workflows_dir.join("deploy-mkdocs.yml");
    let existing_deploy_workflow = if deploy_workflow_path.exists() {
        std::fs::read_to_string(&deploy_workflow_path).ok()
    } else {
        None
    };

    // Scan for other Pages-related workflow files
    let mut other_pages_workflows = Vec::new();
    if has_workflows_dir {
        if let Ok(entries) = std::fs::read_dir(&workflows_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name == "deploy-mkdocs.yml" {
                    continue;
                }
                if let Ok(content) = std::fs::read_to_string(entry.path()) {
                    let lower = content.to_lowercase();
                    if lower.contains("deploy-pages") || lower.contains("github-pages")
                        || lower.contains("upload-pages-artifact") || lower.contains("gh-pages")
                    {
                        other_pages_workflows.push(name);
                    }
                }
            }
        }
    }

    let site_dir = read_site_dir(&project_root);
    let site_url = read_site_url(&project_root);
    let has_requirements_txt = Path::new(&project_root).join("requirements.txt").exists();
    let cname_value = read_cname(&project_root);
    let has_cname = cname_value.is_some();
    let detected_plugins = detect_plugins(&project_root);

    DeployReadiness {
        git_installed,
        is_repo,
        has_remote,
        remote_url,
        is_github,
        github_owner,
        github_repo,
        branch,
        has_workflows_dir,
        existing_deploy_workflow,
        other_pages_workflows,
        site_dir,
        site_url,
        has_requirements_txt,
        has_cname,
        cname_value,
        inferred_pages_url,
        detected_plugins,
    }
}

#[tauri::command]
pub fn deploy_generate_workflow(
    project_root: String,
    options: WorkflowOptions,
) -> DeployGenerateResult {
    let branch = options.branch.trim();
    if branch.is_empty() {
        return DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some("Branch name cannot be empty.".to_string()),
        };
    }

    let site_dir = options.site_dir.trim();
    let site_dir = if site_dir.is_empty() { "site" } else { site_dir };

    let workflow = format!(
        r#"# Generated by MkLume — GitHub Pages Deploy Assistant
# This workflow builds your MkDocs site and deploys it to GitHub Pages.
# No tokens or credentials are stored in your project.
#
# After committing this file:
# 1. Push to GitHub
# 2. Go to Settings > Pages
# 3. Set "Build and deployment" source to "GitHub Actions"

name: Deploy MkDocs site to GitHub Pages

on:
  push:
    branches:
      - {branch}
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'

      - name: Install MkDocs dependencies
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then pip install -r requirements.txt; else pip install mkdocs-material; fi

      - name: Build site
        run: mkdocs build --strict

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: {site_dir}

  deploy:
    environment:
      name: github-pages
      url: ${{{{ steps.deployment.outputs.page_url }}}}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
"#,
        branch = branch,
        site_dir = site_dir,
    );

    // Create .github/workflows/ directory
    let workflows_dir = Path::new(&project_root).join(".github").join("workflows");
    if let Err(e) = std::fs::create_dir_all(&workflows_dir) {
        return DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some(format!("Failed to create .github/workflows/ directory: {}", e)),
        };
    }

    let file_path = workflows_dir.join("deploy-mkdocs.yml");
    match std::fs::write(&file_path, &workflow) {
        Ok(()) => DeployGenerateResult {
            success: true,
            file_path: Some(file_path.to_string_lossy().to_string()),
            message: "Workflow file created successfully.".to_string(),
            error: None,
        },
        Err(e) => DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some(format!("Failed to write workflow file: {}", e)),
        },
    }
}

#[tauri::command]
pub fn deploy_generate_workflow_alternate(
    project_root: String,
    options: WorkflowOptions,
) -> DeployGenerateResult {
    // Same as deploy_generate_workflow but saves as deploy-mkdocs-mklume.yml
    let branch = options.branch.trim();
    if branch.is_empty() {
        return DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some("Branch name cannot be empty.".to_string()),
        };
    }

    let site_dir = options.site_dir.trim();
    let site_dir = if site_dir.is_empty() { "site" } else { site_dir };

    let workflow = format!(
        r#"# Generated by MkLume — GitHub Pages Deploy Assistant
# This workflow builds your MkDocs site and deploys it to GitHub Pages.
# No tokens or credentials are stored in your project.
#
# After committing this file:
# 1. Push to GitHub
# 2. Go to Settings > Pages
# 3. Set "Build and deployment" source to "GitHub Actions"

name: Deploy MkDocs site to GitHub Pages

on:
  push:
    branches:
      - {branch}
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'

      - name: Install MkDocs dependencies
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then pip install -r requirements.txt; else pip install mkdocs-material; fi

      - name: Build site
        run: mkdocs build --strict

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: {site_dir}

  deploy:
    environment:
      name: github-pages
      url: ${{{{ steps.deployment.outputs.page_url }}}}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
"#,
        branch = branch,
        site_dir = site_dir,
    );

    let workflows_dir = Path::new(&project_root).join(".github").join("workflows");
    if let Err(e) = std::fs::create_dir_all(&workflows_dir) {
        return DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some(format!("Failed to create .github/workflows/ directory: {}", e)),
        };
    }

    let file_path = workflows_dir.join("deploy-mkdocs-mklume.yml");
    match std::fs::write(&file_path, &workflow) {
        Ok(()) => DeployGenerateResult {
            success: true,
            file_path: Some(file_path.to_string_lossy().to_string()),
            message: "Workflow file created as deploy-mkdocs-mklume.yml.".to_string(),
            error: None,
        },
        Err(e) => DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some(format!("Failed to write workflow file: {}", e)),
        },
    }
}

#[tauri::command]
pub fn deploy_generate_requirements(project_root: String) -> DeployGenerateResult {
    let req_path = Path::new(&project_root).join("requirements.txt");

    let content = "mkdocs-material\n";

    match std::fs::write(&req_path, content) {
        Ok(()) => DeployGenerateResult {
            success: true,
            file_path: Some(req_path.to_string_lossy().to_string()),
            message: "requirements.txt created.".to_string(),
            error: None,
        },
        Err(e) => DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some(format!("Failed to write requirements.txt: {}", e)),
        },
    }
}

#[tauri::command]
pub fn deploy_write_cname(project_root: String, domain: String) -> DeployGenerateResult {
    let domain = domain.trim().to_string();
    if domain.is_empty() {
        return DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some("Domain cannot be empty.".to_string()),
        };
    }

    let docs_dir = Path::new(&project_root).join("docs");
    if !docs_dir.exists() {
        return DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some("docs/ directory does not exist.".to_string()),
        };
    }

    let cname_path = docs_dir.join("CNAME");
    match std::fs::write(&cname_path, format!("{}\n", domain)) {
        Ok(()) => DeployGenerateResult {
            success: true,
            file_path: Some(cname_path.to_string_lossy().to_string()),
            message: format!("CNAME file created for {}", domain),
            error: None,
        },
        Err(e) => DeployGenerateResult {
            success: false,
            file_path: None,
            message: String::new(),
            error: Some(format!("Failed to write CNAME: {}", e)),
        },
    }
}

#[tauri::command]
pub fn deploy_read_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}
