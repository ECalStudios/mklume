use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;

const STATE_FILE: &str = "sidebar-state.json";

/// Map of project root path → list of collapsed group keys.
type StateMap = HashMap<String, Vec<String>>;

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {}", e))?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Could not create app data dir: {}", e))?;
    }
    Ok(dir.join(STATE_FILE))
}

fn load_map(app: &tauri::AppHandle) -> StateMap {
    let path = match state_path(app) {
        Ok(p) => p,
        Err(_) => return HashMap::new(),
    };
    if !path.exists() {
        return HashMap::new();
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_map(app: &tauri::AppHandle, map: &StateMap) -> Result<(), String> {
    let path = state_path(app)?;
    let json = serde_json::to_string(map)
        .map_err(|e| format!("Serialize error: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Could not write sidebar state: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_collapsed_groups(
    app: tauri::AppHandle,
    project_root: String,
) -> Vec<String> {
    let map = load_map(&app);
    map.get(&project_root).cloned().unwrap_or_default()
}

#[tauri::command]
pub fn save_collapsed_groups(
    app: tauri::AppHandle,
    project_root: String,
    collapsed: Vec<String>,
) -> Result<(), String> {
    let mut map = load_map(&app);
    if collapsed.is_empty() {
        map.remove(&project_root);
    } else {
        map.insert(project_root, collapsed);
    }
    save_map(&app, &map)
}
