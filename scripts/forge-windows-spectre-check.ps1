param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

function Fail-ForgeSpectre([string]$Message) {
    Write-Host ''
    Write-Host '[forge-native] Windows Spectre library check FAILED.' -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
    exit 1
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path $vswhere)) {
    Fail-ForgeSpectre 'Visual Studio Installer / vswhere was not found.'
}

$vs2022 = (& $vswhere -latest -products * -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
$vs2026 = (& $vswhere -latest -products * -version '[18.0,19.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
$selectedVs = if (-not [string]::IsNullOrWhiteSpace($vs2022)) { $vs2022 } else { $vs2026 }
$selectedLabel = if (-not [string]::IsNullOrWhiteSpace($vs2022)) { '2022' } else { '2026' }

if ([string]::IsNullOrWhiteSpace($selectedVs)) {
    Fail-ForgeSpectre 'No Visual Studio 2022/2026 x64/x86 C++ toolchain was found.'
}

$msvcRoot = Join-Path $selectedVs 'VC\Tools\MSVC'
if (-not (Test-Path $msvcRoot)) {
    Fail-ForgeSpectre "MSVC tools directory is missing: $msvcRoot"
}

$toolsets = Get-ChildItem $msvcRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
$spectreToolset = $null
$spectreDir = $null
foreach ($toolset in $toolsets) {
    $candidate = Join-Path $toolset.FullName 'lib\spectre\x64'
    if ((Test-Path $candidate) -and (Get-ChildItem $candidate -Filter '*.lib' -File -ErrorAction SilentlyContinue | Select-Object -First 1)) {
        $spectreToolset = $toolset.Name
        $spectreDir = $candidate
        break
    }
}

if (-not $spectreDir) {
    Fail-ForgeSpectre @"
Forge/Code-OSS native modules are built with Spectre mitigation enabled, but the
x64 Spectre-mitigated MSVC libraries are not installed for Visual Studio $selectedLabel:
  $selectedVs

Open Visual Studio Installer -> Modify -> Individual components, search for
"Spectre", and install:
  - C++ Spectre-mitigated libraries for x64/x86 (Latest MSVC)

For full Void/VS Code contributor parity, also install the matching ATL and MFC
Spectre-mitigated components when available.

Do not disable /Qspectre in Forge to bypass this check; upstream native projects
expect the mitigated runtime libraries.
"@
}

Write-Host "[forge-native] Visual Studio $selectedLabel Spectre libraries: $spectreToolset"
Write-Host "[forge-native] Spectre x64 library path: $spectreDir"
exit 0
