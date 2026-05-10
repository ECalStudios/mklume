// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct HealthIssue {
    pub severity: String,
    pub category: String,
    pub message: String,
    pub file: Option<String>,
    pub line: Option<usize>,
    pub detail: Option<String>,
    pub action: Option<String>,
}

#[derive(Serialize)]
pub struct HealthReport {
    pub issues: Vec<HealthIssue>,
    pub summary: HealthSummary,
}

#[derive(Serialize)]
pub struct HealthSummary {
    pub errors: usize,
    pub warnings: usize,
    pub infos: usize,
    pub total_pages: usize,
    pub nav_pages: usize,
    pub unlisted_pages: usize,
    pub score: usize,
}

// ── Path Resolution ──────────────────────────────────────

/// Resolve a referenced path relative to a markdown file's location.
///
/// - `ref_path`: the path as written in markdown
/// - `md_rel`: the markdown file's path relative to docs root (forward slashes)
/// - `docs_dir`: absolute path to the docs directory
fn resolve_ref_path(ref_path: &str, md_rel: &str, docs_dir: &Path) -> PathBuf {
    if ref_path.starts_with('/') {
        // Root-absolute: resolve from docs root
        return docs_dir.join(ref_path.trim_start_matches('/'));
    }

    // Relative: resolve from the markdown file's parent directory
    let md_parent = if let Some(slash) = md_rel.rfind('/') {
        &md_rel[..slash]
    } else {
        ""
    };

    // Split parent and ref into segments, resolve . and ..
    let mut parts: Vec<&str> = if md_parent.is_empty() {
        Vec::new()
    } else {
        md_parent.split('/').collect()
    };

    for segment in ref_path.split('/') {
        match segment {
            ".." => {
                parts.pop();
            }
            "." | "" => {}
            s => parts.push(s),
        }
    }

    let mut resolved = docs_dir.to_path_buf();
    for part in &parts {
        resolved = resolved.join(part);
    }
    resolved
}

// ── Markdown Reference Extraction (Unicode-safe) ─────────

struct MarkdownRef {
    path: String,
    line: usize,
    alt_text: Option<String>,
}

struct MarkdownRefs {
    images: Vec<MarkdownRef>,
    links: Vec<MarkdownRef>,
}

/// Extract image and link references from markdown content with line numbers.
/// Uses `str::find` for all string searching — never indexes by
/// arbitrary byte positions — so Unicode content cannot cause panics.
fn extract_markdown_refs(content: &str) -> MarkdownRefs {
    let mut images = Vec::new();
    let mut links = Vec::new();

    // Precompute line starts for mapping byte offsets → line numbers
    let line_starts: Vec<usize> = std::iter::once(0)
        .chain(content.match_indices('\n').map(|(i, _)| i + 1))
        .collect();

    let byte_to_line = |byte_offset: usize| -> usize {
        match line_starts.binary_search(&byte_offset) {
            Ok(idx) => idx + 1,
            Err(idx) => idx,
        }
    };

    // ── Markdown syntax: ![alt](path) and [text](path) ──

    let mut search_from = 0;
    while search_from < content.len() {
        // Find the next `[` that might start a link or image
        let rel = match content[search_from..].find('[') {
            Some(pos) => pos,
            None => break,
        };
        let bracket_open = search_from + rel;

        // Check if this is an image: `!` immediately before `[`
        let is_image = bracket_open > 0
            && content.as_bytes().get(bracket_open - 1) == Some(&b'!');

        // Find the matching `]`
        let after_open = bracket_open + 1;
        let rel_close = match content[after_open..].find(']') {
            Some(pos) => pos,
            None => {
                search_from = after_open;
                continue;
            }
        };
        let bracket_close = after_open + rel_close;

        // Capture alt text for images
        let alt_text = if is_image {
            Some(content[after_open..bracket_close].to_string())
        } else {
            None
        };

        // Expect `(` immediately after `]`
        let paren_open = bracket_close + 1;
        if paren_open >= content.len() || content.as_bytes()[paren_open] != b'(' {
            search_from = bracket_close + 1;
            continue;
        }

        let paren_content_start = paren_open + 1;

        // Find the closing `)`
        let rel_paren_close = match content[paren_content_start..].find(')') {
            Some(pos) => pos,
            None => {
                search_from = paren_content_start;
                continue;
            }
        };

        // Extract the URL portion (everything before a space or quote)
        let paren_content = &content[paren_content_start..paren_content_start + rel_paren_close];
        let url = paren_content
            .split(|c: char| c.is_whitespace() || c == '"' || c == '\'')
            .next()
            .unwrap_or("");

        let line_num = byte_to_line(bracket_open);

        if let Some(cleaned) = clean_ref_path(url) {
            if is_image {
                images.push(MarkdownRef {
                    path: cleaned,
                    line: line_num,
                    alt_text,
                });
            } else if is_local_link(&cleaned) {
                let link = cleaned.split('#').next().unwrap_or(&cleaned);
                if !link.is_empty() {
                    links.push(MarkdownRef {
                        path: link.to_string(),
                        line: line_num,
                        alt_text: None,
                    });
                }
            }
        }

        search_from = paren_content_start + rel_paren_close + 1;
    }

    // ── HTML: <img src="path"> ──

    let mut img_search = 0;
    while img_search < content.len() {
        let rel = match content[img_search..].find("<img") {
            Some(pos) => pos,
            None => break,
        };
        let tag_start = img_search + rel;

        let tag_end_rel = match content[tag_start..].find('>') {
            Some(pos) => pos + 1,
            None => break,
        };
        let tag = &content[tag_start..tag_start + tag_end_rel];

        if let Some(src) = extract_html_attr(tag, "src") {
            if let Some(cleaned) = clean_ref_path(&src) {
                let alt = extract_html_attr(tag, "alt");
                images.push(MarkdownRef {
                    path: cleaned,
                    line: byte_to_line(tag_start),
                    alt_text: alt,
                });
            }
        }

        img_search = tag_start + tag_end_rel;
    }

    MarkdownRefs { images, links }
}

/// Extract an HTML attribute value using `find`, safe for all Unicode.
fn extract_html_attr(tag: &str, attr: &str) -> Option<String> {
    for quote in ['"', '\''] {
        let pattern = format!("{}={}", attr, quote);
        if let Some(start) = tag.find(&pattern) {
            let value_start = start + pattern.len();
            let rest = &tag[value_start..];
            if let Some(end) = rest.find(quote) {
                return Some(rest[..end].to_string());
            }
        }
        // Also try with a space before `=`
        let pattern_sp = format!("{} ={}", attr, quote);
        if let Some(start) = tag.find(&pattern_sp) {
            let value_start = start + pattern_sp.len();
            let rest = &tag[value_start..];
            if let Some(end) = rest.find(quote) {
                return Some(rest[..end].to_string());
            }
        }
    }
    None
}

/// Return None for external/special URLs, Some(cleaned) for local paths.
fn clean_ref_path(path: &str) -> Option<String> {
    let trimmed = path.trim();
    if trimmed.is_empty()
        || trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("mailto:")
        || trimmed.starts_with("data:")
        || trimmed.starts_with('#')
    {
        return None;
    }
    let decoded = trimmed.replace("%20", " ");
    Some(decoded)
}

/// Check if a link target looks like a local markdown reference.
fn is_local_link(path: &str) -> bool {
    path.ends_with(".md")
        || path.contains(".md#")
        || (!path.contains('.') && !path.starts_with('#'))
}

// ── Nav Path Collection ──────────────────────────────────

fn collect_nav_paths(val: &serde_yaml::Value, out: &mut Vec<String>) {
    match val {
        serde_yaml::Value::String(s) => out.push(s.clone()),
        serde_yaml::Value::Mapping(map) => {
            for (_, v) in map {
                collect_nav_paths(v, out);
            }
        }
        serde_yaml::Value::Sequence(seq) => {
            for item in seq {
                collect_nav_paths(item, out);
            }
        }
        _ => {}
    }
}

/// Check for duplicate nav labels among siblings at each level of the nav tree.
fn check_duplicate_nav_labels(val: &serde_yaml::Value, issues: &mut Vec<HealthIssue>) {
    if let serde_yaml::Value::Sequence(seq) = val {
        // Collect labels at this level (siblings)
        let mut labels_at_level: Vec<String> = Vec::new();
        for item in seq {
            if let serde_yaml::Value::Mapping(map) = item {
                for (k, v) in map {
                    if let Some(label) = k.as_str() {
                        labels_at_level.push(label.to_string());
                    }
                    // Recurse into children
                    check_duplicate_nav_labels(v, issues);
                }
            }
        }
        // Check for duplicates among siblings only
        let mut seen = HashSet::new();
        for label in &labels_at_level {
            if !seen.insert(label.to_lowercase()) {
                issues.push(HealthIssue {
                    severity: "info".into(),
                    category: "Navigation".into(),
                    message: format!("Duplicate sibling nav label: '{}'", label),
                    file: None,
                    line: None,
                    detail: Some("Multiple nav entries at the same level share this label. Consider using unique names.".into()),
                    action: None,
                });
            }
        }
    }
}

/// Check for empty nav groups (groups with no children or only empty sub-groups).
fn find_empty_nav_groups(val: &serde_yaml::Value, issues: &mut Vec<HealthIssue>) {
    if let serde_yaml::Value::Sequence(seq) = val {
        for item in seq {
            if let serde_yaml::Value::Mapping(map) = item {
                for (k, v) in map {
                    if let Some(label) = k.as_str() {
                        if let serde_yaml::Value::Sequence(children) = v {
                            if children.is_empty() {
                                issues.push(HealthIssue {
                                    severity: "warning".into(),
                                    category: "Navigation".into(),
                                    message: format!("Empty navigation group: '{}'", label),
                                    file: None,
                                    line: None,
                                    detail: Some("This navigation group has no pages.".into()),
                                    action: None,
                                });
                            }
                        }
                        // Recurse into children
                        find_empty_nav_groups(v, issues);
                    }
                }
            }
        }
    }
}

// ── Content Analysis ────────────────────────────────────

struct ContentAnalysis {
    headings: Vec<(usize, usize, String)>, // (line, level, text)
    word_count: usize,
    has_admonition: bool,
    has_details: bool,
    has_tabs: bool,
    has_code_fence: bool,
    has_table: bool,
    has_attr_list: bool,
    has_md_in_html: bool,
    has_icon_shortcodes: bool,
    has_backslash_paths: Vec<(usize, String)>, // (line, path)
    body_start_line: usize,
}

/// Strip YAML frontmatter and return the body content and starting line.
fn strip_frontmatter(content: &str) -> (&str, usize) {
    if !content.starts_with("---") {
        return (content, 1);
    }
    // Find closing ---
    if let Some(end_pos) = content[3..].find("\n---") {
        let body_start = 3 + end_pos + 4; // skip past \n---
        // Skip any trailing newline
        let body = if body_start < content.len() {
            &content[body_start..]
        } else {
            ""
        };
        let lines_before = content[..body_start].matches('\n').count() + 1;
        (body.trim_start_matches('\n'), lines_before)
    } else {
        (content, 1)
    }
}

/// Analyze markdown content for headings, features used, etc.
fn analyze_content(content: &str) -> ContentAnalysis {
    let (body, body_start) = strip_frontmatter(content);

    let mut headings = Vec::new();
    let mut word_count = 0;
    let mut has_admonition = false;
    let mut has_details = false;
    let mut has_tabs = false;
    let mut has_code_fence = false;
    let mut has_table = false;
    let mut has_attr_list = false;
    let mut has_md_in_html = false;
    let mut has_icon_shortcodes = false;
    let mut backslash_paths = Vec::new();
    let mut in_code_block = false;

    for (i, line) in body.lines().enumerate() {
        let line_num = body_start + i;
        let trimmed = line.trim();

        // Track code blocks to avoid false positives inside them
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_code_block = !in_code_block;
            has_code_fence = true;
            continue;
        }
        if in_code_block {
            continue;
        }

        // Count words (rough)
        word_count += trimmed.split_whitespace().count();

        // Headings
        if trimmed.starts_with('#') {
            let level = trimmed.chars().take_while(|c| *c == '#').count();
            if level <= 6 {
                let text = trimmed[level..].trim().trim_start_matches(' ').to_string();
                headings.push((line_num, level, text));
            }
        }

        // Feature detection
        if trimmed.starts_with("!!!") || trimmed.starts_with("!!! ") {
            has_admonition = true;
        }
        if trimmed.starts_with("???") || trimmed.starts_with("??? ") || trimmed.starts_with("???+") {
            has_details = true;
        }
        if trimmed.starts_with("===") && trimmed.contains('"') {
            has_tabs = true;
        }
        if trimmed.contains('|') && trimmed.starts_with('|') && trimmed.ends_with('|') {
            has_table = true;
        }
        if trimmed.contains("{ .") || trimmed.contains("{.") {
            has_attr_list = true;
        }
        if trimmed.contains("<div") || trimmed.contains("<grid") || trimmed.starts_with("<div") {
            has_md_in_html = true;
        }

        // Icon shortcode detection: :simple-xxx: or :material-xxx: or :fontawesome-xxx: or :octicons-xxx:
        if trimmed.contains(":material-") || trimmed.contains(":fontawesome-")
            || trimmed.contains(":octicons-") || trimmed.contains(":simple-")
        {
            has_icon_shortcodes = true;
        }
    }

    // Check for backslash paths in links/images (scan raw content)
    let mut search_from = 0;
    while search_from < content.len() {
        let rel = match content[search_from..].find("](") {
            Some(pos) => pos,
            None => break,
        };
        let paren_start = search_from + rel + 2;
        let paren_end = match content[paren_start..].find(')') {
            Some(pos) => paren_start + pos,
            None => break,
        };
        let path = &content[paren_start..paren_end];
        let path_part = path.split(|c: char| c.is_whitespace() || c == '"' || c == '\'')
            .next()
            .unwrap_or("");
        if path_part.contains('\\') && !path_part.starts_with("http") {
            let line_num = content[..paren_start].matches('\n').count() + 1;
            backslash_paths.push((line_num, path_part.to_string()));
        }
        search_from = paren_end + 1;
    }

    ContentAnalysis {
        headings,
        word_count,
        has_admonition,
        has_details,
        has_tabs,
        has_code_fence,
        has_table,
        has_attr_list,
        has_md_in_html,
        has_icon_shortcodes,
        has_backslash_paths: backslash_paths,
        body_start_line: body_start,
    }
}

// ── Main Scan Command ────────────────────────────────────
// Performs a comprehensive health check on the project:
// 1. Validates mkdocs.yml syntax and required fields
// 2. Scans all docs/ files for content issues (broken links, missing titles, etc.)
// 3. Checks for SEO, performance, and best-practice concerns
// 4. Returns a scored report with categorized, prioritized issues

#[tauri::command]
pub fn scan_project_health(
    _root_path: String,
    docs_dir: String,
    config_path: String,
) -> Result<HealthReport, String> {
    let docs = PathBuf::from(&docs_dir);
    let mut issues = Vec::new();

    // 1. Check YAML parse
    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Could not read config: {}", e))?;

    let full_value: serde_yaml::Value = match serde_yaml::from_str(&config_content) {
        Ok(v) => v,
        Err(e) => {
            issues.push(HealthIssue {
                severity: "error".into(),
                category: "Configuration".into(),
                message: "mkdocs.yml has YAML syntax errors.".into(),
                file: Some(config_path.clone()),
                line: None,
                detail: Some(e.to_string()),
                action: None,
            });
            return Ok(HealthReport {
                issues,
                summary: HealthSummary {
                    errors: 1, warnings: 0, infos: 0,
                    total_pages: 0, nav_pages: 0, unlisted_pages: 0,
                    score: 0,
                },
            });
        }
    };

    // ── Configuration Checks ──────────────────────────────

    // Missing site_name
    match full_value.get("site_name") {
        None => {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Configuration".into(),
                message: "Missing 'site_name' in mkdocs.yml.".into(),
                file: Some(config_path.clone()),
                line: None,
                detail: Some("Add site_name to identify your documentation site.".into()),
                action: None,
            });
        }
        Some(serde_yaml::Value::String(s)) if s.trim().is_empty() => {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Configuration".into(),
                message: "Empty 'site_name' in mkdocs.yml.".into(),
                file: Some(config_path.clone()),
                line: None,
                detail: Some("Provide a meaningful site name for your documentation.".into()),
                action: None,
            });
        }
        _ => {}
    }

    // Missing theme or theme.name
    match full_value.get("theme") {
        None => {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Configuration".into(),
                message: "No 'theme' specified in mkdocs.yml.".into(),
                file: Some(config_path.clone()),
                line: None,
                detail: Some("Add theme.name: material for MkDocs Material features.".into()),
                action: None,
            });
        }
        Some(theme_val) => {
            if let serde_yaml::Value::Mapping(theme_map) = theme_val {
                // Check theme.name
                if theme_map.get("name").is_none() {
                    issues.push(HealthIssue {
                        severity: "info".into(),
                        category: "Configuration".into(),
                        message: "Theme section exists but 'name' is not specified.".into(),
                        file: Some(config_path.clone()),
                        line: None,
                        detail: Some("Consider adding theme.name: material explicitly.".into()),
                        action: None,
                    });
                }

                // Check logo path
                if let Some(serde_yaml::Value::String(logo_path)) = theme_map.get("logo") {
                    let resolved = docs.join(logo_path);
                    if !resolved.exists() {
                        issues.push(HealthIssue {
                            severity: "warning".into(),
                            category: "Configuration".into(),
                            message: format!("Theme logo file not found: {}", logo_path),
                            file: Some(config_path.clone()),
                            line: None,
                            detail: Some(format!("Expected at: {}", resolved.to_string_lossy())),
                            action: None,
                        });
                    }
                }

                // Check favicon path
                if let Some(serde_yaml::Value::String(favicon_path)) = theme_map.get("favicon") {
                    let resolved = docs.join(favicon_path);
                    if !resolved.exists() {
                        issues.push(HealthIssue {
                            severity: "warning".into(),
                            category: "Configuration".into(),
                            message: format!("Favicon file not found: {}", favicon_path),
                            file: Some(config_path.clone()),
                            line: None,
                            detail: Some(format!("Expected at: {}", resolved.to_string_lossy())),
                            action: None,
                        });
                    }
                }
            }
        }
    }

    // 2. Collect all .md files on disk
    let mut md_files: HashSet<String> = HashSet::new();
    for entry in WalkDir::new(&docs).sort_by_file_name().into_iter().filter_map(|e| e.ok()) {
        let p = entry.path();
        if !p.is_file() { continue; }
        let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase());
        if ext.as_deref() != Some("md") { continue; }
        let rel = p.strip_prefix(&docs).unwrap_or(p).to_string_lossy().replace('\\', "/");
        md_files.insert(rel);
    }

    // 3. Check nav section
    let mut nav_paths: Vec<String> = Vec::new();
    if let Some(nav_val) = full_value.get("nav") {
        collect_nav_paths(nav_val, &mut nav_paths);

        // Check for empty nav groups
        find_empty_nav_groups(nav_val, &mut issues);

        // Check for duplicate nav labels among siblings at each level
        check_duplicate_nav_labels(nav_val, &mut issues);
    }
    let nav_set: HashSet<String> = nav_paths.iter().cloned().collect();
    let has_nav = !nav_paths.is_empty();

    // Missing nav entries
    for path in &nav_paths {
        if !md_files.contains(path) {
            issues.push(HealthIssue {
                severity: "error".into(),
                category: "Navigation".into(),
                message: format!("Nav references missing file: {}", path),
                file: None,
                line: None,
                detail: Some("This navigation entry points to a file that does not exist.".into()),
                action: Some(format!("remove_nav:{}", path)),
            });
        }
    }

    // Duplicate nav paths
    let mut seen = HashSet::new();
    for path in &nav_paths {
        if !seen.insert(path.clone()) {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Navigation".into(),
                message: format!("Duplicate nav entry: {}", path),
                file: None,
                line: None,
                detail: Some("This file appears more than once in the navigation.".into()),
                action: None,
            });
        }
    }

    // Unlisted pages
    if has_nav {
        for file in &md_files {
            if !nav_set.contains(file) {
                issues.push(HealthIssue {
                    severity: "info".into(),
                    category: "Navigation".into(),
                    message: format!("Page not in navigation: {}", file),
                    file: Some(file.clone()),
                    line: None,
                    detail: Some("This file exists but is not listed in mkdocs.yml nav.".into()),
                    action: Some(format!("add_nav:{}", file)),
                });
            }
        }
    }

    // 4. Collect extension list for content-aware checks
    let ext_list: Vec<String> = if let Some(serde_yaml::Value::Sequence(seq)) = full_value.get("markdown_extensions") {
        seq.iter()
            .filter_map(|v| match v {
                serde_yaml::Value::String(s) => Some(s.clone()),
                serde_yaml::Value::Mapping(m) => {
                    m.keys().next().and_then(|k| k.as_str().map(|s| s.to_string()))
                }
                _ => None,
            })
            .collect()
    } else {
        Vec::new()
    };
    let has_ext = |name: &str| ext_list.iter().any(|e| e == name);

    // Track which content features are actually used across all pages
    let mut any_uses_admonition = false;
    let mut any_uses_details = false;
    let mut any_uses_tabs = false;
    let mut any_uses_code_fence = false;
    let mut any_uses_table = false;
    let mut any_uses_attr_list = false;
    let mut any_uses_md_in_html = false;
    let mut any_uses_icon_shortcodes = false;

    // 5. Scan markdown files for issues
    for md_rel in &md_files {
        let full_path = docs.join(md_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let content = match std::fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // ── Reference checks (broken images, links) ──
        let refs = extract_markdown_refs(&content);

        for img_ref in &refs.images {
            let resolved = resolve_ref_path(&img_ref.path, md_rel, &docs);
            if !resolved.exists() {
                let resolved_display = resolved
                    .strip_prefix(&docs)
                    .unwrap_or(&resolved)
                    .to_string_lossy()
                    .replace('\\', "/");
                issues.push(HealthIssue {
                    severity: "warning".into(),
                    category: "Images".into(),
                    message: format!("Missing image: {}", img_ref.path),
                    file: Some(md_rel.clone()),
                    line: Some(img_ref.line),
                    detail: Some(format!(
                        "Line {}: resolves to docs/{} which does not exist.",
                        img_ref.line, resolved_display
                    )),
                    action: None,
                });
            } else {
                // Check image file size (warn if > 500KB)
                if let Ok(meta) = std::fs::metadata(&resolved) {
                    let size_kb = meta.len() / 1024;
                    if size_kb > 500 {
                        issues.push(HealthIssue {
                            severity: "info".into(),
                            category: "Performance".into(),
                            message: format!("Large image: {} ({}KB)", img_ref.path, size_kb),
                            file: Some(md_rel.clone()),
                            line: Some(img_ref.line),
                            detail: Some(format!(
                                "Line {}: Image is {}KB. Consider compressing or converting to WebP for faster loading.",
                                img_ref.line, size_kb
                            )),
                            action: None,
                        });
                    }
                }
            }

            // Check for missing alt text
            if let Some(alt) = &img_ref.alt_text {
                if alt.trim().is_empty() {
                    issues.push(HealthIssue {
                        severity: "info".into(),
                        category: "SEO".into(),
                        message: format!("Image missing alt text: {}", img_ref.path),
                        file: Some(md_rel.clone()),
                        line: Some(img_ref.line),
                        detail: Some(format!(
                            "Line {}: Adding alt text improves accessibility and SEO.",
                            img_ref.line
                        )),
                        action: None,
                    });
                }
            }
        }

        for link_ref in &refs.links {
            // Backslash detection
            if link_ref.path.contains('\\') {
                issues.push(HealthIssue {
                    severity: "warning".into(),
                    category: "Links".into(),
                    message: format!("Link uses backslashes: {}", link_ref.path),
                    file: Some(md_rel.clone()),
                    line: Some(link_ref.line),
                    detail: Some(format!(
                        "Line {}: Use forward slashes (/) for cross-platform compatibility.",
                        link_ref.line
                    )),
                    action: None,
                });
                continue;
            }

            let resolved = resolve_ref_path(&link_ref.path, md_rel, &docs);
            let with_md = if !link_ref.path.ends_with(".md") {
                resolve_ref_path(&format!("{}.md", link_ref.path), md_rel, &docs)
            } else {
                resolved.clone()
            };
            let as_index = resolve_ref_path(
                &format!("{}/index.md", link_ref.path.trim_end_matches('/')),
                md_rel,
                &docs,
            );

            if !resolved.exists() && !with_md.exists() && !as_index.exists() {
                let resolved_display = resolved
                    .strip_prefix(&docs)
                    .unwrap_or(&resolved)
                    .to_string_lossy()
                    .replace('\\', "/");
                issues.push(HealthIssue {
                    severity: "warning".into(),
                    category: "Links".into(),
                    message: format!("Broken link: {}", link_ref.path),
                    file: Some(md_rel.clone()),
                    line: Some(link_ref.line),
                    detail: Some(format!(
                        "Line {}: resolves to docs/{} which was not found.",
                        link_ref.line, resolved_display
                    )),
                    action: None,
                });
            }
        }

        // ── Content analysis ──
        let analysis = analyze_content(&content);

        // Track feature usage across all pages
        if analysis.has_admonition { any_uses_admonition = true; }
        if analysis.has_details { any_uses_details = true; }
        if analysis.has_tabs { any_uses_tabs = true; }
        if analysis.has_code_fence { any_uses_code_fence = true; }
        if analysis.has_table { any_uses_table = true; }
        if analysis.has_attr_list { any_uses_attr_list = true; }
        if analysis.has_md_in_html { any_uses_md_in_html = true; }
        if analysis.has_icon_shortcodes { any_uses_icon_shortcodes = true; }

        // Backslash paths in raw content
        for (line, path) in &analysis.has_backslash_paths {
            // Only report if not already caught by the link ref checker
            let already_reported = refs.links.iter().any(|l| l.path.contains('\\') && l.line == *line);
            if !already_reported {
                issues.push(HealthIssue {
                    severity: "warning".into(),
                    category: "Links".into(),
                    message: format!("Path uses backslashes: {}", path),
                    file: Some(md_rel.clone()),
                    line: Some(*line),
                    detail: Some(format!(
                        "Line {}: Use forward slashes for cross-platform compatibility.", line
                    )),
                    action: None,
                });
            }
        }

        // ── Content Quality checks ──

        // Empty page check (< 10 non-whitespace chars after frontmatter)
        let (body, _) = strip_frontmatter(&content);
        if body.trim().len() < 10 && !body.trim().is_empty() {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Content Quality".into(),
                message: "Nearly empty page.".into(),
                file: Some(md_rel.clone()),
                line: None,
                detail: Some("This page has very little content. Consider adding content or removing it.".into()),
                action: None,
            });
        } else if body.trim().is_empty() {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Content Quality".into(),
                message: "Empty page.".into(),
                file: Some(md_rel.clone()),
                line: None,
                detail: Some("This page has no content after frontmatter.".into()),
                action: None,
            });
        }

        // Multiple H1s
        let h1s: Vec<&(usize, usize, String)> = analysis.headings.iter().filter(|(_, level, _)| *level == 1).collect();
        if h1s.len() > 1 {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Content Quality".into(),
                message: format!("Multiple H1 headings ({} found).", h1s.len()),
                file: Some(md_rel.clone()),
                line: Some(h1s[1].0),
                detail: Some(format!(
                    "Each page should have at most one H1. Found on lines: {}",
                    h1s.iter().map(|(l, _, _)| l.to_string()).collect::<Vec<_>>().join(", ")
                )),
                action: None,
            });
        }

        // Heading jumps (e.g. h1 → h3, h2 → h4)
        for i in 1..analysis.headings.len() {
            let prev_level = analysis.headings[i - 1].1;
            let curr_level = analysis.headings[i].1;
            if curr_level > prev_level + 1 {
                issues.push(HealthIssue {
                    severity: "info".into(),
                    category: "Content Quality".into(),
                    message: format!("Heading level jump: H{} → H{}", prev_level, curr_level),
                    file: Some(md_rel.clone()),
                    line: Some(analysis.headings[i].0),
                    detail: Some(format!(
                        "Line {}: Heading skips from level {} to {}. This may affect document structure and accessibility.",
                        analysis.headings[i].0, prev_level, curr_level
                    )),
                    action: None,
                });
            }
        }

        // ── SEO checks ──

        // Missing H1
        if h1s.is_empty() && analysis.word_count > 10 {
            issues.push(HealthIssue {
                severity: "info".into(),
                category: "SEO".into(),
                message: "Page has no H1 heading.".into(),
                file: Some(md_rel.clone()),
                line: None,
                detail: Some("A top-level heading (# Title) helps with SEO and document structure.".into()),
                action: None,
            });
        }

        // Very short content (< 50 words, but not empty)
        if analysis.word_count > 0 && analysis.word_count < 50 && body.trim().len() >= 10 {
            issues.push(HealthIssue {
                severity: "info".into(),
                category: "SEO".into(),
                message: format!("Short page ({} words).", analysis.word_count),
                file: Some(md_rel.clone()),
                line: None,
                detail: Some("Pages with very little content may not rank well. Consider expanding.".into()),
                action: None,
            });
        }

        // Placeholder text detection
        let lower_body = body.to_lowercase();
        for placeholder in ["todo", "lorem ipsum", "placeholder", "coming soon", "tbd", "work in progress"] {
            if lower_body.contains(placeholder) {
                // Find the line number
                let mut placeholder_line = None;
                for (i, line) in body.lines().enumerate() {
                    if line.to_lowercase().contains(placeholder) {
                        placeholder_line = Some(analysis.body_start_line + i);
                        break;
                    }
                }
                issues.push(HealthIssue {
                    severity: "info".into(),
                    category: "Content Quality".into(),
                    message: format!("Possible placeholder text: '{}'", placeholder),
                    file: Some(md_rel.clone()),
                    line: placeholder_line,
                    detail: Some("This looks like placeholder text that should be replaced before publishing.".into()),
                    action: None,
                });
                break; // Only report once per page
            }
        }
    }

    // 6. Content-aware extension checks
    // Only warn about missing extensions when content actually uses the feature
    let content_aware_checks: Vec<(bool, &str, &str, &str)> = vec![
        (any_uses_admonition, "admonition", "Admonition syntax (!!!) detected", "Add 'admonition' to markdown_extensions for admonition support."),
        (any_uses_details, "pymdownx.details", "Expandable blocks (???) detected", "Add 'pymdownx.details' to markdown_extensions for collapsible blocks."),
        (any_uses_tabs, "pymdownx.tabbed", "Content tabs (===) detected", "Add 'pymdownx.tabbed' to markdown_extensions for tab support."),
        (any_uses_code_fence, "pymdownx.superfences", "Fenced code blocks detected", "Add 'pymdownx.superfences' for enhanced code block support."),
        (any_uses_table, "tables", "Markdown tables detected", "Add 'tables' to markdown_extensions for table rendering."),
        (any_uses_attr_list, "attr_list", "Attribute lists ({ .class }) detected", "Add 'attr_list' to markdown_extensions for attribute support."),
        (any_uses_md_in_html, "md_in_html", "HTML with markdown content detected", "Add 'md_in_html' for grid cards and HTML-embedded markdown."),
    ];

    for (is_used, ext, msg, detail) in &content_aware_checks {
        if *is_used && !has_ext(ext) {
            issues.push(HealthIssue {
                severity: "warning".into(),
                category: "Extensions".into(),
                message: format!("{} but '{}' extension is missing.", msg, ext),
                file: None,
                line: None,
                detail: Some(detail.to_string()),
                action: None,
            });
        }
    }

    // Icon shortcode check
    if any_uses_icon_shortcodes && !has_ext("pymdownx.emoji") {
        issues.push(HealthIssue {
            severity: "warning".into(),
            category: "Extensions".into(),
            message: "Icon shortcodes detected but 'pymdownx.emoji' extension is missing.".into(),
            file: None,
            line: None,
            detail: Some("Add 'pymdownx.emoji' to markdown_extensions for icon support (:material-xxx:, :fontawesome-xxx:, etc.).".into()),
            action: None,
        });
    }

    // 7. Build summary
    let errors = issues.iter().filter(|i| i.severity == "error").count();
    let warnings = issues.iter().filter(|i| i.severity == "warning").count();
    let infos = issues.iter().filter(|i| i.severity == "info").count();
    let unlisted = if has_nav { md_files.len().saturating_sub(nav_set.len()) } else { 0 };

    // Compute health score (0-100)
    let total_pages = md_files.len().max(1);
    let error_penalty = errors * 15;
    let warning_penalty = warnings * 5;
    let info_penalty = infos * 1;
    let total_penalty = error_penalty + warning_penalty + info_penalty;
    let score = if total_penalty >= 100 { 0 } else { 100 - total_penalty };

    issues.sort_by_key(|i| match i.severity.as_str() {
        "error" => 0,
        "warning" => 1,
        _ => 2,
    });

    Ok(HealthReport {
        issues,
        summary: HealthSummary {
            errors, warnings, infos,
            total_pages,
            nav_pages: nav_paths.len(),
            unlisted_pages: unlisted,
            score,
        },
    })
}
