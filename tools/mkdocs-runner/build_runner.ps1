# MkLume MkDocs Runner — Build Script (Windows)
# This script creates the bundled mkdocs-runner sidecar executable.
#
# Prerequisites: Python 3.10+ must be installed on the build machine.
# This is a DEVELOPER build tool, not required for normal MkLume users.
#
# Usage: .\build_runner.ps1
# Output: ..\..\src-tauri\binaries\mkdocs-runner-x86_64-pc-windows-msvc.exe

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path "$ScriptDir\..\.."
$OutputDir = Join-Path $RepoRoot "src-tauri\binaries"

Write-Host "=== MkLume MkDocs Runner Build ===" -ForegroundColor Cyan

# Create/activate venv
$VenvDir = Join-Path $ScriptDir ".venv"
if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating virtual environment..."
    python -m venv $VenvDir
}

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"

# Install dependencies
Write-Host "Installing dependencies..."
& $VenvPip install -r (Join-Path $ScriptDir "requirements.txt") --quiet

# Run PyInstaller
Write-Host "Building with PyInstaller..."
$RunnerScript = Join-Path $ScriptDir "mkdocs_runner.py"

# Get site-packages path for hidden imports and data collection
$SitePackages = & $VenvPython -c "import site; print(site.getsitepackages()[0])"

& (Join-Path $VenvDir "Scripts\pyinstaller.exe") `
    --onefile `
    --name "mkdocs-runner-x86_64-pc-windows-msvc" `
    --distpath $OutputDir `
    --workpath (Join-Path $ScriptDir "build") `
    --specpath $ScriptDir `
    --clean `
    --noconfirm `
    --collect-all mkdocs `
    --collect-all material `
    --collect-all pymdownx `
    --collect-all mkdocs_material_extensions `
    --hidden-import mkdocs.themes `
    --hidden-import mkdocs.plugins `
    --hidden-import material `
    --hidden-import pymdownx `
    --hidden-import pymdownx.arithmatex `
    --hidden-import pymdownx.betterem `
    --hidden-import pymdownx.caret `
    --hidden-import pymdownx.details `
    --hidden-import pymdownx.emoji `
    --hidden-import pymdownx.highlight `
    --hidden-import pymdownx.inlinehilite `
    --hidden-import pymdownx.keys `
    --hidden-import pymdownx.mark `
    --hidden-import pymdownx.smartsymbols `
    --hidden-import pymdownx.superfences `
    --hidden-import pymdownx.tabbed `
    --hidden-import pymdownx.tasklist `
    --hidden-import pymdownx.tilde `
    --hidden-import pygments `
    --hidden-import yaml `
    --hidden-import jinja2 `
    --hidden-import markupsafe `
    --hidden-import watchdog `
    --hidden-import regex `
    $RunnerScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PyInstaller build failed!" -ForegroundColor Red
    exit 1
}

$OutputExe = Join-Path $OutputDir "mkdocs-runner-x86_64-pc-windows-msvc.exe"
if (Test-Path $OutputExe) {
    $size = (Get-Item $OutputExe).Length / 1MB
    Write-Host ""
    Write-Host "SUCCESS: Sidecar built!" -ForegroundColor Green
    Write-Host "  Output: $OutputExe"
    Write-Host "  Size:   $([math]::Round($size, 2)) MB"
} else {
    Write-Host "ERROR: Output file not found!" -ForegroundColor Red
    exit 1
}
