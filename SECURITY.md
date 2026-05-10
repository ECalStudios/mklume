# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in MkLume, please report it responsibly.

**For security issues that could affect users**, please [open a GitHub issue](https://github.com/ECalStudios/mklume/issues) with the label "security". If the issue is sensitive (e.g., it could be exploited before a fix is available), please note that in the issue title and avoid including exploit details in the public description.

> **Note:** MkLume does not currently have a private security reporting channel. If you believe the issue is too sensitive for a public report, mention that in the issue and we will coordinate privately.

## What MkLume does and does not do

- MkLume **does not** ask for or store GitHub tokens, API keys, passwords, or hosting credentials.
- MkLume **does not** include built-in telemetry or analytics in the current version.
- MkLume **does not** transmit your files or project data to any external server.
- Git authentication is handled entirely by your local Git installation, not by MkLume.
- Backups and recovery drafts are stored locally in your project directory.

## Supported versions

MkLume is under active development. Security fixes will be applied to the latest version. There is no long-term support for older versions at this time.

## Scope

This security policy covers the MkLume desktop application. It does not cover:

- MkDocs, Material for MkDocs, or any third-party dependencies (report issues to their respective projects)
- Documentation sites you build and publish using MkLume (you are responsible for your own site's security)
- Your local Git configuration or credentials
