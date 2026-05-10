use serde::Serialize;
use std::path::{Path, PathBuf};

/// Supported image extensions (lowercase).
const SUPPORTED_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "svg"];

/// Result for a single image copy operation.
#[derive(Serialize, Clone, Debug)]
pub struct ImageCopyResult {
    /// Original source path
    pub source: String,
    /// Final filename in assets folder (after sanitization / dedup)
    pub filename: String,
    /// Relative Markdown path from the current page (e.g. "assets/img.png" or "../assets/img.png")
    pub markdown_path: String,
    /// Generated alt text
    pub alt_text: String,
    /// true if copy succeeded
    pub ok: bool,
    /// Error message if failed
    pub error: Option<String>,
}

/// Batch result returned to the frontend.
#[derive(Serialize, Clone, Debug)]
pub struct CopyImagesResult {
    pub results: Vec<ImageCopyResult>,
    pub copied_count: usize,
    pub skipped_count: usize,
}

/// Sanitize a filename: lowercase, replace spaces/unsafe chars with hyphens, collapse runs.
fn sanitize_filename(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
            out.push(ch.to_ascii_lowercase());
        } else if ch == ' ' || ch == '\t' {
            out.push('-');
        }
        // skip other chars
    }
    // collapse consecutive hyphens
    let mut collapsed = String::with_capacity(out.len());
    let mut prev_hyphen = false;
    for ch in out.chars() {
        if ch == '-' {
            if !prev_hyphen {
                collapsed.push('-');
            }
            prev_hyphen = true;
        } else {
            prev_hyphen = false;
            collapsed.push(ch);
        }
    }
    // trim leading/trailing hyphens
    collapsed.trim_matches('-').to_string()
}

/// Generate a unique filename in a directory: image.png → image-2.png → image-3.png
fn unique_filename(dir: &Path, desired: &str) -> String {
    let path = dir.join(desired);
    if !path.exists() {
        return desired.to_string();
    }
    // Split into stem + extension
    let dot_pos = desired.rfind('.');
    let (stem, ext) = match dot_pos {
        Some(pos) => (&desired[..pos], &desired[pos..]), // ("image", ".png")
        None => (desired, ""),
    };

    for n in 2..=999 {
        let candidate = format!("{}-{}{}", stem, n, ext);
        if !dir.join(&candidate).exists() {
            return candidate;
        }
    }
    // Extremely unlikely fallback
    format!("{}-{}{}", stem, chrono_timestamp(), ext)
}

fn chrono_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", d.as_secs())
}

/// Generate alt text from filename: "my-cool-screenshot.png" → "My cool screenshot"
fn alt_text_from_filename(filename: &str) -> String {
    let stem = match filename.rfind('.') {
        Some(pos) => &filename[..pos],
        None => filename,
    };
    let words: Vec<String> = stem
        .split(|c: char| c == '-' || c == '_')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();
    if words.is_empty() {
        return "Image".to_string();
    }
    // Capitalize first word
    let mut result = String::new();
    for (i, w) in words.iter().enumerate() {
        if i == 0 {
            let mut chars = w.chars();
            if let Some(first) = chars.next() {
                result.push(first.to_ascii_uppercase());
                result.extend(chars);
            }
        } else {
            result.push(' ');
            result.push_str(w);
        }
    }
    result
}

/// Compute relative markdown path from a page to the assets folder.
///
/// `page_relative_path` is relative to docs_dir, e.g. "plugins/overview.md"
/// Returns something like "assets/img.png" or "../assets/img.png"
fn markdown_relative_path(page_relative_path: &str, asset_filename: &str) -> String {
    let page_rel = page_relative_path.replace('\\', "/");
    let depth = page_rel.matches('/').count(); // e.g. "plugins/overview.md" → 1

    if depth == 0 {
        // Page is at docs root
        format!("assets/{}", asset_filename)
    } else {
        let mut prefix = String::new();
        for _ in 0..depth {
            prefix.push_str("../");
        }
        format!("{}assets/{}", prefix, asset_filename)
    }
}

#[tauri::command]
pub fn copy_images_to_assets(
    docs_dir: String,
    page_relative_path: String,
    file_paths: Vec<String>,
) -> Result<CopyImagesResult, String> {
    let docs_path = PathBuf::from(&docs_dir);
    if !docs_path.exists() {
        return Err(format!("Docs directory not found: {}", docs_dir));
    }

    let assets_dir = docs_path.join("assets");

    // Create assets/ if missing
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Could not create assets folder: {}", e))?;
    }

    let mut results = Vec::new();
    let mut copied_count = 0usize;
    let mut skipped_count = 0usize;

    for source_str in &file_paths {
        let source = PathBuf::from(source_str);

        // Validate source exists
        if !source.exists() {
            results.push(ImageCopyResult {
                source: source_str.clone(),
                filename: String::new(),
                markdown_path: String::new(),
                alt_text: String::new(),
                ok: false,
                error: Some("File not found".to_string()),
            });
            skipped_count += 1;
            continue;
        }

        // Check extension
        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        if !SUPPORTED_EXTS.contains(&ext.as_str()) {
            results.push(ImageCopyResult {
                source: source_str.clone(),
                filename: String::new(),
                markdown_path: String::new(),
                alt_text: String::new(),
                ok: false,
                error: Some(format!("Unsupported file type: .{}", ext)),
            });
            skipped_count += 1;
            continue;
        }

        // Security: ensure source path doesn't contain path traversal
        let canonical_source = match std::fs::canonicalize(&source) {
            Ok(p) => p,
            Err(e) => {
                results.push(ImageCopyResult {
                    source: source_str.clone(),
                    filename: String::new(),
                    markdown_path: String::new(),
                    alt_text: String::new(),
                    ok: false,
                    error: Some(format!("Cannot resolve path: {}", e)),
                });
                skipped_count += 1;
                continue;
            }
        };

        // Sanitize filename
        let original_name = source
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png");
        let sanitized = sanitize_filename(original_name);
        let sanitized = if sanitized.is_empty() || !sanitized.contains('.') {
            format!("image.{}", ext)
        } else {
            sanitized
        };

        // Make unique
        let final_name = unique_filename(&assets_dir, &sanitized);
        let dest = assets_dir.join(&final_name);

        // Security: ensure destination is inside assets dir
        let canonical_assets = std::fs::canonicalize(&assets_dir)
            .unwrap_or_else(|_| assets_dir.clone());
        // (dest doesn't exist yet, so check parent)
        let dest_parent = dest.parent().unwrap_or(&assets_dir);
        let canonical_parent = std::fs::canonicalize(dest_parent)
            .unwrap_or_else(|_| dest_parent.to_path_buf());
        if !canonical_parent.starts_with(&canonical_assets) {
            results.push(ImageCopyResult {
                source: source_str.clone(),
                filename: String::new(),
                markdown_path: String::new(),
                alt_text: String::new(),
                ok: false,
                error: Some("Invalid destination path".to_string()),
            });
            skipped_count += 1;
            continue;
        }

        // Copy file
        match std::fs::copy(&canonical_source, &dest) {
            Ok(_) => {
                let md_path = markdown_relative_path(&page_relative_path, &final_name);
                let alt = alt_text_from_filename(&final_name);
                results.push(ImageCopyResult {
                    source: source_str.clone(),
                    filename: final_name,
                    markdown_path: md_path,
                    alt_text: alt,
                    ok: true,
                    error: None,
                });
                copied_count += 1;
            }
            Err(e) => {
                results.push(ImageCopyResult {
                    source: source_str.clone(),
                    filename: String::new(),
                    markdown_path: String::new(),
                    alt_text: String::new(),
                    ok: false,
                    error: Some(format!("Copy failed: {}", e)),
                });
                skipped_count += 1;
            }
        }
    }

    Ok(CopyImagesResult {
        results,
        copied_count,
        skipped_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("My Cool Image.png"), "my-cool-image.png");
        assert_eq!(sanitize_filename("hello   world.jpg"), "hello-world.jpg");
        assert_eq!(sanitize_filename("unsafe<>file|name.png"), "unsafefilename.png");
        assert_eq!(sanitize_filename("--test--.png"), "test-.png");
    }

    #[test]
    fn test_alt_text() {
        assert_eq!(alt_text_from_filename("my-cool-screenshot.png"), "My cool screenshot");
        assert_eq!(alt_text_from_filename("hero_banner.webp"), "Hero banner");
        assert_eq!(alt_text_from_filename("image.png"), "Image");
    }

    #[test]
    fn test_markdown_path() {
        assert_eq!(markdown_relative_path("index.md", "photo.png"), "assets/photo.png");
        assert_eq!(markdown_relative_path("plugins/overview.md", "photo.png"), "../assets/photo.png");
        assert_eq!(markdown_relative_path("a/b/deep.md", "photo.png"), "../../assets/photo.png");
    }
}
