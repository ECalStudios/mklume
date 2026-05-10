use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const MAX_RECENT: usize = 10;
const RECENT_FILE: &str = "recent-projects.json";

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentProject {
    pub name: String,
    pub root_path: String,
    pub docs_dir: String,
    pub config_path: String,
    pub last_opened: String,
    pub last_page: Option<String>,
}

fn recent_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {}", e))?;

    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Could not create app data directory: {}", e))?;
    }

    Ok(data_dir.join(RECENT_FILE))
}

fn load_recent(app: &tauri::AppHandle) -> Result<Vec<RecentProject>, String> {
    let path = recent_file_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Could not read recent projects: {}", e))?;
    let list: Vec<RecentProject> = serde_json::from_str(&content)
        .map_err(|e| format!("Could not parse recent projects: {}", e))?;
    Ok(list)
}

fn save_recent(app: &tauri::AppHandle, list: &[RecentProject]) -> Result<(), String> {
    let path = recent_file_path(app)?;
    let json = serde_json::to_string_pretty(list)
        .map_err(|e| format!("Could not serialize recent projects: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Could not save recent projects: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<RecentProject>, String> {
    load_recent(&app)
}

#[tauri::command]
pub fn add_recent_project(
    app: tauri::AppHandle,
    project: RecentProject,
) -> Result<Vec<RecentProject>, String> {
    let mut list = load_recent(&app).unwrap_or_default();

    // Remove any existing entry with the same root path (avoids duplicates)
    list.retain(|p| p.root_path != project.root_path);

    // Insert at the front (most recent first)
    list.insert(0, project);

    // Trim to max
    list.truncate(MAX_RECENT);

    save_recent(&app, &list)?;
    Ok(list)
}

#[tauri::command]
pub fn remove_recent_project(
    app: tauri::AppHandle,
    root_path: String,
) -> Result<Vec<RecentProject>, String> {
    let mut list = load_recent(&app).unwrap_or_default();
    list.retain(|p| p.root_path != root_path);
    save_recent(&app, &list)?;
    Ok(list)
}

#[tauri::command]
pub fn clear_recent_projects(app: tauri::AppHandle) -> Result<Vec<RecentProject>, String> {
    let empty: Vec<RecentProject> = Vec::new();
    save_recent(&app, &empty)?;
    Ok(empty)
}
