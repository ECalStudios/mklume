// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use walkdir::WalkDir;

// ── Data Structures ──────────────────────────────────────

#[derive(Serialize)]
pub struct ProjectData {
    pub root_path: String,
    pub site_name: String,
    pub docs_dir: String,
    pub config_path: String,
    pub pages: Vec<PageEntry>,
    pub nav: Option<Vec<NavEntry>>,
}

#[derive(Serialize, Clone)]
pub struct PageEntry {
    pub title: String,
    pub file_path: String,
    pub relative_path: String,
}

#[derive(Serialize, Clone)]
pub struct NavEntry {
    pub title: String,
    pub path: Option<String>,
    pub children: Vec<NavEntry>,
}

/// Used when the frontend sends a nav tree to be written to mkdocs.yml.
#[derive(Deserialize)]
pub struct NavWriteEntry {
    pub title: String,
    pub path: Option<String>,
    pub children: Vec<NavWriteEntry>,
}

#[derive(Deserialize)]
struct MkDocsConfig {
    site_name: Option<String>,
    docs_dir: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────

fn title_from_filename(filename: &str) -> String {
    let stem = filename.trim_end_matches(".md");
    stem.replace('-', " ")
        .replace('_', " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => {
                    let upper: String = c.to_uppercase().collect();
                    upper + chars.as_str()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn title_from_path(path: &str) -> String {
    let filename = path.rsplit('/').next().unwrap_or(path);
    title_from_filename(filename)
}

fn validate_filename(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Filename cannot be empty.".to_string());
    }
    if !name.ends_with(".md") {
        return Err("Filename must end with .md".to_string());
    }
    if name.len() < 4 {
        return Err("Filename is too short.".to_string());
    }
    if name.contains('\\') || name.contains('/') {
        return Err("Filename cannot contain path separators.".to_string());
    }
    let invalid = ['<', '>', ':', '"', '|', '?', '*'];
    for c in invalid {
        if name.contains(c) {
            return Err(format!("Filename cannot contain '{}'.", c));
        }
    }
    Ok(())
}

fn name_to_filename(name: &str) -> String {
    let slug: String = name
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let mut result = String::new();
    let mut prev_dash = false;
    for c in slug.chars() {
        if c == '-' {
            if !prev_dash {
                result.push(c);
            }
            prev_dash = true;
        } else {
            result.push(c);
            prev_dash = false;
        }
    }
    let trimmed = result.trim_matches('-');
    if trimmed.is_empty() {
        "untitled.md".to_string()
    } else {
        format!("{}.md", trimmed)
    }
}

fn update_heading(content: &str, new_title: &str) -> String {
    let heading = format!("# {}", new_title);
    if content.starts_with("# ") {
        let end = content.find('\n').unwrap_or(content.len());
        return format!("{}{}", heading, &content[end..]);
    }
    if let Some(pos) = content.find("\n# ") {
        let line_start = pos + 1;
        let line_end = content[line_start..]
            .find('\n')
            .map(|p| line_start + p)
            .unwrap_or(content.len());
        return format!("{}{}{}", &content[..line_start], heading, &content[line_end..]);
    }
    format!("{}\n\n{}", heading, content)
}

fn build_page_entry(file_path: &PathBuf, docs_path: &PathBuf) -> PageEntry {
    let relative = file_path
        .strip_prefix(docs_path)
        .unwrap_or(file_path)
        .to_string_lossy()
        .replace('\\', "/");
    let filename = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    PageEntry {
        title: title_from_filename(&filename),
        file_path: file_path.to_string_lossy().to_string(),
        relative_path: relative,
    }
}

// ── Nav Parsing ──────────────────────────────────────────

/// Parse the nav section from a serde_yaml::Value tree.
fn parse_nav(val: &serde_yaml::Value) -> Option<Vec<NavEntry>> {
    let nav_val = val.get("nav")?;
    let seq = nav_val.as_sequence()?;
    if seq.is_empty() {
        return None;
    }
    Some(parse_nav_items(seq))
}

fn parse_nav_items(items: &[serde_yaml::Value]) -> Vec<NavEntry> {
    items.iter().filter_map(parse_nav_item).collect()
}

fn parse_nav_item(item: &serde_yaml::Value) -> Option<NavEntry> {
    match item {
        serde_yaml::Value::Mapping(map) => {
            let (key, val) = map.iter().next()?;
            let title = key.as_str()?.to_string();
            match val {
                serde_yaml::Value::String(path) => Some(NavEntry {
                    title,
                    path: Some(path.clone()),
                    children: vec![],
                }),
                serde_yaml::Value::Sequence(children) => Some(NavEntry {
                    title,
                    path: None,
                    children: parse_nav_items(children),
                }),
                _ => None,
            }
        }
        serde_yaml::Value::String(path) => Some(NavEntry {
            title: title_from_path(path),
            path: Some(path.clone()),
            children: vec![],
        }),
        _ => None,
    }
}

// ── Nav Writing (string-safe) ────────────────────────────

/// Quote a YAML title if it contains characters that need escaping.
fn yaml_safe_title(title: &str) -> String {
    let needs_quoting = title.contains(':')
        || title.contains('#')
        || title.contains('"')
        || title.contains('\'')
        || title.starts_with('-')
        || title.starts_with('{')
        || title.starts_with('[')
        || title.starts_with('*')
        || title.starts_with('&')
        || title.starts_with('!')
        || title.starts_with('?')
        || title.starts_with('|')
        || title.starts_with('>');
    if needs_quoting {
        format!("'{}'", title.replace('\'', "''"))
    } else {
        title.to_string()
    }
}

/// Build the YAML text for a nav section from structured entries.
fn generate_nav_yaml(entries: &[NavWriteEntry]) -> String {
    let mut lines = vec!["nav:".to_string()];
    for entry in entries {
        append_nav_yaml_entry(&mut lines, entry, 2);
    }
    lines.join("\n")
}

fn append_nav_yaml_entry(lines: &mut Vec<String>, entry: &NavWriteEntry, indent: usize) {
    let prefix = " ".repeat(indent);
    let title = yaml_safe_title(&entry.title);
    if let Some(ref path) = entry.path {
        lines.push(format!("{}- {}: {}", prefix, title, path));
    } else {
        lines.push(format!("{}- {}:", prefix, title));
        for child in &entry.children {
            append_nav_yaml_entry(lines, child, indent + 4);
        }
    }
}

/// Find the start line and end line (exclusive) of the nav section.
fn find_nav_bounds(lines: &[&str]) -> Option<(usize, usize)> {
    let start = lines.iter().position(|line| {
        let trimmed = line.trim();
        (trimmed == "nav:" || trimmed.starts_with("nav:"))
            && !trimmed.starts_with("nav_")
    })?;

    let mut end = lines.len();
    for i in (start + 1)..lines.len() {
        let line = lines[i];
        if line.trim().is_empty() {
            continue;
        }
        if !line.starts_with(' ') && !line.starts_with('\t') {
            end = i;
            break;
        }
    }
    Some((start, end))
}

/// Replace the nav section in a YAML string, preserving everything else.
fn replace_nav_section(yaml: &str, new_nav_yaml: &str) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };

    if let Some((start, end)) = find_nav_bounds(&lines) {
        let mut result: Vec<String> = lines[..start].iter().map(|s| s.to_string()).collect();
        for nav_line in new_nav_yaml.lines() {
            result.push(nav_line.to_string());
        }
        for line in &lines[end..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else {
        // No existing nav section — append
        format!("{}\n\n{}\n", yaml.trim_end(), new_nav_yaml)
    }
}

/// Append a single entry to the nav section (used by create-page).
fn append_to_nav_string(yaml: &str, title: &str, rel_path: &str) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };
    let safe_title = yaml_safe_title(title);
    let new_entry = format!("  - {}: {}", safe_title, rel_path);

    if let Some((_, end)) = find_nav_bounds(&lines) {
        let mut result: Vec<String> = lines[..end].iter().map(|s| s.to_string()).collect();
        result.push(new_entry);
        for line in &lines[end..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else {
        format!("{}\n\nnav:\n{}\n", yaml.trim_end(), new_entry)
    }
}

// ── Commands ─────────────────────────────────────────────

#[tauri::command]
pub fn open_project(path: String) -> Result<ProjectData, String> {
    let root = PathBuf::from(&path);

    let config_path = if root.join("mkdocs.yml").exists() {
        root.join("mkdocs.yml")
    } else if root.join("mkdocs.yaml").exists() {
        root.join("mkdocs.yaml")
    } else {
        return Err(
            "This folder does not contain an mkdocs.yml file.\n\
             Please select a folder that contains an MkDocs project."
                .to_string(),
        );
    };

    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Could not read {}: {}", config_path.display(), e))?;

    // Parse with serde_yaml for structured access
    let config: MkDocsConfig = serde_yaml::from_str(&config_content)
        .map_err(|e| format!("Could not parse mkdocs.yml: {}", e))?;

    // Also parse as generic Value to read nav
    let full_value: serde_yaml::Value = serde_yaml::from_str(&config_content)
        .unwrap_or(serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));

    let nav = parse_nav(&full_value);

    let site_name = config
        .site_name
        .unwrap_or_else(|| "Untitled Project".to_string());

    let docs_dir_name = config.docs_dir.unwrap_or_else(|| "docs".to_string());
    let docs_path = root.join(&docs_dir_name);

    if !docs_path.exists() || !docs_path.is_dir() {
        return Err(format!(
            "The \"{}\" directory was not found in this project.\n\
             Make sure your MkDocs project has a docs folder.",
            docs_dir_name
        ));
    }

    let mut pages: Vec<PageEntry> = Vec::new();
    for entry in WalkDir::new(&docs_path)
        .sort_by_file_name()
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }
        let ext = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase());
        if ext.as_deref() != Some("md") {
            continue;
        }
        pages.push(build_page_entry(&entry_path.to_path_buf(), &docs_path));
    }

    if pages.is_empty() {
        return Err(
            "No Markdown files (.md) were found in the docs folder.\n\
             Add at least one .md file to get started."
                .to_string(),
        );
    }

    Ok(ProjectData {
        root_path: path,
        site_name,
        docs_dir: docs_path.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        pages,
        nav,
    })
}

#[tauri::command]
pub fn read_page_content(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Could not read file: {}", e))
}

#[tauri::command]
pub fn save_page_content(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Could not save file: {}", e))
}

#[tauri::command]
pub fn create_page(
    docs_dir: String,
    folder: String,
    filename: String,
    title: String,
) -> Result<PageEntry, String> {
    validate_filename(&filename)?;
    let docs_path = PathBuf::from(&docs_dir);
    if !docs_path.exists() {
        return Err("The docs directory no longer exists.".to_string());
    }
    let target_dir = if folder.is_empty() {
        docs_path.clone()
    } else {
        docs_path.join(&folder)
    };
    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Could not create folder \"{}\": {}", folder, e))?;
    }
    let file_path = target_dir.join(&filename);
    if file_path.exists() {
        return Err(format!(
            "A file named \"{}\" already exists in this location.",
            filename
        ));
    }
    let content = format!("# {}\n\n", title);
    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Could not create file: {}", e))?;
    Ok(build_page_entry(&file_path, &docs_path))
}

#[tauri::command]
pub fn rename_page(
    file_path: String,
    docs_dir: String,
    new_name: String,
    do_update_heading: bool,
) -> Result<PageEntry, String> {
    let path = PathBuf::from(&file_path);
    let docs_path = PathBuf::from(&docs_dir);
    if !path.exists() {
        return Err("The file no longer exists.".to_string());
    }
    if do_update_heading {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Could not read file: {}", e))?;
        let updated = update_heading(&content, &new_name);
        std::fs::write(&path, &updated)
            .map_err(|e| format!("Could not update file: {}", e))?;
    }
    let new_filename = name_to_filename(&new_name);
    let new_path = path.with_file_name(&new_filename);
    if new_path != path {
        if new_path.exists() {
            return Err(format!("A file named \"{}\" already exists.", new_filename));
        }
        std::fs::rename(&path, &new_path)
            .map_err(|e| format!("Could not rename file: {}", e))?;
    }
    Ok(build_page_entry(&new_path, &docs_path))
}

#[tauri::command]
pub fn delete_page(file_path: String, project_root: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err("The file no longer exists.".to_string());
    }
    let trash_dir = PathBuf::from(&project_root).join(".mklume-trash");
    if !trash_dir.exists() {
        std::fs::create_dir_all(&trash_dir)
            .map_err(|e| format!("Could not create trash folder: {}", e))?;
    }
    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown.md".to_string());
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let trash_path = trash_dir.join(format!("{}_{}", timestamp, filename));
    std::fs::rename(&path, &trash_path).map_err(|e| {
        format!("Could not move file to trash: {}", e)
    })?;
    Ok(())
}

/// Add a page entry to the nav section in mkdocs.yml using safe string
/// manipulation that preserves comments and other config fields.
#[tauri::command]
pub fn add_to_nav(
    config_path: String,
    title: String,
    relative_path: String,
) -> Result<(), String> {
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Could not read config: {}", e))?;

    let updated = append_to_nav_string(&content, &title, &relative_path);

    // Validate the result is still valid YAML before writing
    let _check: serde_yaml::Value = serde_yaml::from_str(&updated)
        .map_err(|e| format!("Navigation update produced invalid YAML: {}", e))?;

    std::fs::write(&config_path, &updated)
        .map_err(|e| format!("Could not write config: {}", e))?;

    Ok(())
}

/// Write a complete nav structure to mkdocs.yml, replacing the existing nav
/// section. Preserves all other config fields. Validates YAML before saving.
#[tauri::command]
pub fn write_nav(config_path: String, nav: Vec<NavWriteEntry>) -> Result<(), String> {
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Could not read config: {}", e))?;

    let updated = if nav.is_empty() {
        // Remove the nav section entirely
        let lines: Vec<&str> = content.lines().collect();
        let trailing = if content.ends_with('\n') { "\n" } else { "" };
        if let Some((start, end)) = find_nav_bounds(&lines) {
            let mut result: Vec<String> = lines[..start].iter().map(|s| s.to_string()).collect();
            for line in &lines[end..] {
                result.push(line.to_string());
            }
            result.join("\n") + trailing
        } else {
            content.clone()
        }
    } else {
        let nav_yaml = generate_nav_yaml(&nav);
        replace_nav_section(&content, &nav_yaml)
    };

    let _check: serde_yaml::Value = serde_yaml::from_str(&updated)
        .map_err(|e| format!("Navigation update produced invalid YAML: {}", e))?;

    std::fs::write(&config_path, &updated)
        .map_err(|e| format!("Could not write config: {}", e))?;

    Ok(())
}

/// Scaffold a brand-new MkDocs Material project.
#[tauri::command]
pub fn scaffold_project(
    parent_dir: String,
    folder_name: String,
    site_name: String,
    site_description: String,
    mklume_credit: bool,
) -> Result<String, String> {
    if folder_name.trim().is_empty() {
        return Err("Folder name cannot be empty.".to_string());
    }
    let invalid = ['<', '>', ':', '"', '|', '?', '*'];
    for c in &invalid {
        if folder_name.contains(*c) {
            return Err(format!("Folder name cannot contain '{}'.", c));
        }
    }

    let project_root = PathBuf::from(&parent_dir).join(&folder_name);

    if project_root.join("mkdocs.yml").exists() || project_root.join("mkdocs.yaml").exists() {
        return Err(
            "This folder already contains an MkDocs project.\n\
             Choose a different name or location."
                .to_string(),
        );
    }

    let docs_dir = project_root.join("docs");
    let assets_dir = docs_dir.join("assets");
    std::fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Could not create project folders: {}", e))?;

    // ── mkdocs.yml ───────────────────────────────────────

    let name = site_name.trim();
    let desc_block = if site_description.trim().is_empty() {
        String::new()
    } else {
        format!("site_description: {}\n", site_description.trim())
    };

    // Build optional credit sections
    let credit_block = if mklume_credit {
        "copyright: >-\n  Built with <a href=\"https://github.com/ecalstudios/mklume\">MkLume</a>\n".to_string()
    } else {
        String::new()
    };
    let extra_block = if mklume_credit {
        "\nextra:\n  mklume_credit: true\n".to_string()
    } else {
        String::new()
    };

    let yml = format!(
        "\
site_name: {name}
{desc}\
{credit}\
theme:
  name: material
  palette:
    scheme: default
    primary: indigo
    accent: indigo
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - content.code.copy

nav:
  - Home: index.md
  - Getting Started: getting-started.md

markdown_extensions:
  - admonition
  - pymdownx.details
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - tables
  - attr_list
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.inlinehilite
{extra}",
        name = name,
        desc = desc_block,
        credit = credit_block,
        extra = extra_block,
    );

    std::fs::write(project_root.join("mkdocs.yml"), &yml)
        .map_err(|e| format!("Could not write mkdocs.yml: {}", e))?;

    // ── docs/index.md ────────────────────────────────────

    let index = format!(
        "\
# {name}

Welcome to **{name}**!

This documentation site was created with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/).

## Overview

Describe your project here.

## Quick Links

- [Getting Started](getting-started.md) — Set up and start using the project.

!!! tip \"Tip\"
    Edit this page in MkLume to customize your documentation.
",
        name = name,
    );

    std::fs::write(docs_dir.join("index.md"), &index)
        .map_err(|e| format!("Could not write index.md: {}", e))?;

    // ── docs/getting-started.md ──────────────────────────

    let guide = format!(
        "\
# Getting Started

This guide will help you get started with **{name}**.

## Prerequisites

List any requirements here.

## Installation

Describe installation steps here.

```bash
# Example install command
pip install mkdocs-material
```

## Configuration

Explain any configuration steps here.

!!! info \"Note\"
    Replace this placeholder content with your actual documentation.

## Next Steps

- Add more pages to your documentation
- Customize the theme in `mkdocs.yml`
- Build and deploy your site with `mkdocs build`
",
        name = name,
    );

    std::fs::write(docs_dir.join("getting-started.md"), &guide)
        .map_err(|e| format!("Could not write getting-started.md: {}", e))?;

    Ok(project_root.to_string_lossy().to_string())
}
/// Create a new documentation group (folder) with an optional starter page.
#[tauri::command]
pub fn create_group(
    docs_dir: String,
    folder_name: String,
    display_name: String,
    create_starter: bool,
) -> Result<Option<PageEntry>, String> {
    let folder = folder_name.trim();
    if folder.is_empty() {
        return Err("Folder name cannot be empty.".to_string());
    }
    let invalid = ['<', '>', ':', '"', '|', '?', '*', '\\', '/'];
    for c in &invalid {
        if folder.contains(*c) {
            return Err(format!("Folder name cannot contain '{}'.", c));
        }
    }

    let group_path = PathBuf::from(&docs_dir).join(folder);

    if group_path.exists() {
        return Err(format!(
            "A folder named \"{}\" already exists in the docs directory.",
            folder
        ));
    }

    std::fs::create_dir_all(&group_path)
        .map_err(|e| format!("Could not create folder: {}", e))?;

    if create_starter {
        let name = display_name.trim();
        let content = format!(
            "# {}\n\nWelcome to the **{}** section.\n",
            name, name,
        );

        let index_path = group_path.join("index.md");
        std::fs::write(&index_path, &content)
            .map_err(|e| format!("Could not write index.md: {}", e))?;

        let relative = format!("{}/index.md", folder);
        Ok(Some(PageEntry {
            title: format!("{}", name),
            file_path: index_path.to_string_lossy().to_string(),
            relative_path: relative,
        }))
    } else {
        Ok(None)
    }
}
