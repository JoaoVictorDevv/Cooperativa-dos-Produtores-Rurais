@echo off
REM Abre o App da Cooperativa. Dois cliques e pronto.
cd /d "%~dp0"
where node >nul 2>nul || (echo Instale o Node.js primeiro: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Primeira vez: instalando... pode demorar uns minutos.
  call npm install
)
if not exist dados-cooperativa (
  echo AVISO: a pasta dados-cooperativa nao esta aqui. O app vai comecar vazio.
)
start "" http://localhost:3000/coop
call npm run coop
pause
