<p align="center">
  <img src="src-tauri/icons/icon.png" alt="MkLume" width="128" height="128">
</p>

<h1 align="center">MkLume</h1>

<p align="center">
  <strong>A visual desktop editor for MkDocs Material documentation.</strong>
</p>

<p align="center">
  <a href="https://www.ecalstudios.com/mklume/">Documentation</a> ·
  <a href="https://github.com/ECalStudios/mklume">GitHub</a> ·
  <a href="https://ko-fi.com/ecalstudios">Support Development</a> ·
  <a href="#license">License</a>
</p>

---

MkLume is a local-first desktop workspace for creating, editing, previewing, and managing [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) documentation projects. It runs on your computer, edits your files directly, and never asks for cloud credentials or tokens.

Built with [Tauri](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/).

> **Current release:** v1.0.1 (Windows). macOS and Linux packages are planned.

## Features

### Editing

- **Markdown Mode** — Raw Markdown editing with a toolbar, keyboard shortcuts, and insert menu for admonitions, tabs, tables, grid cards, and more.
- **Visual Mode** — Block-based visual editor with 18+ block types. Edit headings, paragraphs, images, code blocks, admonitions, and lists visually.
- **Preview Mode** — Rendered Markdown preview with image resolution, admonition rendering, and icon shortcodes.
- **Site Preview** — Approximate MkDocs Material site layout with header, sidebar navigation, content area, table of contents, and footer — all inside the editor.
- **Flexible Split View** — Side-by-side editing and preview with four combinations: Markdown/Page Preview, Markdown/Site Preview, Visual/Page Preview, Visual/Site Preview.

### Asset Management

- **Drag-and-Drop Images** — Drop images onto the editor. MkLume copies them to `docs/assets/` and inserts the Markdown automatically.
- **Smart Internal Links** — Type `[[` or `[Text](` to trigger page autocomplete. Links use correct relative paths.

### Project Management

- **Site Settings Editor** — Edit `mkdocs.yml` visually: site identity, theme, Material features, palette, plugins, extensions, and extras.
- **Navigation Editor** — Drag-and-drop reordering, add/remove pages, create groups, clean up missing entries.
- **Project Health** — Scan for broken links, missing images, nav issues, extension problems, and content warnings with one-click fixes.

### Build & Deploy

- **Build Export** — Build your site to a folder, ZIP, or both. Upload the output to any static hosting provider.
- **MkDocs Serve** — Start a local preview server and open it in your browser.
- **Git Sync** — Commit and push from within MkLume. No force push, no destructive operations.
- **GitHub Pages Deploy Assistant** — Generate a GitHub Actions workflow for automated deployment. No tokens, no passwords, no OAuth required.

### Reliability

- **Autosave** — Configurable automatic saving.
- **Backups** — Timestamped backup copies before each save.
- **Recovery Drafts** — Periodic snapshots of unsaved work, restored on next launch.
- **Command Palette** — Quick access to every command with `Ctrl+K` or `Ctrl+Shift+P`.
- **Light & Dark Mode** — Full theme support with system preference detection.

## Download

Download the latest release from [GitHub Releases](https://github.com/ECalStudios/mklume/releases).

**No developer tools required.** The Windows installer includes everything needed for editing, previewing, building, and managing MkDocs Material documentation. No Python, MkDocs, or developer tools need to be installed separately.

## Build from Source (Developers)

These instructions are for developers who want to build MkLume from source code. **Normal users should use the installer instead.**

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform
- [Python](https://www.python.org/) and [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) (for build/serve features)

### Steps

```bash
# Clone the repository
git clone https://github.com/ECalStudios/mklume.git
cd mklume

# Install dependencies
npm install

# Run in development mode
npx tauri dev

# Build for production
npx tauri build
```

For MkDocs build and serve features:

```bash
pip install mkdocs mkdocs-material
```

## Documentation

Full documentation is available at:

**[https://www.ecalstudios.com/mklume/](https://www.ecalstudios.com/mklume/)**

## Security & Privacy

MkLume is local-first:

- Edits files on your computer — no cloud sync required.
- Does not ask for GitHub tokens, passwords, or API keys.
- Does not store hosting credentials.
- Git operations use your local Git installation and its configured authentication.
- MkLume does not include built-in telemetry in the current version.
- Backups and recovery drafts are stored locally in your project directory.

The analytics configuration in Site Settings applies only to your generated MkDocs site — not to MkLume itself.

## Contributing

Contributions are welcome. Please see the [Contributing Guide](https://www.ecalstudios.com/mklume/contributing/) for details.

- Report bugs and request features via [GitHub Issues](https://github.com/ECalStudios/mklume/issues).
- Fork the repository, create a branch, and submit a pull request.
- All contributions are licensed under GPLv3.

## Support

MkLume is free and open source. If it helps your documentation workflow, you can support development:

**[Support MkLume on Ko-fi](https://ko-fi.com/ecalstudios)**

## License

MkLume is licensed under the [GNU General Public License v3.0](LICENSE).

Copyright © 2026 [ECal Studios](https://www.ecalstudios.com/). Created by Enrique Cal.

## Third-Party Notice

MkLume is not affiliated with [MkDocs](https://www.mkdocs.org/), [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/), [Git](https://git-scm.com/), [GitHub](https://github.com/), or their respective maintainers. These are independent open-source projects with their own licenses.
