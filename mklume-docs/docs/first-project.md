# Your First Project

This guide walks you through creating a brand-new documentation project in MkLume.

![MkLume welcome screen with Create New Project option](assets/welcome-screen.png)

## Start the New Project wizard

From the **Welcome Screen**, click **Create New Project**. This opens the New Project dialog.

If you already have a project open, you can also start a new project from the top menu.

## Fill in your project details

The New Project wizard asks for a few things:

### Site name

The name of your documentation site. This becomes the `site_name` value in your `mkdocs.yml` and appears as the title in your site's header and browser tab.

!!! example
    If you're documenting a project called "Widgets API", you might set the site name to `Widgets API Docs`.

### Project folder

Choose where MkLume should create your project. MkLume will create files inside this folder, so pick an empty folder or let MkLume create a new one for you.

!!! warning
    If you select a folder that already contains files, MkLume will add its files alongside them. It won't overwrite existing files, but it's cleaner to start with an empty folder.

### Site description

An optional description for your site. This is used in the `site_description` field of `mkdocs.yml` and may appear in search engine results.

### MkLume credit

You can optionally include a small "Made with MkLume" credit in your site's footer. This is entirely optional and can be removed at any time through the site settings.

## What MkLume creates

When you click **Create**, MkLume generates a minimal project structure:

```
your-project/
├── mkdocs.yml
└── docs/
    └── index.md
```

### mkdocs.yml

This is the MkDocs configuration file. MkLume sets it up with sensible defaults:

- Your site name and description
- The Material theme with a default color scheme
- Common Markdown extensions (admonitions, code highlighting, etc.)

You can adjust all of these later through MkLume's **Settings** panel.

### docs/index.md

This is your site's home page. MkLume creates a starter page with your site name as a heading and a brief placeholder paragraph. Replace this content with your own.

## Next steps

Once your project is created, you're in the editor and ready to go:

- **Add pages** — Use the sidebar to create new pages and organize your navigation
- **Edit content** — Write in Visual or Markdown mode
- **Configure your site** — Open the Settings panel to adjust theme colors, navigation, and other options
- **Preview** — See how your page looks in the built-in preview
- **Build** — When you're ready, build your site to generate the final HTML output

For a full walkthrough of the editing workflow, see [Getting Started](getting-started.md).
