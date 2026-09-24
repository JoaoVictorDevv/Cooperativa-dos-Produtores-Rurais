$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $projectRoot ".local\postgres-data"
$pgCtl = Join-Path $env:ProgramFiles "PostgreSQL\18\bin\pg_ctl.exe"

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw "PostgreSQL 18 nao foi encontrado em $pgCtl."
}

& $pgCtl status -D $dataDir *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output "Banco local do Colheita ja esta parado."
  exit 0
}

& $pgCtl stop -D $dataDir -m fast
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel parar o banco local do Colheita."
}

