param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$checkScript = Join-Path $PSScriptRoot 'forge-windows-spectre-check.ps1'

function Test-ForgeSpectreReady {
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $checkScript -RepoRoot $RepoRoot
    return $LASTEXITCODE -eq 0
}

if (Test-ForgeSpectreReady) {
    exit 0
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$installer = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\setup.exe'
if (-not (Test-Path $vswhere) -or -not (Test-Path $installer)) {
    throw 'Visual Studio Installer is required to add Spectre-mitigated libraries.'
}

$vs2022 = (& $vswhere -latest -products * -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
$vs2026 = (& $vswhere -latest -products * -version '[18.0,19.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
$selectedVs = if (-not [string]::IsNullOrWhiteSpace($vs2022)) { $vs2022 } else { $vs2026 }
$selectedLabel = if (-not [string]::IsNullOrWhiteSpace($vs2022)) { '2022' } else { '2026' }
if ([string]::IsNullOrWhiteSpace($selectedVs)) {
    throw 'No Visual Studio 2022/2026 C++ installation was found.'
}

$components = @(
    'Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATL.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre'
)

# Microsoft supports adding components to an existing instance with setup.exe
# modify --installPath <instance> --add <component>. Use passive mode so the user
# can see progress; the operation is elevated because standard-user automation
# cannot use passive/quiet modification safely.
$args = @('modify', '--installPath', $selectedVs)
foreach ($component in $components) {
    $args += @('--add', $component)
}
$args += @('--passive', '--norestart')

$tempWork = Join-Path $env:TEMP 'forge-vs-installer-work'
New-Item -ItemType Directory -Force -Path $tempWork | Out-Null

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host "[forge-native] Visual Studio $selectedLabel is missing Forge Spectre prerequisites."
Write-Host "[forge-native] Installing the required Spectre components into: $selectedVs"
Write-Host '[forge-native] Windows may show a User Account Control prompt. Approve it to continue setup.'

try {
    if ($isAdmin) {
        $process = Start-Process -FilePath $installer -ArgumentList $args -WorkingDirectory $tempWork -Wait -PassThru
    } else {
        $process = Start-Process -FilePath $installer -ArgumentList $args -WorkingDirectory $tempWork -Verb RunAs -Wait -PassThru
    }
} catch {
    throw @"
Forge could not start the elevated Visual Studio Installer operation.
Approve the Windows UAC prompt, or install these components manually from
Visual Studio Installer -> Modify -> Individual components -> search "Spectre":
  Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre
  Microsoft.VisualStudio.Component.VC.ATL.Spectre
  Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre

Installer error: $($_.Exception.Message)
"@
}

if ($process.ExitCode -notin @(0, 3010)) {
    throw "Visual Studio Installer exited with code $($process.ExitCode). Open Visual Studio Installer and review the installation error before rerunning Forge setup."
}

if ($process.ExitCode -eq 3010) {
    Write-Warning 'Visual Studio Installer requested a Windows restart (exit code 3010). Forge will verify the libraries now; if verification fails, restart Windows and rerun setup.'
}

Start-Sleep -Seconds 2
if (-not (Test-ForgeSpectreReady)) {
    if ($process.ExitCode -eq 3010) {
        throw 'Spectre components were installed but are not active yet. Restart Windows, then rerun .\setup-forge-super-agent.bat.'
    }
    throw @'
Visual Studio Installer completed, but Forge still cannot verify the complete
Spectre component set. Open Visual Studio Installer -> Modify -> Individual
components, search "Spectre", confirm all three x64/x86 components are selected,
then rerun setup.
'@
}

Write-Host '[forge-native] Spectre prerequisites installed and verified.'
exit 0
