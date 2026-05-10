# Checksums for MkLume Releases

## Why checksums?

Checksums let users verify that the installer they downloaded is the exact file that was published. This protects against corrupted downloads or tampered files.

## Algorithm

Use **SHA-256** for all release checksums.

## Generating a checksum (after installer is built)

### PowerShell

```powershell
Get-FileHash .\MkLume_1.0.0_x64-setup.exe -Algorithm SHA256
```

### Save to file

```powershell
Get-FileHash .\MkLume_1.0.0_x64-setup.exe -Algorithm SHA256 | Format-List > .\MkLume_1.0.0_x64-setup.exe.sha256
```

### Bash / Git Bash

```bash
sha256sum MkLume_1.0.0_x64-setup.exe > MkLume_1.0.0_x64-setup.exe.sha256
```

## Where to publish

Attach the `.sha256` file alongside the installer in the GitHub Release:

https://github.com/ECalStudios/mklume/releases

## How users verify

### PowerShell

```powershell
Get-FileHash .\MkLume_1.0.0_x64-setup.exe -Algorithm SHA256
```

Compare the `Hash` value with the contents of the `.sha256` file from the release.

### Bash

```bash
sha256sum -c MkLume_1.0.0_x64-setup.exe.sha256
```

## Notes

- Do not generate checksums until the final installer file is built.
- Do not reuse checksums if the installer is rebuilt — regenerate them each time.
- The checksum file should contain only the hash and filename, nothing else.
