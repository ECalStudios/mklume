# GitHub Pages Deploy Assistant

The GitHub Pages Deploy Assistant helps you set up automated deployment for your documentation. It generates a GitHub Actions workflow file that builds and publishes your MkDocs Material site to GitHub Pages every time you push to your repository.

## How It Works

The assistant creates configuration files in your project. It does **not** connect to GitHub, does not require any tokens, and does not need your GitHub password.

Here is what it does:

1. Creates a `deploy-mkdocs.yml` workflow file in `.github/workflows/`
2. Optionally creates a `requirements.txt` listing your Python dependencies
3. Shows you step-by-step instructions for completing the setup on GitHub

The rest is up to you: commit the files, push them, and enable GitHub Pages in your repository settings.

!!! tip "No tokens, no passwords, no OAuth"
    The Deploy Assistant generates files locally. It never communicates with GitHub or any external service. There is nothing to authenticate.

## What the Workflow Does

The generated `deploy-mkdocs.yml` workflow:

- Triggers on pushes to your selected branch
- Sets up Python and installs MkDocs Material
- Builds your documentation with `mkdocs build`
- Deploys the built site to GitHub Pages

The workflow uses current, well-maintained GitHub Actions:

| Action | Version |
|--------|---------|
| `actions/checkout` | v4 |
| `actions/setup-python` | v5 |
| `actions/configure-pages` | v5 |
| `actions/upload-pages-artifact` | v3 |
| `actions/deploy-pages` | v4 |

## Configuration Options

### Branch Selection

Choose which branch triggers deployment:

- **main** -- The most common default branch name
- **master** -- For repositories using the older convention
- **Current branch** -- Whatever branch you are working on

### Custom Domain

If you use a custom domain for your GitHub Pages site, the assistant can generate a `CNAME` file in your `docs/` directory. GitHub Pages needs this file to serve your site from a custom domain.

### Site URL

The assistant suggests your GitHub Pages URL based on your repository. This helps you set the `site_url` in your `mkdocs.yml` for correct canonical URLs and sitemap generation.

### Requirements File

The assistant can create a `requirements.txt` file that lists `mkdocs-material` and any other dependencies. The workflow uses this file to install the correct packages during the build.

## Handling Existing Workflows

If your project already has a deployment workflow, the assistant gives you three options:

- **View** -- See the existing workflow before deciding
- **Replace** -- Overwrite the existing workflow with the new one
- **Save as alternate** -- Save the new workflow with a different filename so you can compare them

## After Generation

Once the assistant creates the files, you need to complete three steps:

1. **Commit the workflow file** -- Use Git Sync or your terminal to commit the new `.github/workflows/deploy-mkdocs.yml` (and `requirements.txt` if created)
2. **Push to GitHub** -- Push the commit to your repository
3. **Enable GitHub Pages** -- In your GitHub repository settings, go to **Pages** and set the source to **GitHub Actions**

!!! warning "You must set the source to GitHub Actions"
    The workflow will not deploy your site until you change the GitHub Pages source in your repository settings. Go to Settings > Pages and select "GitHub Actions" as the source. This is a one-time step.

The assistant shows these instructions after generating the files, so you do not need to memorize them.

## Limitations

- Your project must be hosted in a GitHub repository
- You must have push access to the repository
- GitHub Pages must be available for your repository (it is available on all public repos and on private repos with GitHub Pro or higher)
- The workflow builds with MkDocs Material; other MkDocs themes require manual workflow editing

!!! note "MkLume generates the files, you handle the rest"
    MkLume's role ends after creating the workflow file. Committing, pushing, and configuring GitHub Pages are your responsibility. This keeps things simple and means MkLume never needs access to your GitHub account.

!!! info "GitHub Pages is optional"
    GitHub Pages is just one deployment option. You can host your MkDocs Material site anywhere that serves static files — Netlify, Cloudflare Pages, your own server, or any other static hosting provider. See [Build & Export](build-export.md) for details on building your site for manual deployment.

    The official MkLume documentation is published at [www.ecalstudios.com/mklume](https://www.ecalstudios.com/mklume/).
