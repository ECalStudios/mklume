// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const SETTINGS_FILE: &str = "settings.json";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    // General
    pub start_behavior: String, // "welcome" | "reopen"
    #[serde(default = "default_theme")]
    pub theme: String, // "dark" | "light" | "system"

    // Editor
    pub editor_font_size: u32,
    pub word_wrap: bool,
    pub autosave: bool,
    pub autosave_delay_secs: u32,

    // MkDocs
    pub python_command: String,
    pub mkdocs_command: String,

    // Safety
    pub backup_before_save: bool,
    #[serde(default = "default_true")]
    pub recovery_drafts: bool,
    pub warn_before_delete: bool,
    pub warn_before_remove_recent: bool,
    pub confirm_overwrite: bool,
    #[serde(default = "default_true")]
    pub warn_before_page_switch: bool,
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            start_behavior: "welcome".to_string(),
            theme: default_theme(),
            editor_font_size: 13,
            word_wrap: true,
            autosave: false,
            autosave_delay_secs: 5,
            python_command: "python".to_string(),
            mkdocs_command: "mkdocs".to_string(),
            backup_before_save: true,
            recovery_drafts: true,
            warn_before_delete: true,
            warn_before_remove_recent: false,
            confirm_overwrite: false,
            warn_before_page_switch: true,
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {}", e))?;
    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Could not create app data directory: {}", e))?;
    }
    Ok(data_dir.join(SETTINGS_FILE))
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> AppSettings {
    let path = match settings_path(&app) {
        Ok(p) => p,
        Err(_) => return AppSettings::default(),
    };
    if !path.exists() {
        return AppSettings::default();
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return AppSettings::default(),
    };
    serde_json::from_str(&content).unwrap_or_default()
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Could not serialize settings: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Could not save settings: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn test_mkdocs_command(command: String) -> Result<String, String> {
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Command is empty.".to_string());
    }

    let mut cmd = std::process::Command::new(parts[0]);
    for part in &parts[1..] {
        cmd.arg(part);
    }
    cmd.arg("--version");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    // If the command starts with "python", we need shell wrapping on Windows
    if cfg!(windows) && (parts[0] == "python" || parts[0] == "py") {
        let full = format!("{} --version", command);
        let mut shell_cmd = std::process::Command::new("cmd");
        shell_cmd.arg("/c").arg(&full);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            shell_cmd.creation_flags(0x08000000);
        }
        return match shell_cmd.output() {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                Ok(if stdout.is_empty() { stderr } else { stdout })
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
                Err(if err.is_empty() {
                    "Command returned an error.".to_string()
                } else {
                    err
                })
            }
            Err(_) => Err(format!("Could not run '{}'. Is it installed and in PATH?", command)),
        };
    }

    // For non-python commands, also wrap in shell on Windows
    if cfg!(windows) {
        let full = format!("{} --version", command);
        let mut shell_cmd = std::process::Command::new("cmd");
        shell_cmd.arg("/c").arg(&full);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            shell_cmd.creation_flags(0x08000000);
        }
        cmd = shell_cmd;
    }

    match cmd.output() {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            Ok(if stdout.is_empty() { stderr } else { stdout })
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            Err(if err.is_empty() {
                "Command returned an error.".to_string()
            } else {
                err
            })
        }
        Err(_) => Err(format!(
            "Could not run '{}'. Is it installed and in PATH?",
            command
        )),
    }
}

// ── Backup & Recovery ───────────────────────────────────
// Backups: timestamped copies stored in .mklume/backups/ (one per save).
// Recovery drafts: auto-saved working copies in .mklume/recovery/
// that survive crashes. Checked on file open and offered to the user.

#[tauri::command]
pub fn create_backup(file_path: String, project_root: String) -> Result<String, String> {
    let src = PathBuf::from(&file_path);
    if !src.exists() {
        return Err("File does not exist.".to_string());
    }

    let backup_dir = PathBuf::from(&project_root).join(".mklume").join("backups");
    if !backup_dir.exists() {
        std::fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Could not create backup directory: {}", e))?;
    }

    let filename = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown.md".to_string());

    let now = chrono_timestamp();
    let stem = filename.strip_suffix(".md").unwrap_or(&filename);
    let backup_name = format!("{}.{}.md", stem, now);
    let backup_path = backup_dir.join(&backup_name);

    std::fs::copy(&src, &backup_path)
        .map_err(|e| format!("Could not create backup: {}", e))?;

    Ok(backup_path.to_string_lossy().to_string())
}

fn chrono_timestamp() -> String {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    // Format as YYYYMMDD-HHMMSS (approximate from epoch)
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Approximate date from days since epoch (1970-01-01)
    let (year, month, day) = days_to_date(days);
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        year, month, day, hours, minutes, seconds
    )
}

fn days_to_date(days_since_epoch: u64) -> (u64, u64, u64) {
    // Civil days algorithm
    let z = days_since_epoch + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    (year, m, d)
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── Recovery Drafts ────────────────────────────────────

fn recovery_dir(project_root: &str) -> PathBuf {
    PathBuf::from(project_root).join(".mklume").join("recovery")
}

fn recovery_key(file_path: &str) -> String {
    let hash = file_path
        .bytes()
        .fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64));
    format!("{:016x}", hash)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryDraft {
    pub file_path: String,
    pub content: String,
    pub timestamp: u64,
}

#[tauri::command]
pub fn write_recovery_draft(
    project_root: String,
    file_path: String,
    content: String,
) -> Result<(), String> {
    let dir = recovery_dir(&project_root);
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Could not create recovery directory: {}", e))?;
    }

    let key = recovery_key(&file_path);
    let draft_path = dir.join(format!("{}.json", key));

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let draft = RecoveryDraft {
        file_path,
        content,
        timestamp: ts,
    };
    let json = serde_json::to_string(&draft)
        .map_err(|e| format!("Could not serialize recovery draft: {}", e))?;
    std::fs::write(&draft_path, json)
        .map_err(|e| format!("Could not write recovery draft: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn check_recovery_draft(
    project_root: String,
    file_path: String,
) -> Option<RecoveryDraft> {
    let dir = recovery_dir(&project_root);
    let key = recovery_key(&file_path);
    let draft_path = dir.join(format!("{}.json", key));
    if !draft_path.exists() {
        return None;
    }
    let json = std::fs::read_to_string(&draft_path).ok()?;
    let draft: RecoveryDraft = serde_json::from_str(&json).ok()?;

    // Compare: recovery draft must be for the same file
    if draft.file_path != file_path {
        return None;
    }

    // Check if the saved file's modification time is older than the draft
    let src = PathBuf::from(&file_path);
    if let Ok(meta) = src.metadata() {
        if let Ok(modified) = meta.modified() {
            let file_ts = modified
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            if draft.timestamp > file_ts {
                return Some(draft);
            }
        }
    }

    // Draft is not newer — clean it up
    let _ = std::fs::remove_file(&draft_path);
    None
}

#[tauri::command]
pub fn delete_recovery_draft(
    project_root: String,
    file_path: String,
) -> Result<(), String> {
    let dir = recovery_dir(&project_root);
    let key = recovery_key(&file_path);
    let draft_path = dir.join(format!("{}.json", key));
    if draft_path.exists() {
        std::fs::remove_file(&draft_path)
            .map_err(|e| format!("Could not delete recovery draft: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn clear_recovery_drafts(project_root: String) -> Result<u32, String> {
    let dir = recovery_dir(&project_root);
    if !dir.exists() {
        return Ok(0);
    }
    let mut count = 0u32;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|e| e.to_str()) == Some("json") {
                if std::fs::remove_file(entry.path()).is_ok() {
                    count += 1;
                }
            }
        }
    }
    Ok(count)
}

#[tauri::command]
pub fn open_url_in_browser(url: String) -> Result<(), String> {
    if url.is_empty() {
        return Err("No URL provided.".to_string());
    }
    // Basic validation: must start with http:// or https://
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/c", "start", "", &url]);
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
        cmd.spawn().map_err(|e| format!("Could not open URL: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Could not open URL: {}", e))?;
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Could not open URL: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_folder_in_explorer(folder_path: String) -> Result<(), String> {
    if folder_path.is_empty() {
        return Err("No folder path provided. Open a project first.".to_string());
    }
    let path = PathBuf::from(&folder_path);
    if !path.exists() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Could not create folder: {}", e))?;
    }
    let canonical = if cfg!(windows) {
        path.to_string_lossy().replace('/', "\\")
    } else {
        path.to_string_lossy().to_string()
    };
    println!("Open folder resolved path: {}", canonical);
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("explorer");
        cmd.arg(&canonical);
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
        cmd.spawn().map_err(|e| format!("Could not open folder: {}", e))?;
    }
    #[cfg(not(windows))]
    {
        let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(opener)
            .arg(&canonical)
            .spawn()
            .map_err(|e| format!("Could not open folder: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn count_recovery_drafts(project_root: String) -> u32 {
    let dir = recovery_dir(&project_root);
    if !dir.exists() {
        return 0;
    }
    std::fs::read_dir(&dir)
        .map(|entries| {
            entries
                .flatten()
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                .count() as u32
        })
        .unwrap_or(0)
}

#[tauri::command]
pub fn count_backups(project_root: String) -> u32 {
    let dir = PathBuf::from(&project_root).join(".mklume").join("backups");
    if !dir.exists() {
        return 0;
    }
    std::fs::read_dir(&dir)
        .map(|entries| entries.flatten().count() as u32)
        .unwrap_or(0)
}
