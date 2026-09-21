$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $projectRoot ".local\postgres-data"
$logFile = Join-Path $projectRoot ".local\postgres.log"
$pgCtl = Join-Path $env:ProgramFiles "PostgreSQL\18\bin\pg_ctl.exe"

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw "PostgreSQL 18 nao foi encontrado em $pgCtl."
}

if (-not (Test-Path -LiteralPath (Join-Path $dataDir "PG_VERSION"))) {
  throw "O banco local ainda nao foi inicializado em $dataDir."
}

& $pgCtl status -D $dataDir *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "Banco local do Colheita ja esta ativo na porta 5433."
  exit 0
}

& $pgCtl start -D $dataDir -l $logFile -o "-p 5433"
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel iniciar o banco local do Colheita."
}

