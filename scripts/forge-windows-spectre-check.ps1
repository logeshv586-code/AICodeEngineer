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

$componentReady2022 = (& $vswhere -latest -products * -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre Microsoft.VisualStudio.Component.VC.ATL.Spectre Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre -property installationPath | Select-Object -First 1)
$componentReady2026 = (& $vswhere -latest -products * -version '[18.0,19.0)' -requires Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre Microsoft.VisualStudio.Component.VC.ATL.Spectre Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre -property installationPath | Select-Object -First 1)
$componentReady = if ($selectedLabel -eq '2022') { $componentReady2022 } else { $componentReady2026 }

if ([string]::IsNullOrWhiteSpace($componentReady)) {
    Fail-ForgeSpectre @"
The Visual Studio $selectedLabel C++ compiler is installed, but Forge is missing
one or more Spectre components required by the upstream VS Code/Void native build:
  $selectedVs

Open Visual Studio Installer -> Modify -> Individual components, search for
"Spectre", and install the x64/x86 versions of:
  - C++ Spectre-mitigated libraries (Latest MSVC)
  - C++ ATL with Spectre Mitigations
  - C++ MFC with Spectre Mitigations

The underlying component IDs are:
  Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre
  Microsoft.VisualStudio.Component.VC.ATL.Spectre
  Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre

Do not disable /Qspectre in Forge to bypass the upstream native-build requirement.
"@
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
Visual Studio reports the Spectre components as installed, but the active MSVC
toolset does not expose an x64 Spectre library directory under:
  $msvcRoot

Repair/modify Visual Studio $selectedLabel and reinstall the Spectre-mitigated
libraries for the active x64/x86 MSVC toolset.
"@
}

Write-Host "[forge-native] Visual Studio $selectedLabel complete Spectre component set: present"
Write-Host "[forge-native] Spectre MSVC toolset: $spectreToolset"
Write-Host "[forge-native] Spectre x64 library path: $spectreDir"
exit 0
