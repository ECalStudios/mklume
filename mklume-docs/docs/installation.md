# Installation

MkLume is a desktop application for Windows. macOS and Linux support is planned.

## Download

Download the latest release from [GitHub Releases](https://github.com/ECalStudios/mklume/releases).

=== "Windows"

    **Download:** `MkLume_1.0.0_x64-setup.exe` from [GitHub Releases](https://github.com/ECalStudios/mklume/releases)

    !!! warning "Unsigned Application"
        MkLume is not currently code-signed. When you first run it, Windows may show a SmartScreen warning saying the app is from an "unknown publisher." This is normal for unsigned open-source applications.

        To proceed, click **More info** and then **Run anyway**.

=== "macOS"

    macOS packages are planned for a future release. Developers can [build from source](#build-from-source) below.

=== "Linux"

    Linux packages are planned for a future release. Developers can [build from source](#build-from-source) below.

---

## What works out of the box

MkLume has **no runtime dependencies** for its core editing features. After installing, you can immediately:

- Create, edit, and organize documentation pages
- Use Markdown Mode, Visual Mode, Preview Mode, and Site Preview
- Manage navigation, site settings, and project structure
- Use autosave, backups, recovery drafts, and the command palette
- Drag and drop images, use internal link autocomplete
- Use the GitHub Pages Deploy Assistant (generates workflow files)

No Python, Node.js, or developer tools are required for these features.

---

## Build, Export, and Serve

MkLume includes a **bundled MkDocs runtime** so you can build, export, and preview your documentation site without installing Python or MkDocs manually.

The Build panel, Export options, and MkDocs Serve all use this bundled runtime automatically. No additional setup is required.

### Git (for Git Sync)

The Git Sync feature requires Git to be installed and available in your system PATH.

- **Windows:** Install [Git for Windows](https://git-scm.com/download/win)
- **macOS:** Git is included with Xcode Command Line Tools. Run `xcode-select --install` if needed.
- **Linux:** Install via your package manager (e.g., `sudo apt install git`)

!!! tip
    Git is only needed for Git Sync (committing and pushing changes). You can use all other MkLume features without Git installed.

---

## Build from source

If you want to run MkLume from source, you'll need the following development tools:

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Platform-specific dependencies

=== "Windows"

    - Visual Studio Build Tools with the C++ workload
    - WebView2 (included in Windows 10/11)

=== "macOS"

    - Xcode Command Line Tools (`xcode-select --install`)

=== "Linux"

    - System libraries for WebKitGTK and other dependencies. On Ubuntu/Debian:

        ```bash
        sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
          libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
        ```

### Steps

1. Clone the repository:

    ```bash
    git clone https://github.com/ECalStudios/mklume.git
    cd mklume
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Run in development mode:

    ```bash
    npx tauri dev
    ```

4. Build a release binary:

    ```bash
    npx tauri build
    ```

    The output binary will be in `src-tauri/target/release/`.

!!! note
    Build-from-source instructions may change as the project evolves. Check the repository README for the latest steps.
