# OnlyPhoto (Python) bootstrap for Windows.
# Idempotent: reuses an existing uv/Python when compatible and never overwrites .env.local or data.
# Uses uv for Python version management and dependency management.
# ASCII-only messages so Windows PowerShell 5.1 parses the file correctly.

[CmdletBinding()]
param(
  [switch]$SkipBrowser,
  [switch]$SkipSeed
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$ToolsDir = Join-Path $Root '.tools'
$UvDir = Join-Path $ToolsDir 'uv'
$UvExe = Join-Path $UvDir 'uv.exe'
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

Write-Host "[bootstrap] Root: $Root"

# 1. uv (project-local)
if (-not (Test-Path -LiteralPath $UvExe)) {
  Write-Host '[bootstrap] uv not found in project, downloading official build ...'
  $api = Invoke-RestMethod -Uri 'https://api.github.com/repos/astral-sh/uv/releases/latest' -Headers @{ 'User-Agent' = 'onlyphoto' } -TimeoutSec 60
  $asset = $api.assets | Where-Object { $_.name -match 'uv-x86_64-pc-windows-msvc\.zip$' } | Select-Object -First 1
  $zip = Join-Path $ToolsDir 'uv.zip'
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing -TimeoutSec 900
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  New-Item -ItemType Directory -Force -Path $UvDir | Out-Null
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $UvDir)
  Remove-Item -LiteralPath $zip -Force
  Write-Host "[bootstrap] uv installed at $UvExe"
} else {
  Write-Host "[bootstrap] Reusing existing uv $(& $UvExe --version)"
}

$env:UV_PYTHON_INSTALL_DIR = Join-Path $ToolsDir 'python'
$env:UV_CACHE_DIR = Join-Path $ToolsDir 'uv-cache'

# 2. Python (managed by uv, project-local)
Write-Host '[bootstrap] Ensuring Python 3.12 (managed by uv) ...'
& $UvExe python install 3.12

# 3. Dependencies
Write-Host '[bootstrap] Syncing dependencies with uv ...'
& $UvExe sync

# 4. Environment file (never overwrite)
$envLocal = Join-Path $Root '.env.local'
if (-not (Test-Path -LiteralPath $envLocal)) {
  Copy-Item -LiteralPath (Join-Path $Root '.env.example') -Destination $envLocal
  Write-Host '[bootstrap] Created .env.local from .env.example (fill in your AI settings)'
}
$content = Get-Content -LiteralPath $envLocal -Raw
if ($content -notmatch '(?m)^SESSION_SECRET=.+') {
  $bytes = New-Object 'System.Byte[]' 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
  Add-Content -LiteralPath $envLocal -Value "`nSESSION_SECRET=$secret"
  Write-Host '[bootstrap] Generated SESSION_SECRET (value not printed)'
}

# 5. Database
Write-Host '[bootstrap] Applying migrations ...'
& $UvExe run python scripts/migrate.py
if (-not $SkipSeed) {
  Write-Host '[bootstrap] Seeding idempotent demo data ...'
  & $UvExe run python scripts/seed.py
}

# 6. Test browser (reuses the shared Playwright cache when present)
if (-not $SkipBrowser) {
  Write-Host '[bootstrap] Installing Playwright Chromium (shared cache) ...'
  $env:PLAYWRIGHT_DOWNLOAD_HOST = 'https://cdn.npmmirror.com/binaries/playwright'
  & $UvExe run playwright install chromium
}

# 7. Self-check
& $UvExe run python scripts/doctor.py

Write-Host '[bootstrap] Done. Start with:'
Write-Host '  .tools\run-py.cmd run uvicorn app.main:app --host 127.0.0.1 --port 8000'
Write-Host '  (browser: http://localhost:8000)'
Write-Host "[bootstrap] Tip: $UvExe run <cmd> is the uv entry point used by this project."