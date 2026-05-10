// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

//! MkDocs build and preview server management.
//! Uses the bundled mkdocs-runner sidecar so normal installer users
//! do not need to install Python or MkDocs manually.
//! The sidecar is spawned as a child process and its output is
//! streamed back to the frontend via Tauri events.

use serde::{Deserialize, Serialize};
use std::io::{BufRead, Write};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// ── State ────────────────────────────────────────────────

pub struct ServeState(Mutex<Option<ServeProcess>>);

impl ServeState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

struct ServeProcess {
    child: Child,
    #[allow(dead_code)]
    pid: u32,
}

// ── Event payload ────────────────────────────────────────

#[derive(Serialize, Clone)]
struct OutputLine {
    line: String,
    stream: String,
}

// ── Helpers ──────────────────────────────────────────────

/// Resolve the path to the bundled mkdocs-runner sidecar.
/// In production, the sidecar is placed next to the app executable.
/// In development, it lives at src-tauri/binaries/.
fn resolve_sidecar() -> std::path::PathBuf {
    // First try: next to the current executable (production install)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let sidecar = if cfg!(windows) {
                exe_dir.join("mkdocs-runner-x86_64-pc-windows-msvc.exe")
            } else if cfg!(target_os = "macos") {
                exe_dir.join("mkdocs-runner-aarch64-apple-darwin")
            } else {
                exe_dir.join("mkdocs-runner-x86_64-unknown-linux-gnu")
            };
            if sidecar.exists() {
                return sidecar;
            }
        }
    }

    // Fallback: relative to workspace (development)
    let dev_path = if cfg!(windows) {
        std::path::PathBuf::from("binaries/mkdocs-runner-x86_64-pc-windows-msvc.exe")
    } else {
        std::path::PathBuf::from("binaries/mkdocs-runner")
    };

    // Try from src-tauri/ directory
    let src_tauri_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(&dev_path);
    if src_tauri_path.exists() {
        return src_tauri_path;
    }

    dev_path
}

/// Build a Command that invokes the bundled mkdocs-runner sidecar.
fn mkdocs_cmd(args: &[&str]) -> Command {
    let sidecar = resolve_sidecar();
    let mut cmd = Command::new(&sidecar);
    for a in args {
        cmd.arg(a);
    }
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

// ── Commands ─────────────────────────────────────────────

#[tauri::command]
pub fn check_mkdocs() -> Result<String, String> {
    let output = mkdocs_cmd(&["version"]).output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let version = if stdout.is_empty() { stderr } else { stdout };
            Ok(version)
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            Err(format!("MkDocs runtime returned an error:\n{}", err))
        }
        Err(_) => Err(
            "MkLume's bundled MkDocs runtime could not be started.\n\n\
             Try reinstalling MkLume, or report the issue at:\n\
             https://github.com/ECalStudios/mklume/issues"
                .to_string(),
        ),
    }
}

#[tauri::command]
pub fn build_site(project_root: String) -> Result<String, String> {
    let output = mkdocs_cmd(&["build"])
        .current_dir(&project_root)
        .output()
        .map_err(|e| format!("Failed to run mkdocs build:\n{}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr).trim().to_string();

    if output.status.success() {
        Ok(combined)
    } else {
        Err(combined)
    }
}

#[tauri::command]
pub fn start_serve(
    app: tauri::AppHandle,
    state: tauri::State<'_, ServeState>,
    project_root: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "State lock failed".to_string())?;

    if guard.is_some() {
        return Err("Preview server is already running.".to_string());
    }

    // Spawn mkdocs-runner serve using the bundled sidecar.
    let mut child = {
        let sidecar = resolve_sidecar();
        let mut cmd = Command::new(&sidecar);
        cmd.arg("serve")
            .current_dir(&project_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        cmd.spawn().map_err(|e| {
            format!(
                "Failed to start MkDocs preview server:\n{}\n\n\
                 Try reinstalling MkLume, or report the issue at:\n\
                 https://github.com/ECalStudios/mklume/issues",
                e
            )
        })?
    };

    let pid = child.id();

    // Emit start event
    let _ = app.emit(
        "serve-output",
        OutputLine {
            line: format!("▸ Server starting (PID {})…", pid),
            stream: "system".to_string(),
        },
    );

    // Read stderr in a background thread (mkdocs serve outputs here)
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let _ = app_clone.emit(
                            "serve-output",
                            OutputLine {
                                line: text,
                                stream: "stderr".to_string(),
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
            let _ = app_clone.emit(
                "serve-output",
                OutputLine {
                    line: "▸ Server process ended.".to_string(),
                    stream: "system".to_string(),
                },
            );
        });
    }

    // Read stdout too (some info may go here)
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let _ = app_clone.emit(
                            "serve-output",
                            OutputLine {
                                line: text,
                                stream: "stdout".to_string(),
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });
    }

    *guard = Some(ServeProcess { child, pid });
    Ok(())
}

#[tauri::command]
pub fn stop_serve(state: tauri::State<'_, ServeState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "State lock failed".to_string())?;

    if let Some(mut proc) = guard.take() {
        // On Windows, use taskkill to kill the process tree
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/f", "/t", "/pid", &proc.pid.to_string()])
                .creation_flags(0x08000000)
                .output();
        }

        // On all platforms, also call kill on the child handle
        let _ = proc.child.kill();
        let _ = proc.child.wait();
        Ok(())
    } else {
        Err("No preview server is running.".to_string())
    }
}

#[tauri::command]
pub fn is_serve_running(state: tauri::State<'_, ServeState>) -> bool {
    let guard = state.0.lock();
    match guard {
        Ok(g) => g.is_some(),
        Err(_) => false,
    }
}

// ── Build Export ────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct BuildExportResult {
    pub success: bool,
    pub site_dir: Option<String>,
    pub zip_path: Option<String>,
    pub zip_size: Option<u64>,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub enum BuildOutputMode {
    Folder,
    Zip,
    Both,
}

/// Detect the configured site_dir from mkdocs.yml, defaulting to "site".
fn detect_site_dir(project_root: &str) -> String {
    let yml = std::path::Path::new(project_root).join("mkdocs.yml");
    let yaml = std::path::Path::new(project_root).join("mkdocs.yaml");
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

/// Create a ZIP archive from a directory.
fn create_zip_from_dir(source_dir: &Path, zip_path: &Path) -> Result<u64, String> {
    let file = std::fs::File::create(zip_path)
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let walkdir = walkdir::WalkDir::new(source_dir);

    for entry in walkdir.into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let rel = path
            .strip_prefix(source_dir)
            .map_err(|e| format!("Path error: {}", e))?;

        // Skip the root directory itself
        if rel.as_os_str().is_empty() {
            continue;
        }

        let rel_str = rel.to_string_lossy().replace('\\', "/");

        if path.is_dir() {
            zip.add_directory(&format!("{}/", rel_str), options)
                .map_err(|e| format!("ZIP add dir error: {}", e))?;
        } else {
            zip.start_file(&rel_str, options)
                .map_err(|e| format!("ZIP start file error: {}", e))?;
            let data = std::fs::read(path)
                .map_err(|e| format!("Read file error: {}", e))?;
            zip.write_all(&data)
                .map_err(|e| format!("ZIP write error: {}", e))?;
        }
    }

    zip.finish().map_err(|e| format!("ZIP finish error: {}", e))?;

    let meta = std::fs::metadata(zip_path)
        .map_err(|e| format!("ZIP metadata error: {}", e))?;
    Ok(meta.len())
}

#[tauri::command]
pub fn build_site_export(
    project_root: String,
    mode: BuildOutputMode,
) -> BuildExportResult {
    // 1. Run mkdocs build
    let build_output = mkdocs_cmd(&["build"])
        .current_dir(&project_root)
        .output();

    match build_output {
        Ok(output) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let combined = if stderr.is_empty() { stdout } else { stderr };
                return BuildExportResult {
                    success: false,
                    site_dir: None,
                    zip_path: None,
                    zip_size: None,
                    message: String::new(),
                    error: Some(format!("MkDocs build failed:\n{}", combined)),
                };
            }
        }
        Err(e) => {
            return BuildExportResult {
                success: false,
                site_dir: None,
                zip_path: None,
                zip_size: None,
                message: String::new(),
                error: Some(format!(
                    "Failed to run MkDocs build: {}\n\n\
                     Try reinstalling MkLume, or report the issue at:\n\
                     https://github.com/ECalStudios/mklume/issues",
                    e
                )),
            };
        }
    }

    let site_dir_name = detect_site_dir(&project_root);
    let site_dir = std::path::Path::new(&project_root).join(&site_dir_name);

    if !site_dir.exists() {
        return BuildExportResult {
            success: false,
            site_dir: None,
            zip_path: None,
            zip_size: None,
            message: String::new(),
            error: Some(format!(
                "Build completed but site directory '{}' was not found.",
                site_dir_name
            )),
        };
    }

    let site_dir_str = site_dir.to_string_lossy().to_string();

    match mode {
        BuildOutputMode::Folder => {
            BuildExportResult {
                success: true,
                site_dir: Some(site_dir_str),
                zip_path: None,
                zip_size: None,
                message: "Site built successfully.".to_string(),
                error: None,
            }
        }
        BuildOutputMode::Zip | BuildOutputMode::Both => {
            // Create dist/ directory
            let dist_dir = std::path::Path::new(&project_root).join("dist");
            if let Err(e) = std::fs::create_dir_all(&dist_dir) {
                return BuildExportResult {
                    success: false,
                    site_dir: Some(site_dir_str),
                    zip_path: None,
                    zip_size: None,
                    message: String::new(),
                    error: Some(format!("Failed to create dist/ directory: {}", e)),
                };
            }

            let zip_path = dist_dir.join("mklume-site.zip");

            match create_zip_from_dir(&site_dir, &zip_path) {
                Ok(size) => {
                    let zip_str = zip_path.to_string_lossy().to_string();
                    let keep_folder = matches!(mode, BuildOutputMode::Both);

                    // For ZIP-only mode, we could remove the site dir,
                    // but it's safer to keep it and let the user decide.
                    BuildExportResult {
                        success: true,
                        site_dir: if keep_folder || matches!(mode, BuildOutputMode::Zip) {
                            Some(site_dir_str)
                        } else {
                            None
                        },
                        zip_path: Some(zip_str),
                        zip_size: Some(size),
                        message: if keep_folder {
                            "Site built and ZIP created.".to_string()
                        } else {
                            "Site built and ZIP created.".to_string()
                        },
                        error: None,
                    }
                }
                Err(e) => {
                    BuildExportResult {
                        success: false,
                        site_dir: Some(site_dir_str),
                        zip_path: None,
                        zip_size: None,
                        message: "Build succeeded but ZIP creation failed.".to_string(),
                        error: Some(e),
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn get_site_dir(project_root: String) -> String {
    detect_site_dir(&project_root)
}
