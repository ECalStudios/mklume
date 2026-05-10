// MkLume
// Copyright © 2026 ECal Studios. Created by Enrique Cal.
// Licensed under the GNU General Public License v3.0.

//! Site configuration (mkdocs.yml) reader and writer.
//! Reads/writes use string-level manipulation where possible to preserve
//! comments, formatting, and unknown keys that serde would discard.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use walkdir::WalkDir;

// ── Data Structures ──────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PaletteEntry {
    pub scheme: Option<String>,
    pub primary: Option<String>,
    pub accent: Option<String>,
    pub toggle: Option<PaletteToggle>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PaletteToggle {
    pub icon: Option<String>,
    pub name: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct SiteConfig {
    // Identity
    pub site_name: Option<String>,
    pub site_description: Option<String>,
    pub site_author: Option<String>,
    pub site_url: Option<String>,
    pub repo_url: Option<String>,
    pub repo_name: Option<String>,
    pub edit_uri: Option<String>,
    pub copyright: Option<String>,

    // Theme
    pub theme_name: Option<String>,
    pub theme_logo: Option<String>,
    pub theme_favicon: Option<String>,
    pub theme_language: Option<String>,

    // Features (list of string toggles)
    pub features: Vec<String>,

    // Palette
    pub palette: Vec<PaletteEntry>,

    // Plugins (names only for v1)
    pub plugins: Vec<String>,

    // Markdown extensions (names only for v1)
    pub markdown_extensions: Vec<String>,

    // Extra CSS
    pub extra_css: Vec<String>,

    // Extra config (analytics, social, consent, etc.)
    pub extra: ExtraConfig,

    // Raw YAML content for advanced view
    pub raw_yaml: String,
}

#[derive(Deserialize, Debug)]
pub struct SiteConfigUpdate {
    pub site_name: Option<String>,
    pub site_description: Option<String>,
    pub site_author: Option<String>,
    pub site_url: Option<String>,
    pub repo_url: Option<String>,
    pub repo_name: Option<String>,
    pub edit_uri: Option<String>,
    pub copyright: Option<String>,
    pub theme_logo: Option<String>,
    pub theme_favicon: Option<String>,
    pub theme_language: Option<String>,
    pub features: Option<Vec<String>>,
    pub palette: Option<Vec<PaletteEntry>>,
    pub plugins: Option<Vec<String>>,
    pub markdown_extensions: Option<Vec<String>>,
    pub extra: Option<ExtraConfigUpdate>,
}

// ── Extra Config ────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ExtraAnalytics {
    pub provider: Option<String>,
    pub property: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExtraSocialLink {
    pub icon: Option<String>,
    pub link: Option<String>,
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ExtraConsent {
    pub title: Option<String>,
    pub description: Option<String>,
    pub actions: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExtraAlternate {
    pub name: Option<String>,
    pub link: Option<String>,
    pub lang: Option<String>,
}

/// A custom extra key with its raw YAML representation.
#[derive(Serialize, Clone, Debug)]
pub struct ExtraCustomEntry {
    pub key: String,
    pub value_display: String, // human-readable display (scalar value or "[complex]")
    pub is_scalar: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct ExtraConfig {
    pub analytics: Option<ExtraAnalytics>,
    pub social: Vec<ExtraSocialLink>,
    pub consent: Option<ExtraConsent>,
    pub generator: Option<bool>,
    pub homepage: Option<String>,
    pub alternate: Vec<ExtraAlternate>,
    pub mklume_credit: Option<bool>,
    pub custom: Vec<ExtraCustomEntry>,
}

#[derive(Deserialize, Debug, Default)]
pub struct ExtraConfigUpdate {
    pub analytics: Option<Option<ExtraAnalytics>>,  // None=no change, Some(None)=remove, Some(Some(..))=set
    pub social: Option<Vec<ExtraSocialLink>>,
    pub consent: Option<Option<ExtraConsent>>,       // same pattern
    pub generator: Option<Option<bool>>,
    pub homepage: Option<Option<String>>,
    pub alternate: Option<Vec<ExtraAlternate>>,
    pub mklume_credit: Option<Option<bool>>,
}

#[derive(Serialize, Clone, Debug)]
pub struct DocsPageInfo {
    pub relative_path: String,
    pub in_nav: bool,
}

// ── YAML Helpers ─────────────────────────────────────────

/// Quote a YAML string value if it contains special chars.
fn yaml_quote(val: &str) -> String {
    let needs_quoting = val.contains(':')
        || val.contains('#')
        || val.contains('"')
        || val.contains('\'')
        || val.starts_with('-')
        || val.starts_with('{')
        || val.starts_with('[')
        || val.starts_with('*')
        || val.starts_with('&')
        || val.starts_with('!')
        || val.starts_with('?')
        || val.starts_with('|')
        || val.starts_with('>')
        || val.contains('\n')
        || val.is_empty();
    if needs_quoting {
        format!("'{}'", val.replace('\'', "''"))
    } else {
        val.to_string()
    }
}

/// Find the line index and end of a top-level YAML key section.
/// Returns (start_line, end_line_exclusive).
fn find_section_bounds(lines: &[&str], key: &str) -> Option<(usize, usize)> {
    let key_prefix = format!("{}:", key);
    let start = lines.iter().position(|line| {
        let trimmed = line.trim();
        trimmed == key_prefix || trimmed.starts_with(&format!("{}: ", key))
    })?;

    let mut end = lines.len();
    for i in (start + 1)..lines.len() {
        let line = lines[i];
        if line.trim().is_empty() {
            continue;
        }
        // If line starts at column 0 and is not a continuation, it's a new section
        if !line.starts_with(' ') && !line.starts_with('\t') {
            end = i;
            break;
        }
    }
    Some((start, end))
}

/// Replace a top-level scalar field: `key: old_value` → `key: new_value`
fn replace_scalar_field(yaml: &str, key: &str, value: &str) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };
    let new_line = format!("{}: {}", key, yaml_quote(value));

    if let Some((start, _)) = find_section_bounds(&lines, key) {
        // Check if this is truly a scalar (single line)
        let mut result: Vec<String> = Vec::new();
        for (i, line) in lines.iter().enumerate() {
            if i == start {
                result.push(new_line.clone());
            } else {
                result.push(line.to_string());
            }
        }
        result.join("\n") + trailing
    } else {
        // Key doesn't exist — append before nav or at end
        let append_pos = find_good_insert_position(&lines);
        let mut result: Vec<String> = lines[..append_pos].iter().map(|s| s.to_string()).collect();
        result.push(new_line);
        for line in &lines[append_pos..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    }
}

/// Remove a top-level scalar field entirely.
fn remove_scalar_field(yaml: &str, key: &str) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };

    if let Some((start, end)) = find_section_bounds(&lines, key) {
        // Only remove if it's a single-line scalar
        if end == start + 1 || (end > start + 1 && lines[start + 1..end].iter().all(|l| l.trim().is_empty())) {
            let mut result: Vec<String> = Vec::new();
            for (i, line) in lines.iter().enumerate() {
                if i >= start && i < end {
                    continue;
                }
                result.push(line.to_string());
            }
            return result.join("\n") + trailing;
        }
    }
    yaml.to_string()
}

/// Find a good position to insert new top-level keys (before nav: or extra: or end)
fn find_good_insert_position(lines: &[&str]) -> usize {
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with("nav:") || trimmed.starts_with("extra:") {
            // Insert before this, with a blank line
            return i;
        }
    }
    lines.len()
}

/// Replace the theme section with updated values, preserving unrelated sub-keys.
fn replace_theme_section(yaml: &str, logo: Option<&str>, favicon: Option<&str>,
                         language: Option<&str>, features: Option<&[String]>,
                         palette: Option<&[PaletteEntry]>) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };

    if let Some((theme_start, theme_end)) = find_section_bounds(&lines, "theme") {
        let mut new_section: Vec<String> = Vec::new();
        let theme_lines = &lines[theme_start..theme_end];

        // We'll selectively replace sub-sections within theme
        let mut i = 0;
        let mut skip_until_same_indent = None;

        while i < theme_lines.len() {
            let line = theme_lines[i];
            let trimmed = line.trim();

            // Check if we're skipping a sub-section
            if let Some(target_indent) = skip_until_same_indent {
                let current_indent = line.len() - line.trim_start().len();
                if current_indent <= target_indent && !trimmed.is_empty() {
                    skip_until_same_indent = None;
                    // Fall through to process this line
                } else {
                    i += 1;
                    continue;
                }
            }

            // Detect sub-keys we want to replace
            if trimmed.starts_with("logo:") && logo.is_some() {
                let indent = line.len() - line.trim_start().len();
                new_section.push(format!("{}logo: {}", " ".repeat(indent), logo.unwrap()));
                i += 1;
                continue;
            }
            if trimmed.starts_with("favicon:") && favicon.is_some() {
                let indent = line.len() - line.trim_start().len();
                new_section.push(format!("{}favicon: {}", " ".repeat(indent), favicon.unwrap()));
                i += 1;
                continue;
            }
            if trimmed.starts_with("language:") && language.is_some() {
                let indent = line.len() - line.trim_start().len();
                new_section.push(format!("{}language: {}", " ".repeat(indent), language.unwrap()));
                i += 1;
                continue;
            }
            if trimmed.starts_with("features:") && features.is_some() {
                let indent = line.len() - line.trim_start().len();
                let feats = features.unwrap();
                if feats.is_empty() {
                    new_section.push(format!("{}features: []", " ".repeat(indent)));
                } else {
                    new_section.push(format!("{}features:", " ".repeat(indent)));
                    for f in feats {
                        new_section.push(format!("{}  - {}", " ".repeat(indent), f));
                    }
                }
                // Skip old feature lines
                skip_until_same_indent = Some(indent);
                i += 1;
                continue;
            }
            if trimmed.starts_with("palette:") && palette.is_some() {
                let indent = line.len() - line.trim_start().len();
                let pals = palette.unwrap();
                new_section.push(format!("{}palette:", " ".repeat(indent)));
                for p in pals {
                    if let Some(ref scheme) = p.scheme {
                        new_section.push(format!("{}  - scheme: {}", " ".repeat(indent), scheme));
                    } else {
                        new_section.push(format!("{}  - scheme: default", " ".repeat(indent)));
                    }
                    if let Some(ref primary) = p.primary {
                        new_section.push(format!("{}    primary: {}", " ".repeat(indent), primary));
                    }
                    if let Some(ref accent) = p.accent {
                        new_section.push(format!("{}    accent: {}", " ".repeat(indent), accent));
                    }
                    if let Some(ref toggle) = p.toggle {
                        new_section.push(format!("{}    toggle:", " ".repeat(indent)));
                        if let Some(ref icon) = toggle.icon {
                            new_section.push(format!("{}      icon: {}", " ".repeat(indent), icon));
                        }
                        if let Some(ref name) = toggle.name {
                            new_section.push(format!("{}      name: {}", " ".repeat(indent), yaml_quote(name)));
                        }
                    }
                }
                skip_until_same_indent = Some(indent);
                i += 1;
                continue;
            }

            new_section.push(line.to_string());
            i += 1;
        }

        // Add missing sub-keys that weren't in original
        let theme_indent = 2; // standard YAML indent
        let has_logo = theme_lines.iter().any(|l| l.trim().starts_with("logo:"));
        let has_favicon = theme_lines.iter().any(|l| l.trim().starts_with("favicon:"));
        let has_language = theme_lines.iter().any(|l| l.trim().starts_with("language:"));
        let has_features = theme_lines.iter().any(|l| l.trim().starts_with("features:"));

        if !has_logo && logo.is_some() && !logo.unwrap().is_empty() {
            new_section.push(format!("{}logo: {}", " ".repeat(theme_indent), logo.unwrap()));
        }
        if !has_favicon && favicon.is_some() && !favicon.unwrap().is_empty() {
            new_section.push(format!("{}favicon: {}", " ".repeat(theme_indent), favicon.unwrap()));
        }
        if !has_language && language.is_some() && !language.unwrap().is_empty() {
            new_section.push(format!("{}language: {}", " ".repeat(theme_indent), language.unwrap()));
        }
        if !has_features && features.is_some() {
            let feats = features.unwrap();
            if !feats.is_empty() {
                new_section.push(format!("{}features:", " ".repeat(theme_indent)));
                for f in feats {
                    new_section.push(format!("{}  - {}", " ".repeat(theme_indent), f));
                }
            }
        }

        // Reconstruct
        let mut result: Vec<String> = lines[..theme_start].iter().map(|s| s.to_string()).collect();
        result.extend(new_section);
        for line in &lines[theme_end..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else {
        yaml.to_string()
    }
}

/// Replace the plugins section.
fn replace_plugins_section(yaml: &str, plugins: &[String]) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };

    if let Some((start, end)) = find_section_bounds(&lines, "plugins") {
        let mut result: Vec<String> = lines[..start].iter().map(|s| s.to_string()).collect();
        if plugins.is_empty() {
            result.push("plugins: []".to_string());
        } else {
            result.push("plugins:".to_string());
            for p in plugins {
                result.push(format!("  - {}", p));
            }
        }
        for line in &lines[end..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else if !plugins.is_empty() {
        let pos = find_good_insert_position(&lines.iter().map(|s| *s).collect::<Vec<_>>());
        let mut result: Vec<String> = lines[..pos].iter().map(|s| s.to_string()).collect();
        result.push("plugins:".to_string());
        for p in plugins {
            result.push(format!("  - {}", p));
        }
        result.push(String::new());
        for line in &lines[pos..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else {
        yaml.to_string()
    }
}

/// Replace the markdown_extensions section.
fn replace_extensions_section(yaml: &str, extensions: &[String]) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };

    if let Some((start, end)) = find_section_bounds(&lines, "markdown_extensions") {
        // Preserve extension configs (lines with sub-keys like `toc:\n  permalink: true`)
        // For v1, we keep simple names and preserve complex configs
        let mut result: Vec<String> = lines[..start].iter().map(|s| s.to_string()).collect();
        if extensions.is_empty() {
            result.push("markdown_extensions: []".to_string());
        } else {
            result.push("markdown_extensions:".to_string());
            // Check old section for extensions with configs
            let old_ext_lines = &lines[start + 1..end];
            let mut ext_configs: HashMap<String, Vec<String>> = HashMap::new();
            let mut current_ext: Option<String> = None;

            for line in old_ext_lines {
                let trimmed = line.trim();
                if trimmed.starts_with("- ") {
                    let ext_part = trimmed.trim_start_matches("- ").trim();
                    if ext_part.ends_with(':') {
                        // Extension with config block
                        let name = ext_part.trim_end_matches(':').to_string();
                        current_ext = Some(name.clone());
                        ext_configs.entry(name).or_default();
                    } else {
                        current_ext = None;
                    }
                } else if let Some(ref ext) = current_ext {
                    // Config line for current extension
                    ext_configs.entry(ext.clone()).or_default().push(line.to_string());
                }
            }

            for ext in extensions {
                if let Some(config_lines) = ext_configs.get(ext) {
                    if !config_lines.is_empty() {
                        result.push(format!("  - {}:", ext));
                        for cl in config_lines {
                            result.push(cl.to_string());
                        }
                    } else {
                        result.push(format!("  - {}", ext));
                    }
                } else {
                    result.push(format!("  - {}", ext));
                }
            }
        }
        for line in &lines[end..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else if !extensions.is_empty() {
        let pos = find_good_insert_position(&lines.iter().map(|s| *s).collect::<Vec<_>>());
        let mut result: Vec<String> = lines[..pos].iter().map(|s| s.to_string()).collect();
        result.push("markdown_extensions:".to_string());
        for ext in extensions {
            result.push(format!("  - {}", ext));
        }
        result.push(String::new());
        for line in &lines[pos..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else {
        yaml.to_string()
    }
}

/// Collect all nav paths recursively from parsed YAML.
fn collect_nav_paths_from_value(val: &serde_yaml::Value, out: &mut Vec<String>) {
    match val {
        serde_yaml::Value::String(s) => {
            out.push(s.clone());
        }
        serde_yaml::Value::Mapping(map) => {
            for (_, v) in map {
                collect_nav_paths_from_value(v, out);
            }
        }
        serde_yaml::Value::Sequence(seq) => {
            for item in seq {
                collect_nav_paths_from_value(item, out);
            }
        }
        _ => {}
    }
}

// ── Extra Section Helpers ────────────────────────────────

/// Known keys inside `extra:` that we manage visually.
const KNOWN_EXTRA_KEYS: &[&str] = &[
    "analytics", "social", "consent", "generator", "homepage", "alternate", "mklume_credit",
];

fn parse_extra(map: Option<&serde_yaml::Mapping>) -> ExtraConfig {
    let extra_val = map.and_then(|m| m.get(&serde_yaml::Value::String("extra".to_string())));
    let extra_map = extra_val.and_then(|v| v.as_mapping());

    let extra_map = match extra_map {
        Some(m) => m,
        None => return ExtraConfig::default(),
    };

    let get_str = |m: &serde_yaml::Mapping, key: &str| -> Option<String> {
        m.get(&serde_yaml::Value::String(key.to_string()))
            .and_then(|v| v.as_str())
            .map(String::from)
    };

    // Analytics
    let analytics = extra_map
        .get(&serde_yaml::Value::String("analytics".to_string()))
        .and_then(|v| v.as_mapping())
        .map(|m| ExtraAnalytics {
            provider: get_str(m, "provider"),
            property: get_str(m, "property"),
        });

    // Social
    let social = extra_map
        .get(&serde_yaml::Value::String("social".to_string()))
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|v| {
                    let m = v.as_mapping()?;
                    Some(ExtraSocialLink {
                        icon: get_str(m, "icon"),
                        link: get_str(m, "link"),
                        name: get_str(m, "name"),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    // Consent
    let consent = extra_map
        .get(&serde_yaml::Value::String("consent".to_string()))
        .and_then(|v| v.as_mapping())
        .map(|m| {
            let actions = m
                .get(&serde_yaml::Value::String("actions".to_string()))
                .and_then(|v| v.as_sequence())
                .map(|seq| seq.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            ExtraConsent {
                title: get_str(m, "title"),
                description: get_str(m, "description"),
                actions,
            }
        });

    // Generator
    let generator = extra_map
        .get(&serde_yaml::Value::String("generator".to_string()))
        .and_then(|v| v.as_bool());

    // Homepage
    let homepage = extra_map
        .get(&serde_yaml::Value::String("homepage".to_string()))
        .and_then(|v| v.as_str())
        .map(String::from);

    // MkLume credit
    let mklume_credit = extra_map
        .get(&serde_yaml::Value::String("mklume_credit".to_string()))
        .and_then(|v| v.as_bool());

    // Alternate
    let alternate = extra_map
        .get(&serde_yaml::Value::String("alternate".to_string()))
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|v| {
                    let m = v.as_mapping()?;
                    Some(ExtraAlternate {
                        name: get_str(m, "name"),
                        link: get_str(m, "link"),
                        lang: get_str(m, "lang"),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    // Custom keys (anything not in KNOWN_EXTRA_KEYS)
    let custom: Vec<ExtraCustomEntry> = extra_map
        .iter()
        .filter_map(|(k, v)| {
            let key = k.as_str()?;
            if KNOWN_EXTRA_KEYS.contains(&key) {
                return None;
            }
            let (value_display, is_scalar) = match v {
                serde_yaml::Value::String(s) => (s.clone(), true),
                serde_yaml::Value::Bool(b) => (b.to_string(), true),
                serde_yaml::Value::Number(n) => (n.to_string(), true),
                serde_yaml::Value::Null => ("null".to_string(), true),
                _ => ("[complex value]".to_string(), false),
            };
            Some(ExtraCustomEntry {
                key: key.to_string(),
                value_display,
                is_scalar,
            })
        })
        .collect();

    ExtraConfig {
        analytics,
        social,
        consent,
        generator,
        homepage,
        alternate,
        mklume_credit,
        custom,
    }
}

/// Replace the `extra:` section in YAML, preserving unknown keys.
fn replace_extra_section(yaml: &str, update: &ExtraConfigUpdate, current_yaml: &str) -> String {
    let lines: Vec<&str> = yaml.lines().collect();
    let trailing = if yaml.ends_with('\n') { "\n" } else { "" };

    // Parse current YAML to get existing extra values for preservation
    let current_val: serde_yaml::Value =
        serde_yaml::from_str(current_yaml).unwrap_or(serde_yaml::Value::Null);
    let current_extra = current_val
        .as_mapping()
        .and_then(|m| m.get(&serde_yaml::Value::String("extra".to_string())))
        .and_then(|v| v.as_mapping());

    // Build the new extra map, starting with preserved unknown keys
    let mut extra_lines: Vec<String> = Vec::new();
    let indent = "  ";

    // Collect unknown keys from existing extra to preserve them
    let mut unknown_key_lines: Vec<String> = Vec::new();
    if current_extra.is_some() {
        if let Some((extra_start, extra_end)) = find_section_bounds(&lines, "extra") {
            // Get original YAML lines for unknown keys
            let extra_body = &lines[extra_start + 1..extra_end];
            let mut in_known_section = false;
            let mut known_indent: Option<usize> = None;

            for line in extra_body {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let line_indent = line.len() - line.trim_start().len();

                // Check if this is a known key at the extra level (indent == 2)
                if line_indent == 2 {
                    let key_part = trimmed.split(':').next().unwrap_or("");
                    if KNOWN_EXTRA_KEYS.contains(&key_part) {
                        in_known_section = true;
                        known_indent = Some(line_indent);
                        continue;
                    } else {
                        in_known_section = false;
                        known_indent = None;
                        unknown_key_lines.push(line.to_string());
                        continue;
                    }
                }

                if in_known_section {
                    if let Some(ki) = known_indent {
                        if line_indent > ki {
                            continue; // skip sub-lines of known keys
                        } else {
                            in_known_section = false;
                            known_indent = None;
                            // Check if this line itself is a key
                            let key_part = trimmed.split(':').next().unwrap_or("");
                            if KNOWN_EXTRA_KEYS.contains(&key_part) {
                                in_known_section = true;
                                known_indent = Some(line_indent);
                                continue;
                            }
                            unknown_key_lines.push(line.to_string());
                        }
                    }
                } else {
                    unknown_key_lines.push(line.to_string());
                }
            }
        }
    }

    // --- Build known fields ---

    // Analytics
    match &update.analytics {
        Some(Some(a)) => {
            extra_lines.push(format!("{}analytics:", indent));
            if let Some(ref provider) = a.provider {
                extra_lines.push(format!("{}  provider: {}", indent, provider));
            }
            if let Some(ref property) = a.property {
                extra_lines.push(format!("{}  property: {}", indent, property));
            }
        }
        Some(None) => {
            // Explicitly removed — don't output analytics
        }
        None => {
            // No change — preserve existing
            if let Some(ref existing) = current_extra {
                if existing.get(&serde_yaml::Value::String("analytics".to_string())).is_some() {
                    // Re-emit from original lines
                    if let Some((es, ee)) = find_section_bounds(&lines, "extra") {
                        let body = &lines[es + 1..ee];
                        let mut in_analytics = false;
                        for line in body {
                            let trimmed = line.trim();
                            let li = line.len() - line.trim_start().len();
                            if li == 2 && trimmed.starts_with("analytics:") {
                                in_analytics = true;
                                extra_lines.push(line.to_string());
                                continue;
                            }
                            if in_analytics && li > 2 {
                                extra_lines.push(line.to_string());
                            } else if in_analytics {
                                in_analytics = false;
                            }
                        }
                    }
                }
            }
        }
    }

    // Social
    match &update.social {
        Some(social) => {
            if !social.is_empty() {
                extra_lines.push(format!("{}social:", indent));
                for s in social {
                    if let Some(ref icon) = s.icon {
                        extra_lines.push(format!("{}  - icon: {}", indent, icon));
                    } else {
                        extra_lines.push(format!("{}  - icon: fontawesome/solid/globe", indent));
                    }
                    if let Some(ref link) = s.link {
                        extra_lines.push(format!("{}    link: {}", indent, link));
                    }
                    if let Some(ref name) = s.name {
                        extra_lines.push(format!("{}    name: {}", indent, yaml_quote(name)));
                    }
                }
            }
        }
        None => {
            // Preserve existing
            if let Some(ref existing) = current_extra {
                if existing.get(&serde_yaml::Value::String("social".to_string())).is_some() {
                    if let Some((es, ee)) = find_section_bounds(&lines, "extra") {
                        let body = &lines[es + 1..ee];
                        let mut in_social = false;
                        for line in body {
                            let trimmed = line.trim();
                            let li = line.len() - line.trim_start().len();
                            if li == 2 && trimmed.starts_with("social:") {
                                in_social = true;
                                extra_lines.push(line.to_string());
                                continue;
                            }
                            if in_social && li > 2 {
                                extra_lines.push(line.to_string());
                            } else if in_social && li <= 2 && !trimmed.is_empty() {
                                in_social = false;
                            }
                        }
                    }
                }
            }
        }
    }

    // Consent
    match &update.consent {
        Some(Some(c)) => {
            extra_lines.push(format!("{}consent:", indent));
            if let Some(ref title) = c.title {
                extra_lines.push(format!("{}  title: {}", indent, yaml_quote(title)));
            }
            if let Some(ref desc) = c.description {
                extra_lines.push(format!("{}  description: {}", indent, yaml_quote(desc)));
            }
            if !c.actions.is_empty() {
                extra_lines.push(format!("{}  actions:", indent));
                for a in &c.actions {
                    extra_lines.push(format!("{}    - {}", indent, a));
                }
            }
        }
        Some(None) => {
            // Removed
        }
        None => {
            // Preserve existing
            if let Some(ref existing) = current_extra {
                if existing.get(&serde_yaml::Value::String("consent".to_string())).is_some() {
                    if let Some((es, ee)) = find_section_bounds(&lines, "extra") {
                        let body = &lines[es + 1..ee];
                        let mut in_consent = false;
                        for line in body {
                            let trimmed = line.trim();
                            let li = line.len() - line.trim_start().len();
                            if li == 2 && trimmed.starts_with("consent:") {
                                in_consent = true;
                                extra_lines.push(line.to_string());
                                continue;
                            }
                            if in_consent && li > 2 {
                                extra_lines.push(line.to_string());
                            } else if in_consent && li <= 2 && !trimmed.is_empty() {
                                in_consent = false;
                            }
                        }
                    }
                }
            }
        }
    }

    // Generator
    match &update.generator {
        Some(Some(gen)) => {
            if *gen {
                // generator: true — can omit (default) or explicitly write
                extra_lines.push(format!("{}generator: true", indent));
            } else {
                extra_lines.push(format!("{}generator: false", indent));
            }
        }
        Some(None) => {
            // Removed — default (true), don't emit
        }
        None => {
            // Preserve
            if let Some(ref existing) = current_extra {
                if let Some(v) = existing.get(&serde_yaml::Value::String("generator".to_string())) {
                    if let Some(b) = v.as_bool() {
                        extra_lines.push(format!("{}generator: {}", indent, b));
                    }
                }
            }
        }
    }

    // Homepage
    match &update.homepage {
        Some(Some(url)) => {
            if !url.is_empty() {
                extra_lines.push(format!("{}homepage: {}", indent, url));
            }
        }
        Some(None) => {
            // Removed
        }
        None => {
            if let Some(ref existing) = current_extra {
                if let Some(v) = existing.get(&serde_yaml::Value::String("homepage".to_string())) {
                    if let Some(s) = v.as_str() {
                        extra_lines.push(format!("{}homepage: {}", indent, s));
                    }
                }
            }
        }
    }

    // Alternate
    match &update.alternate {
        Some(alts) => {
            if !alts.is_empty() {
                extra_lines.push(format!("{}alternate:", indent));
                for a in alts {
                    if let Some(ref name) = a.name {
                        extra_lines.push(format!("{}  - name: {}", indent, yaml_quote(name)));
                    } else {
                        extra_lines.push(format!("{}  - name: ''", indent));
                    }
                    if let Some(ref link) = a.link {
                        extra_lines.push(format!("{}    link: {}", indent, link));
                    }
                    if let Some(ref lang) = a.lang {
                        extra_lines.push(format!("{}    lang: {}", indent, lang));
                    }
                }
            }
        }
        None => {
            // Preserve existing
            if let Some(ref existing) = current_extra {
                if existing.get(&serde_yaml::Value::String("alternate".to_string())).is_some() {
                    if let Some((es, ee)) = find_section_bounds(&lines, "extra") {
                        let body = &lines[es + 1..ee];
                        let mut in_alt = false;
                        for line in body {
                            let trimmed = line.trim();
                            let li = line.len() - line.trim_start().len();
                            if li == 2 && trimmed.starts_with("alternate:") {
                                in_alt = true;
                                extra_lines.push(line.to_string());
                                continue;
                            }
                            if in_alt && li > 2 {
                                extra_lines.push(line.to_string());
                            } else if in_alt && li <= 2 && !trimmed.is_empty() {
                                in_alt = false;
                            }
                        }
                    }
                }
            }
        }
    }

    // MkLume credit (stored as extra.mklume_credit: true/false)
    match &update.mklume_credit {
        Some(Some(val)) => {
            extra_lines.push(format!("{}mklume_credit: {}", indent, val));
        }
        Some(None) => {
            // Removed — don't emit
        }
        None => {
            // Preserve
            if let Some(ref existing) = current_extra {
                if let Some(v) = existing.get(&serde_yaml::Value::String("mklume_credit".to_string())) {
                    if let Some(b) = v.as_bool() {
                        extra_lines.push(format!("{}mklume_credit: {}", indent, b));
                    }
                }
            }
        }
    }

    // Append unknown key lines
    extra_lines.extend(unknown_key_lines);

    // Build final YAML
    if extra_lines.is_empty() {
        // No extra section needed — remove it if it exists
        if let Some((start, end)) = find_section_bounds(&lines, "extra") {
            let mut result: Vec<String> = lines[..start].iter().map(|s| s.to_string()).collect();
            for line in &lines[end..] {
                result.push(line.to_string());
            }
            return result.join("\n") + trailing;
        }
        return yaml.to_string();
    }

    // Write extra section
    let mut new_section = vec!["extra:".to_string()];
    new_section.extend(extra_lines);

    if let Some((start, end)) = find_section_bounds(&lines, "extra") {
        let mut result: Vec<String> = lines[..start].iter().map(|s| s.to_string()).collect();
        result.extend(new_section);
        for line in &lines[end..] {
            result.push(line.to_string());
        }
        result.join("\n") + trailing
    } else {
        // No existing extra section — append at end
        let mut result: Vec<String> = lines.iter().map(|s| s.to_string()).collect();
        result.push(String::new());
        result.extend(new_section);
        result.join("\n") + trailing
    }
}

// ── Tauri Commands ───────────────────────────────────────

#[tauri::command]
pub fn read_site_config(config_path: String) -> Result<SiteConfig, String> {
    let path = PathBuf::from(&config_path);
    if !path.exists() {
        return Err("No mkdocs.yml found in this project.".to_string());
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Could not read {}: {}", path.display(), e))?;

    let val: serde_yaml::Value = serde_yaml::from_str(&raw)
        .map_err(|e| format!("Invalid YAML in mkdocs.yml: {}", e))?;

    let map = val.as_mapping();

    let get_str = |key: &str| -> Option<String> {
        map.and_then(|m| m.get(&serde_yaml::Value::String(key.to_string())))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };

    let theme = map.and_then(|m| m.get(&serde_yaml::Value::String("theme".to_string())));
    let theme_map = theme.and_then(|t| t.as_mapping());

    let theme_get_str = |key: &str| -> Option<String> {
        theme_map.and_then(|m| m.get(&serde_yaml::Value::String(key.to_string())))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };

    // Parse features
    let features = theme_map
        .and_then(|m| m.get(&serde_yaml::Value::String("features".to_string())))
        .and_then(|v| v.as_sequence())
        .map(|seq| seq.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    // Parse palette
    let palette = parse_palette(theme_map);

    // Parse plugins
    let plugins = map
        .and_then(|m| m.get(&serde_yaml::Value::String("plugins".to_string())))
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter().filter_map(|v| {
                if let Some(s) = v.as_str() {
                    Some(s.to_string())
                } else if let Some(m) = v.as_mapping() {
                    m.keys().next().and_then(|k| k.as_str()).map(String::from)
                } else {
                    None
                }
            }).collect()
        })
        .unwrap_or_default();

    // Parse markdown_extensions
    let markdown_extensions = map
        .and_then(|m| m.get(&serde_yaml::Value::String("markdown_extensions".to_string())))
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter().filter_map(|v| {
                if let Some(s) = v.as_str() {
                    Some(s.to_string())
                } else if let Some(m) = v.as_mapping() {
                    m.keys().next().and_then(|k| k.as_str()).map(String::from)
                } else {
                    None
                }
            }).collect()
        })
        .unwrap_or_default();

    // Parse extra_css
    let extra_css = map
        .and_then(|m| m.get(&serde_yaml::Value::String("extra_css".to_string())))
        .and_then(|v| v.as_sequence())
        .map(|seq| seq.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    // Parse extra
    let extra = parse_extra(map);

    Ok(SiteConfig {
        site_name: get_str("site_name"),
        site_description: get_str("site_description"),
        site_author: get_str("site_author"),
        site_url: get_str("site_url"),
        repo_url: get_str("repo_url"),
        repo_name: get_str("repo_name"),
        edit_uri: get_str("edit_uri"),
        copyright: get_str("copyright"),
        theme_name: theme_get_str("name"),
        theme_logo: theme_get_str("logo"),
        theme_favicon: theme_get_str("favicon"),
        theme_language: theme_get_str("language"),
        features,
        palette,
        plugins,
        markdown_extensions,
        extra_css,
        extra,
        raw_yaml: raw,
    })
}

fn parse_palette(theme_map: Option<&serde_yaml::Mapping>) -> Vec<PaletteEntry> {
    let palette_val = theme_map
        .and_then(|m| m.get(&serde_yaml::Value::String("palette".to_string())));

    match palette_val {
        Some(serde_yaml::Value::Sequence(seq)) => {
            seq.iter().filter_map(|v| {
                let m = v.as_mapping()?;
                let get = |key: &str| -> Option<String> {
                    m.get(&serde_yaml::Value::String(key.to_string()))
                        .and_then(|v| v.as_str())
                        .map(String::from)
                };
                let toggle = m.get(&serde_yaml::Value::String("toggle".to_string()))
                    .and_then(|t| t.as_mapping())
                    .map(|tm| PaletteToggle {
                        icon: tm.get(&serde_yaml::Value::String("icon".to_string()))
                            .and_then(|v| v.as_str()).map(String::from),
                        name: tm.get(&serde_yaml::Value::String("name".to_string()))
                            .and_then(|v| v.as_str()).map(String::from),
                    });
                Some(PaletteEntry {
                    scheme: get("scheme"),
                    primary: get("primary"),
                    accent: get("accent"),
                    toggle,
                })
            }).collect()
        }
        Some(serde_yaml::Value::Mapping(m)) => {
            // Single palette entry (not array)
            let get = |key: &str| -> Option<String> {
                m.get(&serde_yaml::Value::String(key.to_string()))
                    .and_then(|v| v.as_str())
                    .map(String::from)
            };
            vec![PaletteEntry {
                scheme: get("scheme"),
                primary: get("primary"),
                accent: get("accent"),
                toggle: None,
            }]
        }
        _ => Vec::new(),
    }
}

#[tauri::command]
pub fn write_site_config(config_path: String, updates: SiteConfigUpdate) -> Result<(), String> {
    let path = PathBuf::from(&config_path);
    let mut yaml = std::fs::read_to_string(&path)
        .map_err(|e| format!("Could not read {}: {}", path.display(), e))?;

    // Validate that original file is valid YAML
    let _: serde_yaml::Value = serde_yaml::from_str(&yaml)
        .map_err(|e| format!("Cannot update invalid YAML: {}", e))?;

    // Apply scalar field updates
    let scalar_fields: Vec<(&str, &Option<String>)> = vec![
        ("site_name", &updates.site_name),
        ("site_description", &updates.site_description),
        ("site_author", &updates.site_author),
        ("site_url", &updates.site_url),
        ("repo_url", &updates.repo_url),
        ("repo_name", &updates.repo_name),
        ("edit_uri", &updates.edit_uri),
        ("copyright", &updates.copyright),
    ];

    for (key, val) in scalar_fields {
        if let Some(v) = val {
            if v.is_empty() {
                yaml = remove_scalar_field(&yaml, key);
            } else {
                yaml = replace_scalar_field(&yaml, key, v);
            }
        }
    }

    // Apply theme sub-field updates
    let has_theme_changes = updates.theme_logo.is_some()
        || updates.theme_favicon.is_some()
        || updates.theme_language.is_some()
        || updates.features.is_some()
        || updates.palette.is_some();

    if has_theme_changes {
        yaml = replace_theme_section(
            &yaml,
            updates.theme_logo.as_deref(),
            updates.theme_favicon.as_deref(),
            updates.theme_language.as_deref(),
            updates.features.as_deref(),
            updates.palette.as_deref(),
        );
    }

    // Apply plugins update
    if let Some(ref plugins) = updates.plugins {
        yaml = replace_plugins_section(&yaml, plugins);
    }

    // Apply extensions update
    if let Some(ref extensions) = updates.markdown_extensions {
        yaml = replace_extensions_section(&yaml, extensions);
    }

    // Apply extra update
    if let Some(ref extra_update) = updates.extra {
        let original_yaml = std::fs::read_to_string(&path)
            .map_err(|e| format!("Could not re-read {}: {}", path.display(), e))?;
        yaml = replace_extra_section(&yaml, extra_update, &original_yaml);
    }

    // ── MkLume footer credit ────────────────────────────
    // When extra.mklume_credit is toggled, append or remove the credit
    // line from the copyright field. The credit suffix is clearly
    // delimited so we never corrupt user-written copyright text.
    if let Some(ref extra_update) = updates.extra {
        if let Some(ref credit_opt) = extra_update.mklume_credit {
            let credit_suffix = "<br>Built with <a href=\"https://github.com/ecalstudios/mklume\">MkLume</a>";
            // Read current copyright from the YAML we've built so far
            let parsed: serde_yaml::Value = serde_yaml::from_str(&yaml).unwrap_or_default();
            let current_copyright = parsed.as_mapping()
                .and_then(|m| m.get(&serde_yaml::Value::String("copyright".to_string())))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            match credit_opt {
                Some(true) => {
                    // Add credit if not already present
                    if !current_copyright.contains("Built with <a href=") || !current_copyright.contains("MkLume") {
                        let new_copyright = if current_copyright.is_empty() {
                            format!("Built with <a href=\"https://github.com/ecalstudios/mklume\">MkLume</a>")
                        } else {
                            format!("{}{}", current_copyright, credit_suffix)
                        };
                        yaml = replace_scalar_field(&yaml, "copyright", &new_copyright);
                    }
                }
                Some(false) | None => {
                    // Remove credit suffix if present
                    if current_copyright.contains(credit_suffix) {
                        let cleaned = current_copyright.replace(credit_suffix, "");
                        if cleaned.is_empty() {
                            yaml = remove_scalar_field(&yaml, "copyright");
                        } else {
                            yaml = replace_scalar_field(&yaml, "copyright", &cleaned);
                        }
                    }
                    // Also handle the standalone case (no other copyright text)
                    if current_copyright == "Built with <a href=\"https://github.com/ecalstudios/mklume\">MkLume</a>" {
                        yaml = remove_scalar_field(&yaml, "copyright");
                    }
                }
            }
        }
    }

    // Validate the result is still valid YAML
    let _: serde_yaml::Value = serde_yaml::from_str(&yaml)
        .map_err(|e| format!("Generated invalid YAML (changes not saved): {}", e))?;

    std::fs::write(&path, &yaml)
        .map_err(|e| format!("Could not write {}: {}", path.display(), e))?;

    Ok(())
}

#[tauri::command]
pub fn list_docs_pages(docs_dir: String, config_path: String) -> Result<Vec<DocsPageInfo>, String> {
    let docs_path = PathBuf::from(&docs_dir);
    if !docs_path.exists() {
        return Err("Docs directory not found.".to_string());
    }

    // Collect nav paths from config
    let config_content = std::fs::read_to_string(&config_path).unwrap_or_default();
    let val: serde_yaml::Value = serde_yaml::from_str(&config_content)
        .unwrap_or(serde_yaml::Value::Null);
    let mut nav_paths: Vec<String> = Vec::new();
    if let Some(nav) = val.get("nav") {
        collect_nav_paths_from_value(nav, &mut nav_paths);
    }

    // Scan docs directory
    let mut pages: Vec<DocsPageInfo> = Vec::new();
    for entry in WalkDir::new(&docs_path)
        .sort_by_file_name()
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if ext == "md" {
                    let rel = entry.path().strip_prefix(&docs_path)
                        .map(|p| p.to_string_lossy().replace('\\', "/"))
                        .unwrap_or_default();
                    let in_nav = nav_paths.iter().any(|p| p == &rel);
                    pages.push(DocsPageInfo {
                        relative_path: rel,
                        in_nav,
                    });
                }
            }
        }
    }

    Ok(pages)
}
