param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$checkScript = Join-Path $PSScriptRoot 'forge-windows-spectre-check.ps1'

function Stop-ForgeSpectreEnsure([string]$Message) {
    Write-Host ''
    Write-Host '[forge-native] Spectre prerequisite installation stopped.' -ForegroundColor Yellow
    Write-Host $Message -ForegroundColor Yellow
    exit 1
}

function Test-ForgeSpectreReady([switch]$Silent) {
    if ($Silent) {
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $checkScript -RepoRoot $RepoRoot *> $null
    } else {
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $checkScript -RepoRoot $RepoRoot
    }
    return $LASTEXITCODE -eq 0
}

if (Test-ForgeSpectreReady -Silent) {
    Write-Host '[forge-native] Spectre prerequisites already installed.'
    exit 0
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$installer = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\setup.exe'
if (-not (Test-Path $vswhere) -or -not (Test-Path $installer)) {
    Stop-ForgeSpectreEnsure 'Visual Studio Installer is required to add Spectre-mitigated libraries.'
}

$vs2022 = (& $vswhere -latest -products * -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
$vs2026 = (& $vswhere -latest -products * -version '[18.0,19.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
$selectedVs = if (-not [string]::IsNullOrWhiteSpace($vs2022)) { $vs2022 } else { $vs2026 }
$selectedLabel = if (-not [string]::IsNullOrWhiteSpace($vs2022)) { '2022' } else { '2026' }
if ([string]::IsNullOrWhiteSpace($selectedVs)) {
    Stop-ForgeSpectreEnsure 'No Visual Studio 2022/2026 C++ installation was found.'
}

$components = @(
    'Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATL.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre'
)

# Start-Process joins an ArgumentList array into one command line and removes the
# PowerShell string's outer quotes. Microsoft recommends passing one argument
# string with explicit quote characters when an argument contains spaces.
# Keep the Visual Studio instance path quoted across the UAC/elevation boundary.
$quotedInstallPath = '"' + $selectedVs + '"'
$componentArguments = ($components | ForEach-Object { "--add $_" }) -join ' '
$argumentLine = "modify --installPath $quotedInstallPath $componentArguments --passive --norestart"

$tempWork = Join-Path $env:TEMP 'forge-vs-installer-work'
New-Item -ItemType Directory -Force -Path $tempWork | Out-Null

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host "[forge-native] Visual Studio $selectedLabel is missing Forge Spectre prerequisites."
Write-Host "[forge-native] Installing the required Spectre components into: $selectedVs"
Write-Host "[forge-native] Installer target: $quotedInstallPath"
Write-Host '[forge-native] Windows may show a User Account Control prompt. Choose Yes to continue setup.'

try {
    if ($isAdmin) {
        $process = Start-Process -FilePath $installer -ArgumentList $argumentLine -WorkingDirectory $tempWork -Wait -PassThru
    } else {
        $process = Start-Process -FilePath $installer -ArgumentList $argumentLine -WorkingDirectory $tempWork -Verb RunAs -Wait -PassThru
    }
} catch {
    $message = $_.Exception.Message
    $nativeCode = $null
    if ($_.Exception.PSObject.Properties.Name -contains 'NativeErrorCode') {
        $nativeCode = $_.Exception.NativeErrorCode
    }

    if ($nativeCode -eq 1223 -or $message -match '(?i)operation was cancel+ed by the user|operation was cancel+ed') {
        Stop-ForgeSpectreEnsure @"
Windows UAC approval was cancelled, so Visual Studio was not modified.

Run this again and choose Yes on the UAC prompt:
  .\setup-forge-super-agent.bat

Alternative: open PowerShell as Administrator first, go to the Forge repository,
and run the same setup command. Windows still requires administrator approval for
Visual Studio component changes; Forge does not bypass that security boundary.
"@
    }

    Stop-ForgeSpectreEnsure @"
Forge could not start the elevated Visual Studio Installer operation.
Install these components manually from Visual Studio Installer -> Modify ->
Individual components -> search "Spectre":
  Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre
  Microsoft.VisualStudio.Component.VC.ATL.Spectre
  Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre

Installer error: $message
"@
}

if ($process.ExitCode -notin @(0, 3010)) {
    Stop-ForgeSpectreEnsure @"
Visual Studio Installer exited with code $($process.ExitCode).

Expected instance path:
  $selectedVs

If the installer log says "installPath: C:\Program", pull the latest Forge main
and rerun setup; that indicates an older unquoted argument path was used.
Otherwise open Visual Studio Installer and review the installation error.
"@
}

if ($process.ExitCode -eq 3010) {
    Write-Warning 'Visual Studio Installer requested a Windows restart (exit code 3010). Forge will verify the libraries now; if verification fails, restart Windows and rerun setup.'
}

Start-Sleep -Seconds 2
if (-not (Test-ForgeSpectreReady)) {
    if ($process.ExitCode -eq 3010) {
        Stop-ForgeSpectreEnsure 'Spectre components were installed but are not active yet. Restart Windows, then rerun .\setup-forge-super-agent.bat.'
    }
    Stop-ForgeSpectreEnsure @'
Visual Studio Installer completed, but Forge still cannot verify the complete
Spectre component set. Open Visual Studio Installer -> Modify -> Individual
components, search "Spectre", confirm all three x64/x86 components are selected,
then rerun setup.
'@
}

Write-Host '[forge-native] Spectre prerequisites installed and verified.'
exit 0
