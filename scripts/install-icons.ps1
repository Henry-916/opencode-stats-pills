[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This optional font installer supports Windows only.' }
$iconSource = Join-Path $PSScriptRoot '../assets/StatsPillsIcons.ttf'
if (-not (Test-Path -LiteralPath $iconSource -PathType Leaf)) { throw "Bundled font was not found: $iconSource" }
$fontDirectory = Join-Path $env:LOCALAPPDATA 'Microsoft/Windows/Fonts'
$installedFont = Join-Path $fontDirectory 'StatsPillsIcons-1.7.ttf'
$iconFamily = 'StatsPills Icons Large v1.7'

if (-not $PSCmdlet.ShouldProcess($installedFont, 'Install the optional StatsPills icon font for the current user')) { return }
New-Item -ItemType Directory -Path $fontDirectory -Force | Out-Null
Copy-Item -LiteralPath $iconSource -Destination $installedFont -Force
$fontRegistry = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
New-Item -Path $fontRegistry -Force | Out-Null
New-ItemProperty -Path $fontRegistry -Name "$iconFamily (TrueType)" -Value $installedFont -PropertyType String -Force | Out-Null
if (-not ('StatsPillsFontLoader' -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class StatsPillsFontLoader {
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] public static extern int AddFontResourceEx(string name,uint flags,IntPtr reserved);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr window,uint message,IntPtr wparam,IntPtr lparam,uint flags,uint timeout,out IntPtr result);
}
"@
}
$loaded = [StatsPillsFontLoader]::AddFontResourceEx($installedFont,0,[IntPtr]::Zero)
$fontBroadcastResult = [IntPtr]::Zero
[StatsPillsFontLoader]::SendMessageTimeout([IntPtr]0xffff,0x001d,[IntPtr]::Zero,[IntPtr]::Zero,2,1000,[ref]$fontBroadcastResult) | Out-Null
if ($loaded -eq 0) { Write-Warning 'Windows could not load the font immediately. Restart your terminal to refresh installed fonts.' }
Write-Output "Installed optional font: $iconFamily"
Write-Output 'Terminal settings were not changed. Add this family to your terminal font fallback list manually, then restart the terminal and OpenCode.'
