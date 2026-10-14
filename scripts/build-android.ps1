param([switch]$SkipWebBuild)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previousLocation = Get-Location
$previousJavaHome = $env:JAVA_HOME
$previousAndroidHome = $env:ANDROID_HOME

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "El comando termino con codigo $LASTEXITCODE." }
}

try {
    Set-Location -LiteralPath $projectRoot
    $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $nodeCommand) { throw 'Instala Node.js 22 o superior antes de compilar.' }

    $javaCandidates = @()
    if ($env:JAVA_HOME) { $javaCandidates += $env:JAVA_HOME }
    $javaCandidates += 'C:\Program Files\Android\Android Studio\jbr'
    foreach ($base in @('C:\Program Files\Amazon Corretto', 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Microsoft')) {
        if (Test-Path -LiteralPath $base) {
            $javaCandidates += Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -match 'jdk.?21|jdk-21' } | Select-Object -ExpandProperty FullName
        }
    }
    $javaHome = $null
    foreach ($candidate in $javaCandidates) {
        $javaPath = Join-Path $candidate 'bin/java.exe'
        $releasePath = Join-Path $candidate 'release'
        if (-not (Test-Path -LiteralPath $javaPath) -or -not (Test-Path -LiteralPath $releasePath)) { continue }
        $releaseContent = Get-Content -LiteralPath $releasePath -Raw
        if ($releaseContent -match 'JAVA_VERSION="21\.') { $javaHome = $candidate; break }
    }
    if (-not $javaHome) { throw 'Falta JDK 21. Instala un JDK 21 o Android Studio y configura JAVA_HOME.' }

    $sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $projectRoot '.tools/android-sdk'), (Join-Path $env:LOCALAPPDATA 'Android/Sdk'))
    $sdkRoot = $sdkCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platforms/android-36/android.jar')) } | Select-Object -First 1
    if (-not $sdkRoot) { throw 'Falta Android SDK con la plataforma 36. Configura ANDROID_HOME; consulta README.md. Las licencias deben ser aceptadas por ti durante la instalacion.' }

    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $sdkRoot
    if (-not $SkipWebBuild) {
        Invoke-Checked -Executable $nodeCommand.Source -Arguments @('node_modules/typescript/bin/tsc', '-b')
        Invoke-Checked -Executable $nodeCommand.Source -Arguments @('node_modules/vite/bin/vite.js', 'build')
    }
    if (-not (Test-Path -LiteralPath 'dist/index.html')) { throw 'No existe dist/index.html. Compila primero la app web.' }
    Invoke-Checked -Executable $nodeCommand.Source -Arguments @('node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android')
    Invoke-Checked -Executable (Join-Path $javaHome 'bin/java.exe') -Arguments @(
        '-classpath', 'android/gradle/wrapper/gradle-wrapper.jar',
        'org.gradle.wrapper.GradleWrapperMain', '--project-dir', 'android', 'assembleDebug', '--no-daemon'
    )
    $apkPath = Join-Path $projectRoot 'android/app/build/outputs/apk/debug/app-debug.apk'
    if (-not (Test-Path -LiteralPath $apkPath)) { throw 'Gradle termino sin generar el APK esperado.' }
    $apksignerJar = Join-Path $sdkRoot 'build-tools/36.0.0/lib/apksigner.jar'
    if (Test-Path -LiteralPath $apksignerJar) {
        Invoke-Checked -Executable (Join-Path $javaHome 'bin/java.exe') -Arguments @('-jar', $apksignerJar, 'verify', '--verbose', $apkPath)
    }
    $outputDirectory = Join-Path $projectRoot 'output'
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    $deliveryPath = Join-Path $outputDirectory 'Forma-debug.apk'
    Copy-Item -LiteralPath $apkPath -Destination $deliveryPath -Force
    Write-Host ''
    Write-Host "APK de prueba listo: $deliveryPath" -ForegroundColor Green
    Write-Host "SHA-256: $((Get-FileHash -LiteralPath $deliveryPath -Algorithm SHA256).Hash.ToLowerInvariant())"
} finally {
    $env:JAVA_HOME = $previousJavaHome
    $env:ANDROID_HOME = $previousAndroidHome
    Set-Location -LiteralPath $previousLocation.Path
}
