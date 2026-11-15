@echo off
REM Abre o App da Cooperativa. Dois cliques e pronto.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js primeiro: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Primeira vez: instalando... pode demorar uns minutos.
  call npm install
  if errorlevel 1 (
    echo.
    echo DEU ERRO na instalacao. Tire uma foto desta janela.
    pause
    exit /b 1
  )
)
if not exist dados-cooperativa (
  echo AVISO: a pasta dados-cooperativa nao esta aqui. O app vai comecar vazio.
)
if not exist .next\BUILD_ID (
  echo Preparando o app (so na primeira vez ou depois de atualizar)... uns 2 minutos.
  call npm run coop:build
  if errorlevel 1 (
    echo.
    echo DEU ERRO ao preparar. Vou abrir no modo simples mesmo assim.
    start "" http://localhost:3000/coop
    call npm run coop
    pause
    exit /b 1
  )
)
echo.
echo Abrindo... deixe esta janela aberta enquanto usa o app.
start "" http://localhost:3000/coop
call npm run coop:producao
echo.
echo O app parou. Tire uma foto desta janela se apareceu erro.
pause
