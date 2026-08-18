param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$repo = [System.IO.Path]::GetFullPath($RepoRoot)

function Fail-ForgePreflight([string]$Message) {
    Write-Host ''
    Write-Host '[forge-native] Windows native build preflight FAILED.' -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
    exit 1
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
Install Visual Studio 2022 Build Tools (or Visual Studio 2022 Community) with the
"Desktop development with C++" workload, then run setup again.
'@
}

$vs2022 = (& $vswhere -latest -products * -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($vs2022)) {
    $vs2026 = (& $vswhere -latest -products * -version '[18.0,19.0)' -property installationPath | Select-Object -First 1)
    if (-not [string]::IsNullOrWhiteSpace($vs2026)) {
        Fail-ForgePreflight @"
Visual Studio 2026 was found at:
  $vs2026

This Forge branch uses the Node 20/npm native build chain whose bundled node-gyp
cannot reliably build the Electron native modules with VS 2026. Install Visual
Studio 2022 Build Tools side-by-side and select "Desktop development with C++"
(including MSVC v143 x64/x86 tools and a Windows 10/11 SDK).

You do NOT need to uninstall Visual Studio 2026.
"@
    }

    Fail-ForgePreflight @'
A usable Visual Studio 2022 C++ toolchain was not found.
Install Visual Studio 2022 Build Tools (or VS 2022 Community) and select
"Desktop development with C++", including MSVC v143 x64/x86 tools and a
Windows 10/11 SDK.
'@
}

Write-Host "[forge-native] Visual Studio 2022 C++ toolchain: $vs2022"

$windowsKits = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\Include'
if (-not (Test-Path $windowsKits) -or -not (Get-ChildItem $windowsKits -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    Fail-ForgePreflight @'
Visual Studio 2022 C++ tools were found, but a Windows SDK include directory was not.
Open Visual Studio Installer -> Modify -> Desktop development with C++ and add a
Windows 10 or Windows 11 SDK, then run setup again.
'@
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

Write-Host '[forge-native] Windows native build preflight passed.'
exit 0
