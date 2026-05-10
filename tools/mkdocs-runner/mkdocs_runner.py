#!/usr/bin/env python3
"""
MkLume MkDocs Runner — Bundled sidecar for MkDocs operations.

This script is packaged with PyInstaller into a standalone executable
that ships with MkLume. It allows normal installer users to build,
serve, and preview MkDocs Material projects without installing Python
or MkDocs manually.

Copyright (c) 2026 ECal Studios. Created by Enrique Cal.
Licensed under the GNU General Public License v3.0.
"""

import sys
import os


def cmd_version():
    """Print MkDocs version info."""
    try:
        import mkdocs
        import material
        print(f"mkdocs-runner (MkLume bundled)")
        print(f"mkdocs {mkdocs.__version__}")
        print(f"mkdocs-material {material.__version__}")
    except ImportError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_build(args):
    """Run mkdocs build with given arguments."""
    from mkdocs.commands.build import build as mkdocs_build
    from mkdocs.config import load_config

    # Parse arguments
    config_file = None
    site_dir = None
    strict = False
    clean = True

    i = 0
    while i < len(args):
        if args[i] in ("--config-file", "-f") and i + 1 < len(args):
            config_file = args[i + 1]
            i += 2
        elif args[i] in ("--site-dir", "-d") and i + 1 < len(args):
            site_dir = args[i + 1]
            i += 2
        elif args[i] == "--strict":
            strict = True
            i += 1
        elif args[i] == "--no-clean":
            clean = False
            i += 1
        else:
            i += 1

    try:
        # Build config kwargs
        kwargs = {}
        if config_file:
            kwargs["config_file"] = config_file
        if site_dir:
            kwargs["site_dir"] = site_dir
        if strict:
            kwargs["strict"] = True

        cfg = load_config(**kwargs)
        mkdocs_build(cfg, dirty=not clean)
        print("Site built successfully.")
    except Exception as e:
        print(f"Build failed: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_serve(args):
    """Run mkdocs serve with given arguments."""
    from mkdocs.commands.serve import serve as mkdocs_serve
    from mkdocs.config import load_config

    # Parse arguments
    config_file = None
    dev_addr = "127.0.0.1:8000"
    strict = False

    i = 0
    while i < len(args):
        if args[i] in ("--config-file", "-f") and i + 1 < len(args):
            config_file = args[i + 1]
            i += 2
        elif args[i] in ("--dev-addr", "-a") and i + 1 < len(args):
            dev_addr = args[i + 1]
            i += 2
        elif args[i] == "--strict":
            strict = True
            i += 1
        else:
            i += 1

    try:
        kwargs = {}
        if config_file:
            kwargs["config_file"] = config_file
        if strict:
            kwargs["strict"] = True

        cfg = load_config(**kwargs)
        host, port = dev_addr.rsplit(":", 1)
        mkdocs_serve(cfg, host=host, port=int(port))
    except KeyboardInterrupt:
        print("Server stopped.")
    except Exception as e:
        print(f"Serve failed: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: mkdocs-runner <command> [options]")
        print("Commands: version, build, serve")
        sys.exit(1)

    command = sys.argv[1]
    remaining = sys.argv[2:]

    if command == "version" or command == "--version":
        cmd_version()
    elif command == "build":
        cmd_build(remaining)
    elif command == "serve":
        cmd_serve(remaining)
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Commands: version, build, serve")
        sys.exit(1)


if __name__ == "__main__":
    main()
