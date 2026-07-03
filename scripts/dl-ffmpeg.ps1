# Download gyan.dev FFmpeg essentials
$extractTo = Join-Path $PSScriptRoot ".." "src-tauri" "resources"
$extractTo = Resolve-Path $extractTo

$url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z"
$archive = Join-Path $env:TEMP "ffmpeg-essentials.7z"

Write-Host "Downloading FFmpeg essentials build..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $archive

Write-Host "Extracting ffmpeg.exe, ffprobe.exe, and DLLs..." -ForegroundColor Cyan
$tempDir = Join-Path $env:TEMP "ffmpeg-extract"
$null = New-Item -ItemType Directory -Path $tempDir -Force

# Try tar first, fall back to 7z
$tarOk = $false
try {
  tar -xf $archive -C $tempDir --wildcards "*/bin/ffmpeg.exe" "*/bin/ffprobe.exe" "*/bin/*.dll" 2>$null
  $tarOk = $LASTEXITCODE -eq 0
} catch {}

if (-not $tarOk) {
  $innerDir = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1
  if (-not $innerDir) {
    $sevenZip = Get-Command "7z" -ErrorAction SilentlyContinue
    if (-not $sevenZip) {
      $sevenZip = Get-Command "7za" -ErrorAction SilentlyContinue
    }
    if ($sevenZip) {
      & $sevenZip.Source x $archive -o"$tempDir" -y "*/bin/ffmpeg.exe" "*/bin/ffprobe.exe" "*/bin/*.dll" | Out-Null
    } else {
      Write-Error "Cannot extract .7z archive. Install 7-Zip or use tar (Windows 10 1803+)."
      exit 1
    }
    $innerDir = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1
  }
  $binDir = Join-Path $innerDir.FullName "bin"
  if (Test-Path $binDir) {
    Copy-Item (Join-Path $binDir "ffmpeg.exe") $extractTo -Force
    Copy-Item (Join-Path $binDir "ffprobe.exe") $extractTo -Force
    Copy-Item (Join-Path $binDir "*.dll") $extractTo -Force
  } else {
    Write-Error "bin/ directory not found in extracted archive."
    exit 1
  }
} else {
  $innerDir = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1
  $binDir = Join-Path $innerDir.FullName "bin"
  Copy-Item (Join-Path $binDir "ffmpeg.exe") $extractTo -Force
  Copy-Item (Join-Path $binDir "ffprobe.exe") $extractTo -Force
  Copy-Item (Join-Path $binDir "*.dll") $extractTo -Force
}

# Cleanup
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "FFmpeg essentials installed to $extractTo" -ForegroundColor Green
Write-Host "  ffmpeg.exe: $((Get-Item (Join-Path $extractTo "ffmpeg.exe")).Length / 1KB) KB"
Write-Host "  ffprobe.exe: $((Get-Item (Join-Path $extractTo "ffprobe.exe")).Length / 1KB) KB"
