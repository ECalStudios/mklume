# Changelog

All notable changes to MkLume will be documented in this file.

## 1.0.1 - Unreleased

### Visual Mode Improvements
- Improved Visual mode rendering for MkDocs Material card grids.
- Added real image thumbnail rendering in Visual mode where image paths can be resolved.
- Added cleaner missing image fallback for Visual mode card images.
- Improved card image fit/cropping to better match MkDocs Material output.
- Improved rendering of inline links/images inside visual cards.
- Improved spacing for card descriptions and Docs/Fab link rows.
- Improved Preview rendering for card descriptions.

### Icon Improvements
- Improved icon shortcode rendering in Visual mode and Preview mode.
- Added icon insertion through Insert menu and slash command in Visual mode.
- Unsupported icons now show a clean fallback instead of dark squares.
- Added support for additional Material, Octicons, and FontAwesome icon shortcodes.

### UI Improvements
- Improved Visual mode block action button visibility in dark mode.
- Block controls now have visible backgrounds and borders for better discoverability.
- Increased block control hit areas for easier interaction.

### Cleanup
- Removed old temporary icon-generation scripts from source.
- No change to Markdown source format.
- No change to bundled MkDocs runtime behavior.

## 1.0.0 - 2025-05-14

First public release of MkLume.

### Editing
- Markdown Mode with toolbar, keyboard shortcuts, and Insert menu for Material components.
- Visual Editor with 18+ block types including admonitions, content tabs, grid cards, and tables.
- Page Preview with rendered Markdown, images, and Material styling.
- Site Preview with approximate MkDocs Material site layout.
- Flexible Split View with four editor/preview combinations.
- Find and Replace in Markdown Mode.
- Smart internal link autocomplete.
- Drag-and-drop image handling with automatic copy to docs/assets/.

### Project Management
- Site Settings editor for mkdocs.yml.
- Navigation editor with drag-and-drop reordering.
- Project Health scanner.
- Extras and Integrations panel.

### Build and Deploy
- Build to folder, ZIP, or both with bundled MkDocs runtime.
- MkDocs Serve for local preview.
- Git Sync for commit and push.
- GitHub Pages Deploy Assistant.

### Reliability
- Autosave with configurable delay.
- Backup and recovery system.
- Offline Quick Help.
