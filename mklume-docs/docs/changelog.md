# Changelog

## 1.0.1 — Unreleased

Visual mode rendering and editing polish patch.

- Improved Visual mode rendering for MkDocs Material card grids.
- Added real image thumbnail rendering in Visual mode where image paths can be resolved.
- Improved card image fit/cropping to better match MkDocs Material output.
- Improved rendering of inline links/images inside visual cards.
- Improved spacing for card descriptions and link rows.
- Improved Preview rendering for card descriptions.
- Improved icon shortcode rendering in Visual mode and Preview mode.
- Added icon insertion through Insert menu and slash command in Visual mode.
- Unsupported icons now show a clean fallback.
- Improved Visual mode block action button visibility in dark mode.
- Removed old temporary icon-generation scripts from source.
- No change to Markdown source format.
- No change to bundled MkDocs runtime behavior.

## 1.0.0

First public release of MkLume.

### Editing
- Markdown Mode with toolbar, keyboard shortcuts, and Insert menu for Material components
- Visual Editor with 18+ block types including admonitions, content tabs, grid cards, and tables
- Page Preview with rendered Markdown, images, and Material styling
- Site Preview with approximate MkDocs Material site layout (header, sidebar, TOC, footer)
- Flexible Split View with four editor/preview combinations
- Find and Replace in Markdown Mode
- Smart internal link autocomplete (`[[` and `[Text](` triggers)
- Drag-and-drop image handling with automatic copy to `docs/assets/`

### Project Management
- Site Settings editor for `mkdocs.yml` (identity, theme, features, palette, plugins, extensions, extras)
- Navigation editor with drag-and-drop reordering, add/remove pages, and section management
- Project Health scanner (broken links, missing images, nav issues, extensions, SEO checks)
- Extras & Integrations panel (analytics, social links, consent, MkLume credit)

### Build & Deploy
- Build to folder, ZIP, or both (bundled MkDocs runtime — no separate install needed)
- MkDocs Serve for local preview (bundled MkDocs runtime)
- Git Sync (commit and push, no force push or destructive operations; requires Git)
- GitHub Pages Deploy Assistant (generates workflow file, no tokens required)

### Reliability
- Autosave with configurable delay
- Backup before save with timestamped copies
- Recovery drafts for crash protection
- Command Palette (`Ctrl+K`)
- Light and Dark mode with system preference detection

### Help & Documentation
- Offline Quick Help (bundled, works without internet)
- Full online documentation at [ecalstudios.com/mklume](https://www.ecalstudios.com/mklume/)
- Public GitHub repository with issue templates
