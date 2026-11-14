@echo off
REM Depois de baixar uma versao nova do app: roda isto uma vez.
cd /d "%~dp0"
echo Atualizando... pode demorar uns minutos.
call npm install
if exist .next rmdir /s /q .next
call npm run coop:build
echo Pronto. Agora use o abrir-app.bat.
pause
