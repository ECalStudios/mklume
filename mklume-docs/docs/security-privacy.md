# Security & Privacy

MkLume is a **local-first** desktop application. Your files, your machine, your control.

## How MkLume handles your data

### Everything stays on your computer

MkLume edits Markdown files directly on your local filesystem. There is no cloud backend, no remote database, and no sync service built into the app.

- **No cloud login required.** MkLume does not ask you to create an account or sign in to any service.
- **No GitHub tokens.** MkLume does not request or store GitHub personal access tokens, OAuth tokens, or API keys of any kind.
- **No hosting credentials.** MkLume does not store passwords, SSH keys, or deployment secrets.
- **No data sent to ECal Studios or any third party.** Your content never leaves your machine through MkLume.

### Git operations

MkLume's Git Sync feature works by calling your **local Git installation**. Authentication is handled entirely by your system's Git configuration (SSH keys, credential manager, etc.). MkLume itself never sees or stores your Git credentials.

### External links

Support links, documentation links, and similar references open externally in your default web browser. MkLume does not embed external web content inside the app.

### Analytics configuration

The analytics settings available in **Site Settings** (such as Google Analytics or Plausible) apply **only to your generated MkDocs site** — the documentation website you build and publish. These settings do not affect MkLume itself in any way.

!!! info "No built-in telemetry"
    MkLume does not include built-in telemetry in the current version. The app does not phone home, track usage patterns, or collect crash reports automatically.

## Recovery and backups

MkLume stores recovery drafts and backups **locally** inside your project directory, in the `.mklume/` folder:

- `.mklume/backups/` — periodic file backups
- `.mklume/recovery/` — unsaved draft recovery files

These files never leave your machine.

## File access boundaries

MkLume's file operations stay within the boundaries of your open project directory. The app reads and writes files inside your docs folder and project root as needed for editing, building, and configuration. It does not scan, index, or access files outside your project.

## Review before publishing

MkLume builds your documentation into a static site, but it does not verify the final output for you. Always review your built site — either with `mkdocs serve` or by opening the generated HTML files — before uploading it to a public host.

## Summary

| Concern | MkLume behavior |
|---|---|
| Cloud account | Not required |
| Tokens or API keys | Not requested or stored |
| Hosting credentials | Not stored |
| Telemetry | None in current version |
| Data sharing | No data sent externally |
| Git credentials | Handled by your local Git, not MkLume |
| Backups | Stored locally in `.mklume/` |
| File access | Scoped to your project directory |
| Before publishing | Review your built site first |
