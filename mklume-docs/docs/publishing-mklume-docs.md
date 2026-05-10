# Publishing MkLume Docs

This page covers how to build and publish the MkLume documentation site itself. This is an internal reference for maintainers.

## Build the documentation

From the repository root:

```bash
cd mklume-docs
mkdocs build
```

The generated static site will be placed in `mklume-docs/site/`.

## Publish to ecalstudios.com

The MkLume documentation should be published as a subdirectory of the ECal Studios website:

```
www.ecalstudios.com/mklume/
```

Upload the **contents** of `mklume-docs/site/` to the `/mklume/` path on the web server.

!!! warning "Do not overwrite the main site"
    Upload only to the `/mklume/` subdirectory. Do **not** overwrite the main ECal Studios homepage or any other sections of the site.

## Hosting considerations

### Cloudflare Pages or similar platforms

If the ECal Studios site is hosted on Cloudflare Pages, Netlify, or a similar platform:

- Configure the deployment so that the MkLume docs are served from the `/mklume/` subdirectory.
- Make sure the platform's build or deploy settings do not replace the entire site root with the MkLume docs output.

### GitHub Pages (optional mirror)

GitHub Pages can be used as an optional mirror or staging environment for the documentation:

1. Enable GitHub Pages in the repository settings.
2. Set the source to **GitHub Actions** and use a workflow that builds from `mklume-docs/`.
3. This can serve as a preview or backup, separate from the primary site on ecalstudios.com.

## General guidelines

- Always build with `mkdocs build` before publishing to catch any errors.
- Review the built site locally (`mkdocs serve`) before uploading.
- Keep the deployment process simple and reversible.
- Document any hosting-specific configuration in the repository so other maintainers can follow it.
