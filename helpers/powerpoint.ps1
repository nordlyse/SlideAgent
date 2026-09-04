param(
  [Parameter(Mandatory = $true)][ValidateSet('next','prev','first','last','goto','start','stop','keys')][string]$Action,
  [int]$Index = 0,
  [string]$Keys = ''
)

$ErrorActionPreference = 'Stop'

function Write-Result {
  param($Object)
  $Object | ConvertTo-Json -Compress
}

function Get-PowerPoint {
  try {
    return [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
  } catch {
    return $null
  }
}

function Get-ShowView($ppt) {
  try {
    return $ppt.ActivePresentation.SlideShowWindow.View
  } catch {
    return $null
  }
}

function Focus-PresentationWindow {
  $pattern = 'PowerPoint|Impress|LibreOffice|Slide Show|Slayt G.sterisi|slideshow'
  $proc = Get-Process | Where-Object { $_.MainWindowTitle -match $pattern -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if (-not $proc) { return $false }
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SlideAgentFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
  [SlideAgentFocus]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
  return [SlideAgentFocus]::SetForegroundWindow($proc.MainWindowHandle)
}

if ($Action -eq 'keys') {
  if ([string]::IsNullOrWhiteSpace($Keys)) {
    Write-Result @{ ok = $false; reason = 'missing-keys' }
    exit 2
  }
  Focus-PresentationWindow | Out-Null
  Start-Sleep -Milliseconds 120
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
  Write-Result @{ ok = $true; backend = 'keyboard' }
  exit 0
}

$ppt = Get-PowerPoint
if (-not $ppt) {
  Write-Result @{ ok = $false; reason = 'no-powerpoint' }
  exit 2
}

$view = Get-ShowView $ppt
if (-not $view -or $Action -eq 'start') {
  try {
    $ppt.ActivePresentation.SlideShowSettings.Run() | Out-Null
    Start-Sleep -Milliseconds 450
    $view = Get-ShowView $ppt
  } catch {
    $view = Get-ShowView $ppt
  }
}

if ($Action -eq 'stop') {
  try {
    $ppt.ActivePresentation.SlideShowWindow.View.Exit() | Out-Null
    Write-Result @{ ok = $true; backend = 'powerpoint-slideshow' }
    exit 0
  } catch {
    Write-Result @{ ok = $false; reason = 'no-slideshow' }
    exit 1
  }
}

if ($view -and $Action -ne 'start') {
  switch ($Action) {
    'next'  { $view.Next() }
    'prev'  { $view.Previous() }
    'first' { $view.First() }
    'last'  { $view.Last() }
    'goto'  { $view.GotoSlide([int]$Index) }
  }
  Write-Result @{ ok = $true; backend = 'powerpoint-slideshow' }
  exit 0
}

if ($Action -eq 'start' -and $view) {
  Write-Result @{ ok = $true; backend = 'powerpoint-slideshow' }
  exit 0
}

try {
  $win = $ppt.ActiveWindow
  $cur = [int]$win.Selection.SlideRange.SlideIndex
  $count = [int]$ppt.ActivePresentation.Slides.Count
  switch ($Action) {
    'next'  { if ($cur -lt $count) { $win.View.GotoSlide($cur + 1) } }
    'prev'  { if ($cur -gt 1) { $win.View.GotoSlide($cur - 1) } }
    'first' { $win.View.GotoSlide(1) }
    'last'  { $win.View.GotoSlide($count) }
    'goto'  { $win.View.GotoSlide([int]$Index) }
    'start' { }
  }
  Write-Result @{ ok = $true; backend = 'powerpoint-edit' }
  exit 0
} catch {
  Write-Result @{ ok = $false; reason = $_.Exception.Message }
  exit 1
}
