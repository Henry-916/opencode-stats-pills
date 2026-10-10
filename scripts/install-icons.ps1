$ErrorActionPreference = 'Stop'
$terminalSettings = Join-Path $env:LOCALAPPDATA 'Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json'
if (-not (Test-Path -LiteralPath $terminalSettings)) {
    throw 'Stable Windows Terminal settings were not found. Open Windows Terminal once, or follow the manual font setup in docs/installation.md.'
}
$settings = Get-Content -LiteralPath $terminalSettings -Raw | ConvertFrom-Json
if (-not $settings) { throw 'Windows Terminal settings must contain a JSON object.' }
if (-not $settings.profiles) { $settings | Add-Member -NotePropertyName profiles -NotePropertyValue ([pscustomobject]@{}) -Force }
if (-not $settings.profiles.defaults) { $settings.profiles | Add-Member -NotePropertyName defaults -NotePropertyValue ([pscustomobject]@{}) -Force }
$iconSource = Join-Path $PSScriptRoot '../assets/StatsPillsIcons.ttf'
$fontDirectory = Join-Path $env:LOCALAPPDATA 'Microsoft/Windows/Fonts'
$installedFont = Join-Path $fontDirectory 'StatsPillsIcons-1.7.ttf'
New-Item -ItemType Directory -Path $fontDirectory -Force | Out-Null
Copy-Item -LiteralPath $iconSource -Destination $installedFont -Force
$fontRegistry = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
New-Item -Path $fontRegistry -Force | Out-Null
New-ItemProperty -Path $fontRegistry -Name 'StatsPills Icons Large v1.7 (TrueType)' -Value $installedFont -PropertyType String -Force | Out-Null
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
$defaults = $settings.profiles.defaults
if(-not ($defaults.PSObject.Properties.Name -contains 'font')) { $defaults | Add-Member -NotePropertyName font -NotePropertyValue ([pscustomobject]@{}) }
$faces = if($defaults.font.face){[string]$defaults.font.face}else{'Cascadia Mono'}
$iconFamily = 'StatsPills Icons Large v1.7'
# Replace prior icon fallbacks while preserving the user's main font.
$fontFaces = @($faces -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^StatsPills Icons(?: Large)?(?: v[0-9.]+)?$' })
$faces = (@($fontFaces) + @($iconFamily)) -join ', '
$defaults.font | Add-Member -NotePropertyName face -NotePropertyValue $faces -Force
$settings | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $terminalSettings -Encoding utf8
Write-Output "Registered $loaded icon font; terminal font: $faces"
