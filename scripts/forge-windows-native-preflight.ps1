param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [switch]$InstallDependencies
)

$ErrorActionPreference = 'Stop'
$repo = [System.IO.Path]::GetFullPath($RepoRoot)
$nodeGypCompatVersion = '12.4.0'

function Fail-ForgePreflight([string]$Message) {
    Write-Host ''
    Write-Host '[forge-native] Windows native build preflight FAILED.' -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
    exit 1
}

function Invoke-ForgeCommand([string]$FilePath, [string[]]$Arguments) {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail-ForgePreflight "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
}

Write-Host '[forge-native] Checking Windows native build toolchain...'

# Keep the local runtime close to CI without blocking compatible Node 20 patch updates.
$nvmrc = Join-Path $repo '.nvmrc'
if (Test-Path $nvmrc) {
    $expectedNode = (Get-Content $nvmrc -Raw).Trim()
    $actualNode = (& node -p "process.version.slice(1)").Trim()
    if ($actualNode -ne $expectedNode) {
        Write-Warning "Forge CI is pinned to Node $expectedNode; this machine is using Node $actualNode. The setup can continue, but matching .nvmrc is recommended for release reproduction."
    } else {
        Write-Host "[forge-native] Node version matches .nvmrc: $actualNode"
    }
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path $vswhere)) {
    Fail-ForgePreflight @'
Visual Studio Installer / vswhere was not found.
Install Visual Studio 2022 or Visual Studio 2026 with the "Desktop development
with C++" workload, then run setup again.
'@
}

$vs2022 = (& $vswhere -latest -products * -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
$vs2026 = (& $vswhere -latest -products * -version '[18.0,19.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)

$selectedVs = $null
$selectedVsVersion = $null
if (-not [string]::IsNullOrWhiteSpace($vs2022)) {
    $selectedVs = $vs2022
    $selectedVsVersion = '2022'
} elseif (-not [string]::IsNullOrWhiteSpace($vs2026)) {
    $selectedVs = $vs2026
    $selectedVsVersion = '2026'
} else {
    $anyVs2026 = (& $vswhere -latest -products * -version '[18.0,19.0)' -property installationPath | Select-Object -First 1)
    $anyVs2022 = (& $vswhere -latest -products * -version '[17.0,18.0)' -property installationPath | Select-Object -First 1)
    $found = @($anyVs2022, $anyVs2026) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($found.Count -gt 0) {
        Fail-ForgePreflight @"
Visual Studio was found, but the x64/x86 C++ build tools were not detected.
Found installation(s):
  $($found -join "`n  ")

Open Visual Studio Installer -> Modify and enable "Desktop development with C++",
including the MSVC x64/x86 toolset and a Windows 10/11 SDK.
"@
    }

    Fail-ForgePreflight @'
No usable Visual Studio C++ toolchain was found.
Install Visual Studio 2022 or Visual Studio 2026 and select "Desktop development
with C++", including the MSVC x64/x86 toolset and a Windows 10/11 SDK.
'@
}

Write-Host "[forge-native] Visual Studio $selectedVsVersion C++ toolchain: $selectedVs"

$windowsKits = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\Include'
if (-not (Test-Path $windowsKits) -or -not (Get-ChildItem $windowsKits -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    Fail-ForgePreflight @"
Visual Studio $selectedVsVersion C++ tools were found, but a Windows SDK include
directory was not. Open Visual Studio Installer -> Modify -> Desktop development
with C++ and add a Windows 10 or Windows 11 SDK, then run setup again.
"@
}

# npm ci replaces native modules. Running Forge/watch/browser processes can keep
# DLLs and native directories locked, producing EBUSY cleanup warnings or failures.
$repoScoped = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -in @('node.exe', 'electron.exe', 'chrome.exe', 'chromium.exe') -and
    (
        ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) -or
        ($_.CommandLine -and $_.CommandLine.IndexOf($repo, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
    )
}

if ($repoScoped) {
    Write-Host '[forge-native] Stopping repo-scoped Forge processes that can lock node_modules...'
    foreach ($process in $repoScoped) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
            Write-Host "[forge-native] Stopped $($process.Name) PID $($process.ProcessId)"
        } catch {
            Write-Warning "Could not stop $($process.Name) PID $($process.ProcessId): $($_.Exception.Message)"
        }
    }
    Start-Sleep -Milliseconds 750
}

# Node 20 ships with npm/node-gyp versions that predate VS2026 recognition. When
# VS2026 is the available compiler, use a Forge-owned node-gyp 12.4.0 toolchain.
# node-gyp 12.1+ added VS2026 support and 12.4.0 still supports Node >=20.17.
$nodeGypJs = $null
if ($selectedVsVersion -eq '2026') {
    $toolchainRoot = Join-Path $env:USERPROFILE ".forge\toolchains\node-gyp-$nodeGypCompatVersion"
    $nodeGypJs = Join-Path $toolchainRoot 'node_modules\node-gyp\bin\node-gyp.js'
    $nodeGypPackage = Join-Path $toolchainRoot 'node_modules\node-gyp\package.json'
    $needsBootstrap = $true

    if (Test-Path $nodeGypPackage) {
        try {
            $installedVersion = (Get-Content $nodeGypPackage -Raw | ConvertFrom-Json).version
            $needsBootstrap = $installedVersion -ne $nodeGypCompatVersion
        } catch {
            $needsBootstrap = $true
        }
    }

    if ($needsBootstrap) {
        Write-Host "[forge-native] Bootstrapping node-gyp $nodeGypCompatVersion for Visual Studio 2026..."
        New-Item -ItemType Directory -Force -Path $toolchainRoot | Out-Null
        Invoke-ForgeCommand 'npm' @(
            'install',
            '--prefix', $toolchainRoot,
            "node-gyp@$nodeGypCompatVersion",
            '--no-save',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund'
        )
    }

    if (-not (Test-Path $nodeGypJs)) {
        Fail-ForgePreflight "Pinned node-gyp bootstrap did not create $nodeGypJs"
    }

    $nodeGypVersion = (& node $nodeGypJs --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $nodeGypVersion -ne "v$nodeGypCompatVersion") {
        Fail-ForgePreflight "Expected node-gyp v$nodeGypCompatVersion but got '$nodeGypVersion'."
    }

    $nodeGypBin = Join-Path $toolchainRoot 'node_modules\.bin'
    $env:PATH = "$nodeGypBin;$env:PATH"
    # npm 10 honors npm_config_node_gyp; PATH also covers dependencies with an
    # explicit `node-gyp rebuild` install script.
    $env:npm_config_node_gyp = $nodeGypJs
    $env:npm_config_msvs_version = '2026'
    $env:npm_package_config_node_gyp_msvs_version = '2026'
    Write-Host "[forge-native] VS2026 compatibility node-gyp: $nodeGypVersion"
} else {
    $env:npm_config_msvs_version = '2022'
    $env:npm_package_config_node_gyp_msvs_version = '2022'
}

Write-Host '[forge-native] Windows native build preflight passed.'

if ($InstallDependencies) {
    Write-Host '[forge-native] Installing deterministic Forge dependencies with npm ci...'
    Push-Location $repo
    try {
        if ($nodeGypJs) {
            # --node-gyp makes npm's implicit binding.gyp install path use the
            # same pinned executable; PATH handles explicit node-gyp scripts.
            Invoke-ForgeCommand 'npm' @('ci', "--node-gyp=$nodeGypJs")
        } else {
            Invoke-ForgeCommand 'npm' @('ci')
        }
    } finally {
        Pop-Location
    }
    Write-Host '[forge-native] npm ci completed successfully.'
}

exit 0
