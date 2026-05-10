# Open Existing Project

If you already have an MkDocs project, you can open it directly in MkLume.

## Opening a project

From the **Welcome Screen**, click **Open Existing Project** and select the folder that contains your `mkdocs.yml` file.

MkLume looks for a `mkdocs.yml` in the root of the folder you select. If it doesn't find one, it will let you know.

!!! tip
    Point MkLume at the **root folder** of your MkDocs project — the one that directly contains `mkdocs.yml`, not a subfolder inside it.

## Recent projects

MkLume remembers projects you've opened before. The Welcome Screen shows your recent projects so you can reopen them with a single click.

If a recent project's folder has been moved or deleted, MkLume will flag it as unavailable.

## What MkLume reads from your project

When you open a project, MkLume reads your `mkdocs.yml` to understand your site's configuration:

| What MkLume reads | How it's used |
|---|---|
| `site_name` | Displayed in the editor header |
| `site_description` | Shown in the Settings panel |
| `docs_dir` | Where MkLume looks for your Markdown files (defaults to `docs/`) |
| `nav` | Used to build the sidebar page tree |
| `theme` | Theme settings shown in the Settings panel |
| `extra` | Extras & integrations shown in Settings |
| `markdown_extensions` | Informs editor behavior and preview rendering |

If your `mkdocs.yml` contains settings that MkLume doesn't have a visual editor for, those settings are preserved as-is. MkLume won't remove or overwrite configuration it doesn't manage.

## Projects without a nav section

If your `mkdocs.yml` doesn't include a `nav` section, MkLume reads the file structure inside your `docs_dir` and builds the sidebar from the files it finds. MkDocs itself does the same thing when no `nav` is defined.

## Compatibility notes

MkLume is designed for projects that use the **MkDocs Material** theme. Projects using other MkDocs themes will open, but some features — particularly the visual preview and theme settings — may not work as expected.

!!! note
    MkLume reads and writes standard `mkdocs.yml` files. Your project remains a normal MkDocs project that you can build and serve with the `mkdocs` CLI at any time. MkLume doesn't lock you in.

## Next steps

- [Getting Started](getting-started.md) — Learn the editing workflow
- [Your First Project](first-project.md) — Starting from scratch instead? See the new project guide
