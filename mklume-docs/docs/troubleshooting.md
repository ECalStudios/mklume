# Troubleshooting

Common issues and how to resolve them.

---

## MkDocs not found

**Symptom:** MkLume reports that MkDocs is not installed or cannot be found.

**Solution:**

1. Install Python if you do not have it already.
2. Install MkDocs and Material for MkDocs:
   ```bash
   pip install mkdocs mkdocs-material
   ```
3. Verify the installation:
   ```bash
   mkdocs --version
   ```
4. If MkDocs is installed but not on your system PATH, you can set a **custom MkDocs command** in MkLume's Settings panel.

---

## Build failed

**Symptom:** The build process exits with an error.

**Solution:**

- Check the **terminal output** in MkLume's Build panel for specific error messages.
- Ensure all MkDocs extensions referenced in your `mkdocs.yml` are installed. Missing extensions are a common cause of build failures.
- Run `mkdocs build` manually in your project directory to see the full error output.

---

## Preview server does not start

**Symptom:** Clicking Preview does not show your site, or the preview panel stays blank.

**Solution:**

- **Port 8000 may be in use.** Another process (or another MkDocs instance) might already be using the default port. Stop the other process or restart MkLume.
- **MkDocs may not be installed.** See [MkDocs not found](#mkdocs-not-found) above.
- Try restarting the preview from the Build panel.

---

## Images do not show

**Symptom:** Images appear broken in the preview or built site.

**Solution:**

- Confirm the image file exists in your project's `docs/assets/` folder (or wherever you store images).
- Check that the Markdown path is correct and uses **relative paths**:
  ```markdown
  ![Alt text](assets/my-image.png)
  ```
- File names are case-sensitive on some systems. Make sure the case matches exactly.

---

## Smart links do not find a page

**Symptom:** The Smart Link search returns no results for a page you know exists.

**Solution:**

- The target page must exist within the current project's `docs/` folder.
- Check spelling and make sure the file has a `.md` extension.
- If you just created the file, it may take a moment to appear in the index.

---

## Git Sync failed

**Symptom:** Git Sync reports an error during commit, push, or pull.

**Solution:**

- **Git not installed.** MkLume requires Git to be installed and available on your system PATH.
- **Not a Git repository.** Your project folder must be initialized as a Git repo (`git init`).
- **Authentication issues.** MkLume uses your local Git configuration for authentication. Make sure your credentials are set up (see below).

---

## Git authentication failed

**Symptom:** Push or pull fails with a permission or authentication error.

**Solution:**

- **SSH:** Make sure your SSH key is added to your Git host (GitHub, GitLab, etc.) and that your SSH agent is running.
- **HTTPS:** Set up a credential manager so Git can store your credentials:
    - Windows: Git Credential Manager is included with Git for Windows.
    - macOS: `git credential-osxkeychain`
    - Linux: `git credential-store` or a similar helper.
- MkLume does not store Git credentials itself. All authentication is handled by your local Git installation.

---

## GitHub Pages workflow failed

**Symptom:** The GitHub Actions workflow for deploying to GitHub Pages fails.

**Solution:**

- Check the **workflow file** (`.github/workflows/`) for syntax errors.
- In your GitHub repository settings, ensure **GitHub Pages** is enabled and the source is set to **GitHub Actions**.
- Make sure the repository is public, or that you have GitHub Pages available on your plan for private repositories.
- Review the Actions tab on GitHub for detailed error logs.

---

## Site Settings YAML error

**Symptom:** MkLume shows a YAML parsing error when saving Site Settings.

**Solution:**

- Check for **invalid YAML syntax** in your `mkdocs.yml`.
- Common issues:
    - Unquoted special characters (colons, hash symbols, etc.)
    - Incorrect indentation (YAML uses spaces, not tabs)
    - Missing or extra dashes in list items
- If you edited `mkdocs.yml` manually, validate it with a YAML linter before opening it in MkLume.

---

## Recovery draft found

**Symptom:** MkLume shows a prompt asking whether to restore a recovered draft.

**Explanation:** MkLume saves recovery drafts automatically while you edit. If the app closed unexpectedly, it will offer to restore your unsaved changes on next launch.

**Solution:**

- **Restore** to load the recovered draft and continue editing.
- **Discard** to keep the last saved version and ignore the recovery draft.

Recovery files are stored in `.mklume/recovery/` inside your project directory.

---

## App shows blank or black screen

**Symptom:** MkLume opens but the window is blank, black, or unresponsive.

**Solution:**

- Try **restarting** MkLume.
- On **Windows**, ensure that **Microsoft Edge WebView2** is installed and up to date. MkLume's UI depends on WebView2.
- Check if your graphics drivers are up to date.

---

## Windows security warning

**Symptom:** Windows SmartScreen or your antivirus flags MkLume when you try to run it.

**Explanation:** MkLume may not be code-signed yet. Windows shows warnings for unsigned or newly signed applications.

**Solution:**

- You can choose to run the app anyway by clicking **"More info"** and then **"Run anyway"** in the SmartScreen dialog.
- If you are concerned, you can [review the source code on GitHub](https://github.com/ECalStudios/mklume) and build MkLume yourself.

!!! note
    Code signing is planned for future releases to eliminate this warning.
