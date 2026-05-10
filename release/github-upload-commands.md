# MkLume v1.0.0 — GitHub Source Upload Commands

## Repository

https://github.com/ECalStudios/mklume

## Prerequisites

- Git installed
- GitHub account with push access to ECalStudios/mklume
- Remote origin configured:
  ```bash
  git remote add origin https://github.com/ECalStudios/mklume.git
  ```

## Upload Steps

1. Verify you are on the correct branch with all changes staged:
   ```bash
   git status
   git log --oneline -10
   ```

2. Push to GitHub:
   ```bash
   git push -u origin main
   ```

3. Verify on GitHub that all files are present and no secrets are exposed.

## What Must Be Committed

- All source code (src/, src-tauri/)
- Package files (package.json, Cargo.toml, etc.)
- Documentation source (mklume-docs/)
- GitHub templates (.github/)
- Scripts (scripts/)
- Sidecar binary: `src-tauri/binaries/mkdocs-runner-x86_64-pc-windows-msvc.exe`
  (Required by Tauri's externalBin for builds)
- Icon assets (src-tauri/icons/)
- Release files (release/)
- README.md, LICENSE, CONTRIBUTING.md, SECURITY.md

## What Must NOT Be Committed

- Installer artifacts (*.exe, *.msi in target/release/bundle/)
- Desktop staging folder
- Node modules (node_modules/)
- Rust build output (src-tauri/target/)
- Python venv (tools/mkdocs-runner/.venv/)
- PyInstaller build output (tools/mkdocs-runner/build/, dist/, *.spec)
- .claude/ directory
- .env files or secrets
