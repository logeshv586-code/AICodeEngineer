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
Close any terminal, editor, Forge/Electron, Playwright/Chromium, antivirus scan, or
Explorer window actively using this repository and run setup again.

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

$npmCommand = 'npm'
$npmArgumentsPrefix = @()

if ($selectedVsVersion -eq '2026') {
    # npm bundled with Node 20 carries an older node-gyp and rewrites the node-gyp
    # lifecycle environment to that bundled copy. External --node-gyp overrides
    # therefore do not reliably affect dependency install scripts. Use a private,
    # pinned npm release whose own bundled node-gyp supports Visual Studio 2026.
    $toolchainRoot = Join-Path $env:USERPROFILE ".forge\toolchains\npm-$forgeNpmVersion"
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
        Invoke-ForgeCommand 'npm' @(
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

    $actualForgeNpmVersion = (& node $forgeNpmCli --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $actualForgeNpmVersion -ne $forgeNpmVersion) {
        Fail-ForgePreflight "Expected Forge npm $forgeNpmVersion but got '$actualForgeNpmVersion'."
    }

    $forgeNodeGyp = Join-Path $toolchainRoot 'node_modules\npm\node_modules\node-gyp\bin\node-gyp.js'
    if (-not (Test-Path $forgeNodeGyp)) {
        Fail-ForgePreflight "Forge npm $forgeNpmVersion does not contain its bundled node-gyp at $forgeNodeGyp"
    }

    $forgeNodeGypVersion = (& node $forgeNodeGyp --version).Trim()
    if ($LASTEXITCODE -ne 0) {
        Fail-ForgePreflight 'Could not execute the node-gyp bundled with Forge npm.'
    }
    $nodeGypMajor = [int](($forgeNodeGypVersion.TrimStart('v') -split '\.')[0])
    if ($nodeGypMajor -lt 12) {
        Fail-ForgePreflight "Forge npm bundled node-gyp '$forgeNodeGypVersion', but VS2026 requires node-gyp 12.1 or newer."
    }

    $npmCommand = 'node'
    $npmArgumentsPrefix = @($forgeNpmCli)
    $env:npm_config_msvs_version = '2026'
    $env:npm_package_config_node_gyp_msvs_version = '2026'
    Write-Host "[forge-native] Forge npm runtime: $actualForgeNpmVersion"
    Write-Host "[forge-native] Forge npm bundled node-gyp: $forgeNodeGypVersion"
} else {
    $env:npm_config_msvs_version = '2022'
    $env:npm_package_config_node_gyp_msvs_version = '2022'
}

Write-Host '[forge-native] Windows native build preflight passed.'

if ($InstallDependencies) {
    Remove-ForgeNodeModulesWithRetry
    Write-Host '[forge-native] Installing deterministic Forge dependencies with npm ci...'
    Push-Location $repo
    try {
        Invoke-ForgeCommand $npmCommand ($npmArgumentsPrefix + @('ci'))
    } finally {
        Pop-Location
    }
    Write-Host '[forge-native] npm ci completed successfully.'
}

exit 0
