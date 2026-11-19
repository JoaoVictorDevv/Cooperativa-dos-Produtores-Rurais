@echo off
title App da Cooperativa
REM Abre o App da Cooperativa. Dois cliques e pronto.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto semnode
if not exist "node_modules\next\package.json" goto instalar
goto atalho
:instalar
echo Primeira vez: instalando. Pode demorar uns 5 minutos, nao feche a janela...
echo Os avisos amarelos "npm warn" sao normais.
call npm install --no-audit --no-fund
if errorlevel 1 goto erro
:atalho
if exist "%USERPROFILE%\Desktop\App Cooperativa.lnk" goto abrir
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut($d+'\App Cooperativa.lnk'); $s.TargetPath='%~dp0abrir-app.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0public\coop\logo.ico'; $s.Save()" >nul 2>nul
:abrir
node scripts\coop\iniciar.mjs producao
echo.
echo O app parou. Se apareceu erro em vermelho, tire uma foto desta janela.
pause
exit /b 0
:semnode
echo Falta instalar o Node.js: entre em https://nodejs.org e baixe a versao LTS.
echo Depois reinicie o computador e abra este arquivo de novo.
pause
exit /b 1
:erro
echo.
echo DEU ERRO na instalacao. Confira a internet e tente de novo.
echo Se continuar, tire uma foto desta janela e mande.
pause
exit /b 1
