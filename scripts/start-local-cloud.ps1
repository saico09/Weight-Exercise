[CmdletBinding()]
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$cloudProjectRoot = Split-Path -Parent $PSScriptRoot
$cloudEnvironmentPath = Join-Path $cloudProjectRoot '.env.local'

function New-LocalSecret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

if (-not (Test-Path -LiteralPath $cloudEnvironmentPath)) {
    $environmentText = @(
        '# Local secrets. This file is ignored by Git. Do not share it.'
        "POSTGRES_PASSWORD=$(New-LocalSecret)"
        "APP_DB_PASSWORD=$(New-LocalSecret)"
        "AUTH_SECRET=$(New-LocalSecret)"
        'ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174'
    ) -join "`n"
    [System.IO.File]::WriteAllText($cloudEnvironmentPath, $environmentText + "`n", (New-Object System.Text.UTF8Encoding $false))
}

$dockerCommand = Get-Command docker -CommandType Application -ErrorAction Stop | Select-Object -First 1
Push-Location $cloudProjectRoot
try {
    & $dockerCommand.Source info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Abre Docker Desktop y espera a que el motor Linux este listo.' }
    & $dockerCommand.Source compose --env-file $cloudEnvironmentPath up --detach --build --wait --wait-timeout 150
    if ($LASTEXITCODE -ne 0) { throw 'Docker no pudo iniciar los servicios. Revisa docker compose --env-file .env.local logs.' }
    Get-Content -LiteralPath (Join-Path $cloudProjectRoot 'server\db\04-record-limits.sql') -Raw | & $dockerCommand.Source compose --env-file $cloudEnvironmentPath exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d weight_exercise
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar el esquema local. Los registros no se han borrado.' }
    Get-Content -LiteralPath (Join-Path $cloudProjectRoot 'server\db\05-email-summaries.sql') -Raw | & $dockerCommand.Source compose --env-file $cloudEnvironmentPath exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d weight_exercise
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar el esquema de resumenes. Los registros no se han borrado.' }
    Get-Content -LiteralPath (Join-Path $cloudProjectRoot 'server\db\06-pro-licenses.sql') -Raw | & $dockerCommand.Source compose --env-file $cloudEnvironmentPath exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d weight_exercise
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el esquema de licencias. Los registros no se han borrado.' }
    Write-Host 'Nube local lista. API: http://127.0.0.1:3001/api/health' -ForegroundColor Green
    $cloudHealth = Invoke-RestMethod 'http://127.0.0.1:3001/api/health' -TimeoutSec 5
    if ($cloudHealth.mailMode -eq 'real') { Write-Host 'SMTP real activo: los codigos se envian al correo del usuario.' }
    else { Write-Host 'Bandeja de codigos local: http://127.0.0.1:8025 (no envia correos reales).' }
    Write-Host 'PostgreSQL no expone puertos. Los datos se conservan en el volumen de Docker.'
    if (-not $NoBrowser -and $cloudHealth.mailMode -ne 'real') { Start-Process 'http://127.0.0.1:8025' }
} finally { Pop-Location }
