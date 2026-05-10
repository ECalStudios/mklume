// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

mod commands;

use commands::assets;
use commands::build;
use commands::deploy;
use commands::git;
use commands::health;
use commands::project;
use commands::recent;
use commands::settings;
use commands::sidebar;
use commands::siteconfig;
use std::path::PathBuf;

fn percent_decode(input: &str) -> String {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""),
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

fn guess_mime(path: &PathBuf) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        Some("bmp") => "image/bmp",
        Some("avif") => "image/avif",
        Some("tiff") | Some("tif") => "image/tiff",
        _ => "application/octet-stream",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(build::ServeState::new())
        .invoke_handler(tauri::generate_handler![
            assets::copy_images_to_assets,
            project::open_project,
            project::read_page_content,
            project::save_page_content,
            project::create_page,
            project::rename_page,
            project::delete_page,
            project::add_to_nav,
            project::write_nav,
            project::scaffold_project,
            project::create_group,
            health::scan_project_health,
            recent::get_recent_projects,
            recent::add_recent_project,
            recent::remove_recent_project,
            recent::clear_recent_projects,
            build::check_mkdocs,
            build::build_site,
            build::start_serve,
            build::stop_serve,
            build::is_serve_running,
            build::build_site_export,
            build::get_site_dir,
            sidebar::get_collapsed_groups,
            sidebar::save_collapsed_groups,
            settings::load_settings,
            settings::save_settings,
            settings::test_mkdocs_command,
            settings::create_backup,
            settings::get_app_version,
            settings::write_recovery_draft,
            settings::check_recovery_draft,
            settings::delete_recovery_draft,
            settings::clear_recovery_drafts,
            settings::open_folder_in_explorer,
            settings::open_url_in_browser,
            settings::count_recovery_drafts,
            settings::count_backups,
            siteconfig::read_site_config,
            siteconfig::write_site_config,
            siteconfig::list_docs_pages,
            git::git_check_installed,
            git::git_get_repo_info,
            git::git_status,
            git::git_sync,
            git::git_check_gitignore,
            git::git_write_gitignore,
            deploy::deploy_check_readiness,
            deploy::deploy_generate_workflow,
            deploy::deploy_generate_workflow_alternate,
            deploy::deploy_generate_requirements,
            deploy::deploy_write_cname,
            deploy::deploy_read_file,
        ])
        .register_uri_scheme_protocol("docimg", |_app, request| {
            let raw_path = request.uri().path();
            let decoded = percent_decode(raw_path);
            let cleaned = if cfg!(windows) && decoded.len() > 2 && decoded.as_bytes()[0] == b'/' {
                &decoded[1..]
            } else {
                &decoded
            };
            let file_path = PathBuf::from(cleaned);
            match std::fs::read(&file_path) {
                Ok(bytes) => {
                    let mime = guess_mime(&file_path);
                    tauri::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(bytes)
                        .unwrap()
                }
                Err(_) => tauri::http::Response::builder()
                    .status(404)
                    .header("Content-Type", "text/plain")
                    .body(b"Not found".to_vec())
                    .unwrap(),
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running MkLume");
}
