# PhotoMaster bootstrap (Windows / PowerShell).
# Idempotent: reuses compatible existing tools and never overwrites .env.local or existing data.
# It does NOT require Node.js or pnpm to be pre-installed: it uses the current shell to obtain them.
# Messages are ASCII-only so the script parses correctly under Windows PowerShell 5.1 (ANSI default).

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
$NodeDir = Join-Path $ToolsDir 'node'
$NpmGlobal = Join-Path $ToolsDir 'npm-global'
New-Item -ItemType Directory -Force -Path $ToolsDir, $NpmGlobal | Out-Null

Write-Host "[bootstrap] Root: $Root"

# 1. Node.js
if (-not (Test-Path -LiteralPath (Join-Path $NodeDir 'node.exe'))) {
  Write-Host '[bootstrap] Node.js not found in project, downloading official LTS ...'
  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 60
  $lts = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
  $zipName = "node-$($lts.version)-win-x64.zip"
  $zipPath = Join-Path $ToolsDir $zipName
  if (-not (Test-Path -LiteralPath $zipPath)) {
    Invoke-WebRequest -Uri "https://nodejs.org/dist/$($lts.version)/$zipName" -OutFile $zipPath -UseBasicParsing -TimeoutSec 900
  }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $extract = Join-Path $ToolsDir 'node-extract'
  if (Test-Path -LiteralPath $extract) { Remove-Item -Recurse -Force -LiteralPath $extract }
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extract)
  $inner = Join-Path $extract "node-$($lts.version)-win-x64"
  if (Test-Path -LiteralPath $NodeDir) { Remove-Item -Recurse -Force -LiteralPath $NodeDir }
  Move-Item -LiteralPath $inner -Destination $NodeDir
  Remove-Item -Recurse -Force -LiteralPath $extract
  Write-Host "[bootstrap] Node installed at $NodeDir ($(& (Join-Path $NodeDir 'node.exe') --version))"
} else {
  Write-Host "[bootstrap] Reusing existing Node.js $(& (Join-Path $NodeDir 'node.exe') --version)"
}

$env:Path = "$NodeDir;$NpmGlobal;$env:Path"
$env:npm_config_prefix = $NpmGlobal
$env:npm_config_cache = Join-Path $ToolsDir 'npm-cache'
$PnpmCmd = Join-Path $NpmGlobal 'pnpm.cmd'

# 2. pnpm (project-local)
if (-not (Test-Path -LiteralPath $PnpmCmd)) {
  Write-Host '[bootstrap] Installing pnpm (project-local, does not touch global installs) ...'
  & (Join-Path $NodeDir 'npm.cmd') install -g pnpm@latest --no-audit --no-fund
} else {
  Write-Host "[bootstrap] Reusing existing pnpm $(& $PnpmCmd --version)"
}

# 3. Environment file (never overwrite)
$envLocal = Join-Path $Root '.env.local'
$envExample = Join-Path $Root '.env.example'
if (-not (Test-Path -LiteralPath $envLocal)) {
  Copy-Item -LiteralPath $envExample -Destination $envLocal
  Write-Host '[bootstrap] Created .env.local from .env.example (fill in your AI settings)'
}
$envContent = Get-Content -LiteralPath $envLocal -Raw
if ($envContent -notmatch '(?m)^SESSION_SECRET=.+') {
  $bytes = New-Object 'System.Byte[]' 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
  Add-Content -LiteralPath $envLocal -Value "`nSESSION_SECRET=$secret"
  Write-Host '[bootstrap] Generated SESSION_SECRET (value not printed)'
}

# 4. Dependencies
Write-Host '[bootstrap] Installing project dependencies ...'
& $PnpmCmd install

# 5. Test browser
if (-not $SkipBrowser) {
  Write-Host '[bootstrap] Installing Playwright Chromium ...'
  $env:PLAYWRIGHT_DOWNLOAD_HOST = 'https://cdn.npmmirror.com/binaries/playwright'
  & $PnpmCmd exec playwright install chromium
}

# 6. Database
Write-Host '[bootstrap] Applying database migrations ...'
& $PnpmCmd exec tsx scripts/migrate.ts

if (-not $SkipSeed) {
  Write-Host '[bootstrap] Seeding idempotent demo data (skipped when APP_DEMO_MODE=false) ...'
  & $PnpmCmd exec tsx scripts/seed.ts
}

# 7. Self-check
& $PnpmCmd exec tsx scripts/doctor.ts

Write-Host '[bootstrap] Done. Start with: pnpm dev  or  pnpm start'
Write-Host "[bootstrap] Tip: prepend $NodeDir to PATH, or use .tools\run.cmd <pnpm args>."