param(
    [switch]$AcceptSdkLicense,
    [string]$JdkHome
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$licenseUrl = 'https://developer.android.com/studio#command-tools'

if (-not $AcceptSdkLicense) {
    throw "Antes de descargar el SDK, lee y acepta personalmente su licencia: $licenseUrl. Si estas de acuerdo, vuelve a ejecutar este script con -AcceptSdkLicense."
}

if (-not $JdkHome) {
    $javaCandidates = @($env:JAVA_HOME, 'C:\Program Files\Android\Android Studio\jbr')
    foreach ($base in @('C:\Program Files\Amazon Corretto', 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Microsoft')) {
        if (Test-Path -LiteralPath $base) {
            $javaCandidates += Get-ChildItem -LiteralPath $base -Directory | Select-Object -ExpandProperty FullName
        }
    }
    foreach ($candidate in $javaCandidates) {
        if (-not $candidate) { continue }
        $releasePath = Join-Path $candidate 'release'
        if ((Test-Path -LiteralPath $releasePath) -and ((Get-Content -LiteralPath $releasePath -Raw) -match 'JAVA_VERSION="21\.')) {
            $JdkHome = $candidate
            break
        }
    }
}
if (-not $JdkHome -or -not (Test-Path -LiteralPath (Join-Path $JdkHome 'bin/java.exe'))) {
    throw 'Falta un JDK 21. Instala uno y usa -JdkHome con la ruta de instalacion.'
}

$toolsRoot = Join-Path $projectRoot '.tools'
$sdkRoot = Join-Path $toolsRoot 'android-sdk'
$archivePath = Join-Path $toolsRoot 'commandlinetools-win-15859902_latest.zip'
$unpackRoot = Join-Path $sdkRoot 'cmdline-tools/download'
$sdkManagerJar = Join-Path $unpackRoot 'cmdline-tools/lib/sdkmanager-classpath.jar'
$expectedHash = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $archivePath) -or (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    Write-Host 'Descargando Android Command Line Tools desde Google (~156 MB)...'
    $downloadUrl = 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
    $curlCommand = Get-Command curl.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($curlCommand) {
        & $curlCommand.Source --fail --location --retry 3 --continue-at - --output $archivePath $downloadUrl
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo completar la descarga del SDK.' }
    } else {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing
    }
}
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw "La descarga no coincide con el SHA-256 publicado por Google. No se ejecutara. Revisa $archivePath."
}
if (-not (Test-Path -LiteralPath $sdkManagerJar)) {
    Expand-Archive -LiteralPath $archivePath -DestinationPath $unpackRoot -Force
}
if (-not (Test-Path -LiteralPath $sdkManagerJar)) { throw 'No se encontro sdkmanager dentro de la descarga verificada.' }

# -AcceptSdkLicense is an explicit user acceptance of the SDK agreement.
# Only install the packages needed for this app; no emulator or Android Studio.
Write-Host 'Instalando plataforma 36, herramientas de compilacion y platform-tools...'
$acceptedResponses = 1..10 | ForEach-Object { 'y' }
$acceptedResponses | & (Join-Path $JdkHome 'bin/java.exe') -classpath $sdkManagerJar `
    com.android.sdklib.tool.sdkmanager.SdkManagerCli "--sdk_root=$sdkRoot" `
    'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
if ($LASTEXITCODE -ne 0) { throw "sdkmanager termino con codigo $LASTEXITCODE." }
if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'platforms/android-36/android.jar'))) {
    throw 'La instalacion de la plataforma Android 36 no se completo.'
}
Write-Host "SDK listo en $sdkRoot" -ForegroundColor Green
Write-Host 'Ahora ejecuta scripts/build-android.ps1 para generar el APK.'
