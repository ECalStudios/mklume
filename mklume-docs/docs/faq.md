# Frequently Asked Questions

## Is MkLume free?

Yes. MkLume is free and open-source software, licensed under the [GPLv3](open-source.md).

## Is MkLume open source?

Yes. The [source code is available on GitHub](https://github.com/ECalStudios/mklume) under the GNU General Public License v3.0. You can view, modify, and distribute it under the terms of that license.

## Does MkLume require GitHub?

No. MkLume works with **any Git hosting provider** (GitHub, GitLab, Bitbucket, self-hosted, etc.) or with no Git hosting at all. Git integration is entirely optional.

## Does MkLume require tokens or API keys?

No. MkLume does not ask for tokens, passwords, or API keys. Git authentication is handled by your local Git installation and its credential management, not by MkLume.

## Does MkLume support non-Material themes?

MkLume is designed for and optimized for **Material for MkDocs**. Basic Markdown editing works with any MkDocs project, but features like Site Settings and theme-specific previews are tailored to Material.

## Does MkLume replace MkDocs?

No. MkLume is a **visual editor** that works alongside MkDocs. It provides a graphical interface for editing Markdown, managing site settings, and previewing your documentation. MkDocs still handles the actual site generation and serving.

## Can I use MkLume commercially?

Yes. The GPLv3 license allows commercial use. You can use MkLume to create and manage documentation for commercial projects.

## Can I remove the "Built with MkLume" footer?

Yes. The footer credit is optional and can be toggled off in **Site Settings**. It is there by default as a way to support the project, but you are free to remove it.

## Where are backups stored?

Backups and recovery drafts are stored locally inside your project directory:

- **Backups:** `.mklume/backups/`
- **Recovery drafts:** `.mklume/recovery/`

These files stay on your machine and are never uploaded anywhere.

## Does MkLume work offline?

Yes, for editing. You can open, edit, and save Markdown files without an internet connection. Features that interact with remote services — such as Git push/pull and deployment — require internet access.

## Does MkLume collect analytics or telemetry?

No. MkLume itself does not collect analytics, usage data, or telemetry of any kind.

!!! info
    The analytics options in Site Settings (Google Analytics, Plausible, etc.) apply to **your generated MkDocs site**, not to MkLume itself.

## Can I publish my docs without GitHub?

Yes. Use MkLume's **Build** feature to generate a static site, then upload the output to any static hosting provider — Netlify, Cloudflare Pages, your own server, or anywhere that serves HTML files. GitHub Pages is one option, but it is not required.

## Is MkLume affiliated with MkDocs or Material for MkDocs?

No. MkLume is an independent project built for MkDocs Material projects. It is not affiliated with, endorsed by, or officially connected to [MkDocs](https://www.mkdocs.org/), [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/), [Git](https://git-scm.com/), [GitHub](https://github.com/), or their respective maintainers.
