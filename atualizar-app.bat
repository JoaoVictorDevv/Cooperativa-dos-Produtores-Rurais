@echo off
title Atualizar o App da Cooperativa
REM Pega a versao nova do app. Seus dados em dados-cooperativa nao mudam.
cd /d "%~dp0"
set RAMO=claude/pnae-excel-structure-djoy3c
set ZIP=https://github.com/JoaoVictorDevv/Cooperativa-dos-Produtores-Rurais/archive/refs/heads/%RAMO%.zip
if exist .git goto comgit
echo Baixando a versao nova do GitHub...
if exist _nova rmdir /s /q _nova
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%ZIP%' -OutFile _nova.zip; Expand-Archive -Force _nova.zip _nova"
if errorlevel 1 goto erro
for /d %%D in (_nova\*) do robocopy "%%D" . /E /XD dados-cooperativa node_modules .next _nova /NFL /NDL /NJH /NJS /NP >nul
rmdir /s /q _nova
del _nova.zip
goto instalar
:comgit
where git >nul 2>nul
if errorlevel 1 goto desktop
git pull origin %RAMO%
if errorlevel 1 goto erro
goto instalar
:desktop
echo Esta pasta e do GitHub Desktop. Antes de rodar este arquivo, abra o GitHub Desktop
echo e clique em "Pull origin". Se ja fez isso, pode continuar.
pause
:instalar
echo Instalando o que mudou...
call npm install --no-audit --no-fund
if errorlevel 1 goto erro
if exist .next rmdir /s /q .next
echo.
echo Pronto! Agora abra o app pelo atalho "App Cooperativa" ou pelo abrir-app.bat.
echo Na primeira vez depois de atualizar ele leva uns 2 minutos para preparar.
pause
exit /b 0
:erro
echo.
echo DEU ERRO. Confira a internet e tente de novo. Se continuar, tire uma foto e mande.
pause
exit /b 1
