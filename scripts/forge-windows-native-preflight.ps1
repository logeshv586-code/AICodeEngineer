param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [switch]$InstallDependencies
)

$ErrorActionPreference = 'Stop'
$repo = [System.IO.Path]::GetFullPath($RepoRoot)
$forgeNpmVersion = '11.16.0'

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

function Remove-ForgeNodeModulesWithRetry {
    $nodeModules = Join-Path $repo 'node_modules'
    if (-not (Test-Path $nodeModules)) { return }

    Write-Host '[forge-native] Removing the previous node_modules tree before deterministic install...'
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            Remove-Item -LiteralPath $nodeModules -Recurse -Force -ErrorAction Stop
            Write-Host '[forge-native] Previous node_modules tree removed.'
            return
        } catch {
            if ($attempt -eq 4) {
                Fail-ForgePreflight @"
Could not fully remove:
  $nodeModules

Windows still has one or more files locked after four cleanup attempts.
Close any editor/Forge/Electron/Playwright process using this repository and run
setup again. Antivirus or Explorer preview handlers may also temporarily hold DLLs.

Last error: $($_.Exception.Message)
"@
            }
            Write-Warning "node_modules cleanup attempt $attempt failed: $($_.Exception.Message)"
            Start-Sleep -Seconds $attempt
        }
    }
}

Write-Host '[forge-native] Checking Windows native build toolchain...'

$nvmrc = Join-Path $repo '.nvmrc'
if (-not (Test-Path $nvmrc)) {
    Fail-ForgePreflight '.nvmrc is missing; Forge cannot determine its pinned Node runtime.'
}
$expectedNode = (Get-Content $nvmrc -Raw).Trim()
$actualNode = (& node -p "process.version.slice(1)").Trim()
if ($actualNode -ne $expectedNode) {
    Write-Warning "System Node is $actualNode; Forge setup is pinned to Node $expectedNode and will use its private checksummed runtime instead."
}

# Always resolve the checksummed project runtime. This prevents a machine-level
# Node upgrade (for example Node 25) from changing Electron native ABI/build behavior.
$node20RuntimeScript = Join-Path $repo 'scripts\forge-node20-runtime.mjs'
if (-not (Test-Path $node20RuntimeScript)) {
    Fail-ForgePreflight "Pinned Node runtime helper is missing: $node20RuntimeScript"
}
$forgeNodeOutput = & node $node20RuntimeScript ensure
if ($LASTEXITCODE -ne 0) {
    Fail-ForgePreflight 'Could not prepare the checksummed Forge Node 20 runtime.'
}
$forgeNode = ($forgeNodeOutput | Select-Object -Last 1).Trim()
if (-not (Test-Path $forgeNode)) {
    Fail-ForgePreflight "Forge Node runtime path does not exist: $forgeNode"
}
$forgeNodeVersion = (& $forgeNode --version).Trim()
if ($forgeNodeVersion -ne "v$expectedNode") {
    Fail-ForgePreflight "Expected Forge Node v$expectedNode but resolved '$forgeNodeVersion'."
}
$forgeNodeHome = Split-Path -Parent $forgeNode
$forgeBundledNpmCli = Join-Path $forgeNodeHome 'node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path $forgeBundledNpmCli)) {
    Fail-ForgePreflight "Pinned Node runtime is missing npm CLI: $forgeBundledNpmCli"
}
$env:PATH = "$forgeNodeHome;$env:PATH"
Write-Host "[forge-native] Forge Node runtime: $forgeNodeVersion"

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
    Start-Sleep -Milliseconds 1000
}

$npmCli = $forgeBundledNpmCli

if ($selectedVsVersion -eq '2026') {
    # The npm bundled with Node 20 contains node-gyp 10, which predates VS2026.
    # Bootstrap npm 11 under the pinned Node 20 runtime so dependency lifecycle
    # scripts inherit a VS2026-aware bundled node-gyp rather than system npm.
    $toolchainRoot = Join-Path $env:USERPROFILE ".forge\toolchains\npm-$forgeNpmVersion-node20"
    $forgeNpmCli = Join-Path $toolchainRoot 'node_modules\npm\bin\npm-cli.js'
    $forgeNpmPackage = Join-Path $toolchainRoot 'node_modules\npm\package.json'
    $needsBootstrap = $true

    if (Test-Path $forgeNpmPackage) {
        try {
            $installedNpmVersion = (Get-Content $forgeNpmPackage -Raw | ConvertFrom-Json).version
            $needsBootstrap = $installedNpmVersion -ne $forgeNpmVersion
        } catch {
            $needsBootstrap = $true
        }
    }

    if ($needsBootstrap) {
        Write-Host "[forge-native] Bootstrapping Forge npm $forgeNpmVersion for Visual Studio 2026..."
        New-Item -ItemType Directory -Force -Path $toolchainRoot | Out-Null
        Invoke-ForgeCommand $forgeNode @(
            $forgeBundledNpmCli,
            'install',
            '--prefix', $toolchainRoot,
            "npm@$forgeNpmVersion",
            '--no-save',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund'
        )
    }

    if (-not (Test-Path $forgeNpmCli)) {
        Fail-ForgePreflight "Forge npm bootstrap did not create $forgeNpmCli"
    }

    $actualForgeNpmVersion = (& $forgeNode $forgeNpmCli --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $actualForgeNpmVersion -ne $forgeNpmVersion) {
        Fail-ForgePreflight "Expected Forge npm $forgeNpmVersion but got '$actualForgeNpmVersion'."
    }

    $forgeNodeGyp = Join-Path $toolchainRoot 'node_modules\npm\node_modules\node-gyp\bin\node-gyp.js'
    if (-not (Test-Path $forgeNodeGyp)) {
        Fail-ForgePreflight "Forge npm $forgeNpmVersion does not contain its bundled node-gyp at $forgeNodeGyp"
    }

    $forgeNodeGypVersion = (& $forgeNode $forgeNodeGyp --version).Trim()
    if ($LASTEXITCODE -ne 0) {
        Fail-ForgePreflight 'Could not execute the node-gyp bundled with Forge npm.'
    }
    $nodeGypParts = $forgeNodeGypVersion.TrimStart('v') -split '\.'
    $nodeGypMajor = [int]$nodeGypParts[0]
    $nodeGypMinor = [int]$nodeGypParts[1]
    if ($nodeGypMajor -lt 12 -or ($nodeGypMajor -eq 12 -and $nodeGypMinor -lt 1)) {
        Fail-ForgePreflight "Forge npm bundled node-gyp '$forgeNodeGypVersion', but VS2026 requires node-gyp 12.1 or newer."
    }

    $npmCli = $forgeNpmCli
    $env:npm_config_msvs_version = '2026'
    $env:npm_package_config_node_gyp_msvs_version = '2026'
    Write-Host "[forge-native] Forge npm runtime: $actualForgeNpmVersion"
    Write-Host "[forge-native] Forge npm bundled node-gyp: $forgeNodeGypVersion"
} else {
    $env:npm_config_msvs_version = '2022'
    $env:npm_package_config_node_gyp_msvs_version = '2022'
}

# npm 7+ backgrounds install lifecycle scripts. Several VS Code native modules
# reference the shared @vscode/node-addon-api project and can race while GYP is
# generating node_addon_api.sln. Foreground scripts make that lifecycle stage
# sequential and eliminate the FileExistsError race seen on Windows.
$env:npm_config_foreground_scripts = 'true'
Write-Host '[forge-native] Native dependency scripts: serialized foreground mode.'
Write-Host '[forge-native] Windows native build preflight passed.'

if ($InstallDependencies) {
    Remove-ForgeNodeModulesWithRetry
    Write-Host '[forge-native] Installing deterministic Forge dependencies with npm ci...'
    Push-Location $repo
    try {
        Invoke-ForgeCommand $forgeNode @($npmCli, 'ci', '--foreground-scripts')
    } finally {
        Pop-Location
    }
    Write-Host '[forge-native] npm ci completed successfully.'
}

exit 0
