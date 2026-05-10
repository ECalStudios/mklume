# Assets & Image Management

MkLume makes it easy to add images to your documentation. Drop files into the editor and MkLume handles the rest — copying, organizing, and inserting the right Markdown for you.

## Drag and drop images

The fastest way to add an image is to drag it from your file explorer directly onto the editor. MkLume will:

1. Copy the file into your project's `docs/assets/` folder
2. Insert the correct Markdown image syntax at your cursor position
3. Use a relative path so the link works in your built site

This works in **Markdown mode**, **Visual mode**, and **Split mode**.

You can drop multiple images at once. MkLume inserts each one on its own line, in the order they were dropped.

## Supported formats

MkLume supports the following image formats:

| Format | Extension |
|---|---|
| PNG | `.png` |
| JPEG | `.jpg`, `.jpeg` |
| GIF | `.gif` |
| SVG | `.svg` |
| WebP | `.webp` |

!!! warning "Unsupported file types"
    If you drop a file that isn't a supported image format, MkLume will show a warning and skip the file. Only image files listed above are accepted.

## How files are organized

All dropped images are copied into the `docs/assets/` directory inside your project. MkLume creates this folder automatically if it doesn't exist.

The inserted Markdown uses a relative path from the current page to the image file. For example, if you're editing `docs/guide/setup.md` and drop a screenshot, the resulting Markdown might look like:

```markdown
![screenshot](../assets/screenshot.png)
```

## Duplicate filenames

If you drop an image and a file with the same name already exists in `docs/assets/`, MkLume appends a number to avoid overwriting. For example:

- `screenshot.png` (already exists)
- `screenshot-1.png` (new file)

This keeps your existing images safe.

## Image preview

In the editor preview, images are displayed using Tauri's asset protocol, which reads files directly from your local project folder. You don't need a running MkDocs server to see your images in the preview pane.

!!! note
    The preview shows images from your local filesystem. If an image path is broken or the file was moved outside of MkLume, the preview will show a broken image placeholder.

## Tips

- **Keep images in `docs/assets/`** — MkLume places them there by default, and it's the conventional location for MkDocs projects. You can move images manually afterward, but you'll need to update the Markdown references yourself.
- **Use descriptive filenames** before dropping — MkLume uses the original filename. Renaming `IMG_4823.png` to `dashboard-overview.png` before you drop it makes your Markdown more readable.
- **Alt text** — MkLume inserts an empty alt text placeholder (`![](path)`). It's good practice to go back and add descriptive alt text for accessibility.
