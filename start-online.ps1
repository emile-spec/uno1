$ErrorActionPreference = 'Stop'
function Require-Tool($command, $package) {
  $tool = Get-Command $command -ErrorAction SilentlyContinue
  if (-not $tool) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      throw "winget mangler. Installer Node.js fra nodejs.org og cloudflared fra developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
    }
    Write-Host "Installerer $package ..."
    & winget install --id $package --exact --source winget --accept-source-agreements --accept-package-agreements | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Installationen af $package blev ikke gennemfoert." }
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
    $tool = Get-Command $command -ErrorAction SilentlyContinue
  }
  if (-not $tool) { throw "Luk vinduet, og start igen for at aktivere $command." }
  return $tool.Source
}
$node = Require-Tool 'node.exe' 'OpenJS.NodeJS.LTS'
$major = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw 'Opdater Node.js til version 22 eller nyere fra nodejs.org.' }
$tunnel = Require-Tool 'cloudflared.exe' 'Cloudflare.cloudflared'
$env:PORT = '3000'
$process = Start-Process -FilePath $node -ArgumentList ('"{0}"' -f (Join-Path $PSScriptRoot 'server.js')) -WorkingDirectory $PSScriptRoot -PassThru
try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 300
    if ($process.HasExited) { throw 'Spillet kunne ikke starte. Port 3000 kan vaere optaget. Luk andre Uno-vinduer.' }
    try {
      $health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 1
      if ($health.ok) { $ready = $true; break }
    } catch {}
  }
  if (-not $ready) { throw 'Spilserveren svarede ikke.' }
  Start-Process 'http://localhost:3000'
  Write-Host 'Del HTTPS-adressen med trycloudflare.com nedenfor med dine venner.'
  Write-Host 'Hold dette vindue og spilvinduet aabent. Stop med Ctrl+C.'
  & $tunnel tunnel --url http://127.0.0.1:3000
} finally {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id }
}
