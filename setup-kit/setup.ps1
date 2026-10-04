# Windows entry point: make sure Node >= 18 exists, then hand off to lib/apply.mjs.
# Run: powershell -ExecutionPolicy Bypass -File setup.ps1 [flags]
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-Node {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  return [int](& node -p "process.versions.node.split('.')[0]") -ge 18
}

if (-not (Test-Node)) {
  Write-Host 'Node.js >= 18 is required.'
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'Install Node.js LTS from https://nodejs.org/en/download and re-run.'
    exit 1
  }
  $auto = ($args -contains '--yes') -or ($args -contains '-y')
  $answer = 'n'
  if ($auto) { $answer = 'y' } else { $answer = Read-Host "Install with 'winget install OpenJS.NodeJS.LTS'? [y/N]" }
  if ($answer -notmatch '^(y|yes)$') { exit 1 }
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Test-Node)) {
    Write-Host 'Node.js is still not found. Open a new terminal and re-run.'
    exit 1
  }
}

& node (Join-Path $dir 'lib\apply.mjs') @args
exit $LASTEXITCODE
