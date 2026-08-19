param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$checkScript = Join-Path $PSScriptRoot 'forge-windows-spectre-check.ps1'

& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $checkScript -RepoRoot $RepoRoot
if ($LASTEXITCODE -eq 0) {
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
if ([string]::IsNullOrWhiteSpace($selectedVs)) {
    throw 'No Visual Studio 2022/2026 C++ installation was found.'
}

$components = @(
    'Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATL.Spectre',
    'Microsoft.VisualStudio.Component.VC.ATLMFC.Spectre'
)
$args = @('modify', '--installPath', $selectedVs)
foreach ($component in $components) {
    $args += @('--add', $component)
}
$args += @('--quiet', '--norestart')

Write-Host "[forge-native] Installing missing Spectre components into: $selectedVs"
$tempWork = Join-Path $env:TEMP 'forge-vs-installer-work'
New-Item -ItemType Directory -Force -Path $tempWork | Out-Null
$process = Start-Process -FilePath $installer -ArgumentList $args -WorkingDirectory $tempWork -Wait -PassThru
if ($process.ExitCode -notin @(0, 3010)) {
    throw "Visual Studio Installer exited with code $($process.ExitCode)."
}

& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $checkScript -RepoRoot $RepoRoot
if ($LASTEXITCODE -ne 0) {
    throw 'Spectre component installation completed, but Forge still cannot find the x64 Spectre libraries.'
}
