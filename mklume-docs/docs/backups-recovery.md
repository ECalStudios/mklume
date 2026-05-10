# Backups & Recovery

MkLume includes built-in safety features to protect your work. Autosave, backup copies, and recovery drafts work together to make sure you do not lose content due to crashes, accidental overwrites, or forgetting to save.

All backup and recovery data is stored locally inside your project directory. Nothing is sent anywhere.

## Autosave

Autosave automatically saves your current file after a configurable delay. When you stop typing, MkLume waits for the specified interval and then saves. This means your work is preserved even if you forget to press Ctrl+S.

You can adjust the autosave delay or disable autosave entirely in Settings.

## Backup Before Save

When this feature is enabled, MkLume creates a timestamped copy of the existing file before overwriting it with your new changes. If you ever need to go back to the previous version of a file, the backup is there.

Backup files are named with timestamps so you can identify exactly when each version was saved.

!!! tip "A safety net for every save"
    With backup-before-save enabled, every time you save a file, MkLume keeps a copy of the previous version. This gives you a straightforward undo path if you realize you saved over something you needed.

## Recovery Drafts

Recovery drafts are periodic snapshots of your unsaved content. While you are editing, MkLume saves a draft of your current work at regular intervals, separate from the actual file. This protects against application crashes or unexpected shutdowns.

### Recovery Draft Prompt

When you open a page that has a recovery draft newer than the saved file, MkLume offers to restore it. You can choose to load the recovery draft or discard it and keep the saved version.

This is useful when MkLume closes unexpectedly. The next time you open the project, any unsaved work is available for recovery.

## Storage Locations

All backup and recovery data lives inside your project folder:

| Feature | Location |
|---------|----------|
| Backups | `.mklume/backups/` in your project root |
| Recovery drafts | `.mklume/recovery/` in your project root |

!!! info "Everything stays in your project"
    MkLume does not use cloud storage, external servers, or any location outside your project directory for backups. Your data stays on your machine, in your project folder.

## Accessing Backup and Recovery Folders

You can open the backup and recovery folders directly from the **File** menu. This gives you quick access to browse previous versions or recovery drafts using your system file manager.

## Settings

Each feature can be enabled or disabled independently:

- **Autosave** -- Toggle on or off, and set the delay before saving
- **Backup before save** -- Toggle on or off
- **Recovery drafts** -- Toggle on or off

These settings are available in the Settings panel.

!!! note "Recommended defaults"
    All three features are designed to work together. Keeping them all enabled gives you the best protection: autosave catches forgotten saves, backup-before-save preserves previous versions, and recovery drafts protect against crashes.

## Privacy

MkLume does not collect analytics or telemetry. Backup and recovery data is stored only in your project's `.mklume/` directory. No data leaves your computer.
