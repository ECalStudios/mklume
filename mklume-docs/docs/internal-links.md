# Smart Internal Links

MkLume helps you link between pages in your documentation without memorizing file paths. As you type, it suggests matching pages from your project and inserts the correct relative path for you.

## Autocomplete triggers

There are two ways to trigger the page autocomplete while editing in Markdown mode:

### Double bracket: `[[`

Type `[[` anywhere in the editor to open the page autocomplete. Start typing to filter the list by page title or filename. When you select a page, MkLume inserts a standard Markdown link with the correct relative path.

### Link syntax: `[Text](`

If you're already writing a Markdown link and type the opening parenthesis, MkLume shows the autocomplete with matching pages from your project. This lets you write your link text first, then pick the destination.

## What the autocomplete shows

The autocomplete dropdown lists pages from your project, showing:

- The page title (pulled from the first heading or the `nav` entry in `mkdocs.yml`)
- The file path relative to your docs folder

As you type, the list filters to show only pages that match your input. Matching works against both page titles and file paths, so you can search either way.

## Inserted links

When you select a page from the autocomplete, MkLume inserts a relative path link. For example, if you're editing `docs/guide/setup.md` and link to `docs/reference/api.md`, the result would be:

```markdown
[API Reference](../reference/api.md)
```

The path is always relative to the current file, which is what MkDocs expects for internal links.

## Insert menu

You can also insert a link through the menu:

**Insert > Internal Link** opens a page picker dialog where you can browse or search for a page in your project. This is useful when you want to find a page without typing in the editor first.

## Limitations

!!! info "No anchor linking"
    MkLume's autocomplete links to pages, not to specific headings within a page. If you need to link to a particular section (e.g., `setup.md#configuration`), you'll need to add the anchor fragment manually after selecting the page.

## Tips

- **Use internal links instead of URLs** — Linking with relative paths (`../guide/setup.md`) instead of full URLs keeps your links working across environments and avoids broken links if your site URL changes.
- **Check Project Health** — The [Project Health](project-health.md) panel can detect broken internal links across your project, so you can catch problems before building.
