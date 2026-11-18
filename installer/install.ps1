param(
  [string]$AppRoot = "",
  [switch]$NoShortcuts
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg = [System.IO.File]::ReadAllText((Join-Path (Split-Path -Parent $here) "package.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json

function Info([string]$text) { Write-Host ("  " + $text) }
function Step([string]$text) { Write-Host ("`n== " + $text) -ForegroundColor Cyan }
function Fail([string]$text) { Write-Host ("[ERROR] " + $text) -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "WhaleGirl libido / physiology patch installer" -ForegroundColor Cyan
Write-Host "  18+ only. This is a PATCH, not a standalone app." -ForegroundColor Yellow
Write-Host "  Install WhaleGirl 4.1.2 first: https://github.com/Banan1cee/whale_girl"
Write-Host ""

function Find-AppRoot {
  foreach ($known in @('F:\deep seek girl\WhaleGirl','D:\WhaleGirl','E:\WhaleGirl','F:\WhaleGirl')) {
    if (Test-Path (Join-Path $known 'server.js')) { return $known }
  }
  $keys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($key in $keys) {
    try {
      Get-ItemProperty $key -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.DisplayName -match "Whale|鲸鲸" -and $_.InstallLocation) {
          $p = [string]$_.InstallLocation
          if (Test-Path (Join-Path $p "server.js")) { return $p }
        }
      }
    } catch { }
  }
  try {
    Get-Process WhaleLauncher -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Path) {
        $p = Split-Path -Parent $_.Path
        if (Test-Path (Join-Path $p "server.js")) { return $p }
      }
    }
  } catch { }
  foreach ($p in @(
    (Join-Path $env:LOCALAPPDATA "Programs\WhaleGirl"),
    (Join-Path $env:ProgramFiles "WhaleGirl"),
    "D:\WhaleGirl",
    "E:\WhaleGirl"
  )) {
    if (Test-Path (Join-Path $p "server.js")) { return $p }
  }
  return ""
}

function Pick-AppRoot {
  try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Select the WhaleGirl folder (contains server.js)."
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return "" }
    return $dialog.SelectedPath
  } catch { return "" }
}

if (-not $AppRoot) { $AppRoot = Find-AppRoot }
if (-not $AppRoot) {
  Write-Host "WhaleGirl not found automatically; choose the folder containing server.js." -ForegroundColor Yellow
  $AppRoot = Pick-AppRoot
}
if (-not $AppRoot -or -not (Test-Path (Join-Path $AppRoot "server.js"))) {
  Fail "No WhaleGirl folder selected. Install WhaleGirl first."
}
$AppRoot = (Resolve-Path $AppRoot).Path
Info "target: $AppRoot"

$version = ""
try { $version = ([System.IO.File]::ReadAllText((Join-Path $AppRoot "package.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json).version } catch { }
Info "base version: $version"
if ($version -and $version -ne "4.1.2") {
  Write-Host "  [WARN] tested with 4.1.2; continuing anyway." -ForegroundColor Yellow
}

Step "1/5 Check package"
$patchSrc = Join-Path (Split-Path -Parent $here) "patch"
if (-not (Test-Path (Join-Path $patchSrc "index.js"))) { Fail "package incomplete: patch/index.js missing" }
Info "package OK"

Step "2/5 Copy patch"
$dest = Join-Path $AppRoot "whale-libido-patch"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item $patchSrc $dest -Recurse
Info "copied to $dest"

Step "3/5 Add server.js hook"
$serverPath = Join-Path $AppRoot "server.js"
$backup = Join-Path $AppRoot "server.js.whale-libido-patch.bak"
$hook = "require('./whale-libido-patch').install();"
$server = [System.IO.File]::ReadAllText($serverPath, [System.Text.Encoding]::UTF8)
if ($server -notmatch 'whale-libido-patch') {
  if (-not (Test-Path $backup)) { Copy-Item $serverPath $backup -Force }
  $lines = $server -split "`r?`n"
  $newLines = @($hook) + $lines
  [System.IO.File]::WriteAllText($serverPath, ($newLines -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
  Info "hook added (backup: server.js.whale-libido-patch.bak)"
} else {
  Info "hook already present"
}

Step "4/5 Syntax check"
$node = Join-Path $AppRoot "runtime\node.exe"
if (-not (Test-Path $node)) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source } else { $node = "" }
}
Push-Location $AppRoot
try {
  if ($node) {
    & $node --check "server.js"
    if ($LASTEXITCODE -ne 0) { Fail "server.js syntax check failed" }
    & $node --check "whale-libido-patch\index.js"
    if ($LASTEXITCODE -ne 0) { Fail "patch syntax check failed" }
    Info "syntax OK"
  } else {
    Info "node runtime not found; skip syntax check"
  }
} finally { Pop-Location }

Step "5/5 Shortcuts"
$port = "8787"
$portFile = Join-Path $AppRoot "data\server-port.txt"
if (Test-Path $portFile) {
  $raw = (Get-Content $portFile -Raw).Trim()
  if ($raw -match '^\d+$') { $port = $raw }
}
if (-not $NoShortcuts) {
  try {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $shell = New-Object -ComObject WScript.Shell
    $urlPath = Join-Path $desktop "鲸鲸生理状态-管理页.url"
    $url = $shell.CreateShortcut($urlPath)
    $url.TargetPath = "http://127.0.0.1:$port/libido-patch/"
    $url.Save()
    Info "shortcut: $urlPath"
  } catch { Info "shortcut failed: $($_.Exception.Message)" }
}

Write-Host ""
Write-Host "Done. Fully quit WhaleGirl (tray -> exit), then reopen." -ForegroundColor Green
Write-Host "Panel: http://127.0.0.1:$port/libido-patch/" -ForegroundColor Green
Write-Host "18+ only. Keep it private." -ForegroundColor Yellow
