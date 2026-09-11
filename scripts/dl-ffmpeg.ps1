$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$extractTo = Join-Path $repoRoot "src-tauri\resources"
$ffmpegPath = Join-Path $extractTo "ffmpeg.exe"
$ffprobePath = Join-Path $extractTo "ffprobe.exe"
$minimumSize = 1MB
$expectedVersion = "9.0.1-essentials_build"
$expectedSha256 = "49a73bdf0850092a252ac4641d922f3048d63ed113e196cc65ce1e4f7fb33e85"

function Test-ValidFfmpegBinary([string]$path) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    return $false
  }

  if ((Get-Item -LiteralPath $path).Length -lt $minimumSize) {
    return $false
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo.FileName = $path
  $process.StartInfo.Arguments = "-version"
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.CreateNoWindow = $true
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true

  try {
    if (-not $process.Start()) {
      return $false
    }
    $output = $process.StandardOutput.ReadToEnd()
    $process.StandardError.ReadToEnd() | Out-Null
    $process.WaitForExit()
    return $process.ExitCode -eq 0 -and $output.Contains($expectedVersion)
  }
  catch {
    return $false
  }
  finally {
    $process.Dispose()
  }
}

$url = "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.1-essentials_build.7z"
$operationId = [Guid]::NewGuid().ToString("N")
$mutex = New-Object System.Threading.Mutex($false, "Local\Vyu.FfmpegProvision")
$mutexAcquired = $false
$tempDir = $null

try {
  try {
    $mutexAcquired = $mutex.WaitOne([TimeSpan]::FromMinutes(5))
  }
  catch [System.Threading.AbandonedMutexException] {
    $mutexAcquired = $true
  }
  if (-not $mutexAcquired) {
    throw "Timed out waiting for another FFmpeg setup operation to finish."
  }

  if ((Test-ValidFfmpegBinary $ffmpegPath) -and (Test-ValidFfmpegBinary $ffprobePath)) {
    Write-Host "FFmpeg 9.0.1 is already available." -ForegroundColor DarkGray
    return
  }

  $tempDir = Join-Path $env:TEMP "vyu-ffmpeg-$operationId"
  $archive = Join-Path $tempDir "ffmpeg.7z"
  $stageDir = Join-Path $tempDir "stage"
  $null = New-Item -ItemType Directory -Path $tempDir -Force
  $null = New-Item -ItemType Directory -Path $stageDir -Force

  Write-Host "Downloading FFmpeg 9.0.1 Essentials..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($archive)
    try {
      $actualSha256 = [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace("-", "").ToLowerInvariant()
    }
    finally {
      $stream.Dispose()
    }
  }
  finally {
    $sha256.Dispose()
  }
  if ($actualSha256 -ne $expectedSha256) {
    throw "FFmpeg archive checksum mismatch. Expected $expectedSha256 but received $actualSha256."
  }

  Write-Host "Extracting FFmpeg binaries..." -ForegroundColor Cyan
  $tar = Get-Command "tar" -ErrorAction SilentlyContinue
  $extracted = $false

  if ($tar) {
    $previousErrorAction = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      & $tar.Source -xf $archive -C $tempDir 2>$null
      $tarExitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorAction
    }
    $extracted = $tarExitCode -eq 0
  }

  if (-not $extracted) {
    $sevenZip = Get-Command "7z" -ErrorAction SilentlyContinue
    if (-not $sevenZip) {
      $sevenZip = Get-Command "7za" -ErrorAction SilentlyContinue
    }
    if (-not $sevenZip) {
      throw "Cannot extract the FFmpeg archive. Install 7-Zip or use Windows tar."
    }

    $previousErrorAction = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      & $sevenZip.Source x $archive "-o$tempDir" -y "*/bin/ffmpeg.exe" "*/bin/ffprobe.exe" "*/bin/*.dll" | Out-Null
      $sevenZipExitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorAction
    }
    if ($sevenZipExitCode -ne 0) {
      throw "7-Zip failed to extract the FFmpeg archive."
    }
  }

  $binDir = Get-ChildItem -Path $tempDir -Recurse -Directory |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "ffmpeg.exe") } |
    Select-Object -First 1
  if (-not $binDir) {
    throw "The FFmpeg archive did not contain a bin directory."
  }

  Copy-Item -LiteralPath (Join-Path $binDir.FullName "ffmpeg.exe") -Destination $stageDir -Force
  Copy-Item -LiteralPath (Join-Path $binDir.FullName "ffprobe.exe") -Destination $stageDir -Force
  Get-ChildItem -Path $binDir.FullName -Filter "*.dll" -File | Copy-Item -Destination $stageDir -Force

  if (-not (Test-ValidFfmpegBinary (Join-Path $stageDir "ffmpeg.exe")) -or
      -not (Test-ValidFfmpegBinary (Join-Path $stageDir "ffprobe.exe"))) {
    throw "The extracted FFmpeg binaries failed validation."
  }

  if (-not (Test-Path -LiteralPath $extractTo -PathType Container)) {
    $null = New-Item -ItemType Directory -Path $extractTo -Force
  }

  Get-ChildItem -LiteralPath $extractTo -File |
    Where-Object { $_.Name -in @("ffmpeg.exe", "ffprobe.exe") -or $_.Extension -eq ".dll" } |
    Remove-Item -Force
  Copy-Item -Path (Join-Path $stageDir "*") -Destination $extractTo -Force
}
finally {
  if ($tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($mutexAcquired) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}

Write-Host "FFmpeg 9.0.1 installed to $extractTo" -ForegroundColor Green
Write-Host "  ffmpeg.exe: $([math]::Round((Get-Item -LiteralPath $ffmpegPath).Length / 1MB, 1)) MB"
Write-Host "  ffprobe.exe: $([math]::Round((Get-Item -LiteralPath $ffprobePath).Length / 1MB, 1)) MB"
