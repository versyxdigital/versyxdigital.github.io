param(
  [switch]$StaticOnly
)

$ErrorActionPreference = 'Stop'
$portfolioRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$appRoot = if ($env:MKEDITOR_SOURCE_ROOT) { [IO.Path]::GetFullPath($env:MKEDITOR_SOURCE_ROOT) } else { [IO.Path]::GetFullPath((Join-Path $portfolioRoot '../mkeditor')) }
$captureRoot = if ($env:MKEDITOR_CAPTURE_DIR) { [IO.Path]::GetFullPath($env:MKEDITOR_CAPTURE_DIR) } else { Join-Path $portfolioRoot 'qa-screens/mkeditor-captures' }
$siteRoot = Join-Path $portfolioRoot 'public/mkeditor'
$screenshotsRoot = Join-Path $captureRoot 'originals'
$outputRoot = Join-Path $siteRoot 'assets/screenshots'
$fontsRoot = Join-Path $siteRoot 'assets/fonts'
$imagesRoot = Join-Path $siteRoot 'assets/img'
$portfolioAssetsRoot = Join-Path $portfolioRoot 'src/assets/projects'

function Assert-PortfolioOutput {
  param([string]$Path)
  $absolute = [IO.Path]::GetFullPath($Path)
  $boundary = $portfolioRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $absolute.StartsWith($boundary, [StringComparison]::OrdinalIgnoreCase)) { throw "Output path escapes the portfolio: $absolute" }
  return $absolute
}
foreach ($outputPath in @($siteRoot, $outputRoot, $fontsRoot, $imagesRoot, $portfolioAssetsRoot)) {
  [void](Assert-PortfolioOutput $outputPath)
}
if (-not (Test-Path -LiteralPath (Join-Path $siteRoot 'index.html') -PathType Leaf)) { throw 'Run this helper from its installed portfolio/scripts location.' }

foreach ($directory in @($outputRoot, $fontsRoot, $imagesRoot, $portfolioAssetsRoot)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$fontSource = Join-Path $portfolioRoot 'node_modules/@fontsource-variable/geist'
Copy-Item -LiteralPath (Join-Path $fontSource 'files/geist-latin-wght-normal.woff2') -Destination (Join-Path $fontsRoot 'geist-latin.woff2') -Force
Copy-Item -LiteralPath (Join-Path $fontSource 'LICENSE') -Destination (Join-Path $fontsRoot 'Geist-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $appRoot 'src/browser/assets/img/google-drive.png') -Destination (Join-Path $imagesRoot 'google-drive.png') -Force

if ($StaticOnly) {
  Write-Output 'Prepared the local Geist font and license and official Drive icon; the existing MKEditor mark is preserved.'
  return
}

$names = @('editor-dark', 'editor-light', 'assistant', 'google-drive', 'providers', 'preferences', 'export', 'shortcuts', 'recovery')
foreach ($name in $names) {
  $inputFile = Join-Path $screenshotsRoot ($name + '.png')
  if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) {
    throw "Missing screenshot: $name.png. Complete all captures before preparing image assets."
  }
  $bytes = [IO.File]::ReadAllBytes($inputFile)
  $width = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes, 16))
  $height = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes, 20))
  if ($width -ne 3200 -or $height -ne 2000) {
    throw "Unexpected screenshot dimensions: $name.png is ${width}x${height}, expected 3200x2000."
  }
}

$ffmpeg = (Get-Command ffmpeg -CommandType Application).Source
$jobs = New-Object 'System.Collections.Generic.List[object]'
function Complete-ImageBatch {
  param($Batch)
  foreach ($job in $Batch) {
    $job.Process.WaitForExit()
    $encodingError = $job.Error.Result
    if ($job.Process.ExitCode -ne 0) { throw "WebP conversion failed: $($job.Output): $encodingError" }
    $job.Process.Dispose()
  }
  $Batch.Clear()
}
try {
foreach ($name in $names) {
  $inputFile = Join-Path $screenshotsRoot ($name + '.png')
  foreach ($variant in @(@{ Suffix = ''; Width = 3200 }, @{ Suffix = '-1600'; Width = 1600 }, @{ Suffix = '-640'; Width = 640 })) {
    $outputFile = Join-Path $outputRoot ($name + $variant.Suffix + '.webp')
    # Lossless WebP preserves small interface text. Quality controls encoder effort
    # in lossless mode; resized derivatives use Lanczos before lossless encoding.
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $ffmpeg
    $start.Arguments = '-hide_banner -loglevel error -nostdin -y -i "' + $inputFile + '" -vf "scale=' + $variant.Width + ':-1:flags=lanczos" -frames:v 1 -c:v libwebp -lossless 1 -q:v 94 -compression_level 6 "' + $outputFile + '"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $start.RedirectStandardError = $true
    $encoder = [Diagnostics.Process]::Start($start)
    $jobs.Add(@{ Process = $encoder; Error = $encoder.StandardError.ReadToEndAsync(); Output = $outputFile })
    if ($jobs.Count -eq 4) { Complete-ImageBatch $jobs }
  }
}
if ($jobs.Count) { Complete-ImageBatch $jobs }
} finally {
  foreach ($job in $jobs) {
    if (-not $job.Process.HasExited) { $job.Process.Kill() }
    $job.Process.Dispose()
  }
}

$portfolioMapping = @(
  @{ Name = 'mkeditor'; Shot = 'editor-dark'; Thumb = 'mkeditor-01-thumb' },
  @{ Name = 'mkeditor-02'; Shot = 'assistant'; Thumb = 'mkeditor-02-thumb' },
  @{ Name = 'mkeditor-03'; Shot = 'google-drive'; Thumb = 'mkeditor-03-thumb' },
  @{ Name = 'mkeditor-04'; Shot = 'providers'; Thumb = 'mkeditor-04-thumb' },
  @{ Name = 'mkeditor-05'; Shot = 'recovery'; Thumb = 'mkeditor-05-thumb' }
)
foreach ($item in $portfolioMapping) {
  Copy-Item -LiteralPath (Join-Path $outputRoot ($item.Shot + '.webp')) -Destination (Join-Path $portfolioAssetsRoot ($item.Name + '.webp')) -Force
  Copy-Item -LiteralPath (Join-Path $outputRoot ($item.Shot + '-640.webp')) -Destination (Join-Path $portfolioAssetsRoot ($item.Thumb + '.webp')) -Force
}

$legacyMapping = @(
  @{ Name = 'demo-dark.webp'; Shot = 'editor-dark' },
  @{ Name = 'demo-light.webp'; Shot = 'editor-light' },
  @{ Name = 'ai-assistant.webp'; Shot = 'assistant' },
  @{ Name = 'settings.webp'; Shot = 'preferences' }
)
foreach ($item in $legacyMapping) {
  Copy-Item -LiteralPath (Join-Path $outputRoot ($item.Shot + '.webp')) -Destination (Join-Path $imagesRoot $item.Name) -Force
}
Copy-Item -LiteralPath (Join-Path $screenshotsRoot 'export.png') -Destination (Join-Path $imagesRoot 'export-settings.png') -Force
Copy-Item -LiteralPath (Join-Path $screenshotsRoot 'shortcuts.png') -Destination (Join-Path $imagesRoot 'shortcuts.png') -Force

$total = (Get-ChildItem -LiteralPath $outputRoot -File | Measure-Object Length -Sum).Sum
Write-Output "Prepared 27 screenshot WebPs, ten portfolio images/thumbnails, six legacy screenshot replacements, font/license and brand assets. Screenshot total: $([math]::Round($total / 1MB, 2)) MB."
