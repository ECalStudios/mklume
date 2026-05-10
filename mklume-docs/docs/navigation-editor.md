# Navigation Editor

MkLume gives you a visual way to manage your site's navigation structure. The sidebar shows your documentation's nav tree as defined in `mkdocs.yml`, and you can reorganize it without editing YAML by hand.

## Navigation tree

The sidebar displays your project's navigation as a tree, mirroring the `nav` section of your `mkdocs.yml`. Top-level items appear as root entries, and nested items appear indented under their parent sections.

Selecting a page in the tree opens it in the editor.

## Reordering pages

You can reorder pages and sections in two ways:

### Drag and drop

Click and drag any item in the navigation tree to move it to a new position. You can:

- Move a page up or down within a section
- Move a page into a different section
- Reorder entire sections

### Move buttons

Each navigation item has **move up** and **move down** buttons for fine-grained control. This is useful when drag and drop feels imprecise or when you need to shift an item by a single position.

Changes to the navigation order are saved to your `mkdocs.yml` automatically.

## Adding pages

To add an existing page to the navigation:

1. Look for pages in the **Unlisted pages** section at the bottom of the sidebar
2. Add them to the nav from there

You can also create a new page, which gives you the option to add it to the navigation at creation time.

## Removing pages from navigation

Removing a page from the navigation takes it out of the `nav` section in `mkdocs.yml`. This does **not** delete the file from your project — the Markdown file stays in your `docs/` folder. It simply won't appear in the site's navigation menu.

Removed pages move to the **Unlisted pages** section, where you can add them back at any time.

## Creating new pages

From the navigation panel, you can create a new page:

1. Choose a filename and location within your `docs/` folder
2. Optionally add a title
3. Choose whether to add the page to the navigation immediately

The new page is created as a Markdown file and opened in the editor.

## Creating sections

You can create a new section (group) in the navigation to organize related pages together. Sections appear as collapsible folders in your site's sidebar.

## Unlisted pages

The **Unlisted pages** section shows Markdown files that exist in your `docs/` folder but are not included in the `nav` section of `mkdocs.yml`. This helps you spot pages that might be missing from your navigation.

!!! tip
    Unlisted pages are still accessible by direct URL in your built site — they just won't appear in the navigation menu. If you want them visible to visitors, add them to the nav.

## Cleaning up missing entries

If your navigation references a file that no longer exists (for example, a page that was deleted or renamed outside of MkLume), the navigation editor flags these as missing entries. You can remove them from the nav to clean things up.

The [Project Health](project-health.md) panel also checks for these issues and can help you resolve them.
