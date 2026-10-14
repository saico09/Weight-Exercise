[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 5173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previewUrl = "http://127.0.0.1:$Port"
$vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$outputLog = Join-Path $projectRoot '.preview-server.log'
$errorLog = Join-Path $projectRoot '.preview-errors.log'

function Test-PreviewPort {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $Port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Test-WeightExercisePreview {
    try {
        $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
        return $response.Content -match '<title>\s*Weight\s*(?:&|&amp;)\s*Exercise\s*</title>'
    } catch {
        return $false
    }
}

try {
    if (Test-PreviewPort) {
        if (-not (Test-WeightExercisePreview)) {
            throw "El puerto $Port pertenece a otra aplicacion. No se ha cerrado ningun proceso. Usa otro puerto: powershell -ExecutionPolicy Bypass -File `"scripts\start-preview.ps1`" -Port 5174"
        }
        Write-Host "Weight&Exercise ya esta disponible en $previewUrl" -ForegroundColor Green
    } else {
        $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $nodeCommand) {
            throw 'Instala Node.js 22 o superior, vuelve a abrir la terminal y ejecuta este archivo otra vez.'
        }
        if (-not (Test-Path -LiteralPath $vitePath -PathType Leaf)) {
            throw 'Faltan las dependencias. Abre una terminal en esta carpeta, ejecuta npm install y vuelve a iniciar Weight&Exercise.'
        }

        # Invocar Vite con Node evita los problemas de los .cmd con el & de la carpeta.
        $previewProcess = Start-Process -FilePath $nodeCommand.Source `
            -ArgumentList @("`"$vitePath`"", '--host', '127.0.0.1', '--port', "$Port", '--strictPort') `
            -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog

        $ready = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if (Test-WeightExercisePreview) {
                $ready = $true
                break
            }
            $previewProcess.Refresh()
            if ($previewProcess.HasExited) { break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) {
            throw "No se pudo iniciar Weight&Exercise. Revisa los archivos $outputLog y $errorLog."
        }
        Write-Host "Weight&Exercise esta lista en $previewUrl" -ForegroundColor Green
        Write-Host "Servidor local PID: $($previewProcess.Id). Para detenerlo: Stop-Process -Id $($previewProcess.Id)"
    }

    if (-not $NoBrowser) {
        Start-Process $previewUrl
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
