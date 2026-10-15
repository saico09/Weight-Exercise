[CmdletBinding()]
param([string]$BasicPath, [switch]$NoBrowser, [switch]$SkipCloud)
$ErrorActionPreference = 'Stop'
$proPath = Split-Path -Parent $PSScriptRoot
if (-not $BasicPath) {
  $trees = & git -C $proPath worktree list --porcelain
  $candidate = $null
  foreach ($line in $trees) {
    if ($line.StartsWith('worktree ')) { $candidate = $line.Substring(9) }
    if ($line -eq 'branch refs/heads/basic') { $BasicPath = $candidate; break }
  }
}
if (-not $BasicPath -or -not (Test-Path -LiteralPath (Join-Path $BasicPath 'scripts/start-preview.ps1'))) { throw 'Indica el checkout de Basic: -BasicPath C:\ruta\WeightExercise-Basic' }
if ((& git -C $proPath branch --show-current) -ne 'pro') { throw 'Ejecuta este iniciador desde el checkout de la rama pro.' }
if ((& git -C $BasicPath branch --show-current) -ne 'basic') { throw 'BasicPath debe apuntar al checkout de la rama basic.' }
if (-not $SkipCloud) { & (Join-Path $proPath 'scripts/start-local-cloud.ps1') -NoBrowser; if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar la nube local.' } }
& (Join-Path $proPath 'scripts/start-preview.ps1') -NoBrowser -Port 5173
& (Join-Path $BasicPath 'scripts/start-preview.ps1') -NoBrowser -Port 5174
Write-Host 'Pro: http://127.0.0.1:5173 | Basic: http://127.0.0.1:5174' -ForegroundColor Green
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173'; Start-Process 'http://127.0.0.1:5174' }
