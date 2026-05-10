# Contributing

MkLume is open source and contributions are welcome. Whether you are reporting a bug, suggesting a feature, or submitting code, your input helps improve the project for everyone.

## Reporting bugs

If you run into a problem, please [open an issue on GitHub](https://github.com/ECalStudios/mklume/issues) with:

- A clear description of what went wrong
- Steps to reproduce the issue
- Your operating system and MkLume version
- Any relevant error messages or screenshots

## Requesting features

Feature requests are welcome. [Open a GitHub Issue](https://github.com/ECalStudios/mklume/issues) describing:

- What you would like MkLume to do
- Why it would be useful
- Any examples or references, if applicable

Please check existing issues first to avoid duplicates.

## Contributing code

1. **Fork** the [repository on GitHub](https://github.com/ECalStudios/mklume).
2. **Create a branch** for your change (`git checkout -b my-feature`).
3. **Make your changes** and test them locally.
4. **Commit** with clear, descriptive messages.
5. **Open a Pull Request** against the `main` branch.

### Tech stack

MkLume is built with:

| Layer | Technology |
|---|---|
| Desktop framework | Tauri v2 |
| Frontend | React + TypeScript |
| Backend | Rust |
| Styling | CSS |

### Running locally

```bash
# Clone the repository
git clone https://github.com/ECalStudios/mklume.git
cd mklume

# Install frontend dependencies
npm install

# Run in development mode
npx tauri dev
```

!!! tip "Prerequisites"
    You will need **Node.js**, **npm**, **Rust**, and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) installed on your system.

## Guidelines

- **Keep code clean.** Follow existing patterns and conventions in the codebase.
- **Write useful comments.** Explain *why*, not just *what*.
- **Avoid large unreviewed rewrites.** If you want to make a significant architectural change, open an issue first to discuss it.
- **Test your changes.** Make sure the app builds and runs correctly before submitting.
- **Be respectful.** Treat other contributors with courtesy and professionalism.

## License

By contributing to MkLume, you agree that your contributions will be licensed under the **GPLv3**, the same license as the rest of the project.

## Questions?

If you are unsure about anything, feel free to [open an issue](https://github.com/ECalStudios/mklume/issues) and ask. We would rather help you contribute than have you struggle in silence.
