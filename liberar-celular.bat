@echo off
title Liberar o celular - App da Cooperativa
REM Libera o App da Cooperativa no Firewall do Windows (porta 3000) para o celular abrir.
REM O app continua pedindo o PIN no celular.
net session >nul 2>nul
if errorlevel 1 goto pedir
echo Liberando o app no Firewall do Windows...
REM Tira bloqueios antigos do Node (quando o aviso do Windows foi fechado sem Permitir).
netsh advfirewall firewall delete rule name="Node.js JavaScript Runtime" >nul 2>nul
netsh advfirewall firewall delete rule name="App Cooperativa" >nul 2>nul
netsh advfirewall firewall add rule name="App Cooperativa" dir=in action=allow protocol=TCP localport=3000 profile=any
if errorlevel 1 goto erro
echo.
echo Pronto! Agora o celular ja abre o app, no mesmo Wi-Fi do PC.
echo Feche o app (janela preta) e abra de novo pelo atalho.
pause
exit /b 0
:pedir
echo Vai aparecer uma pergunta do Windows: clique em SIM.
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b 0
:erro
echo.
echo Nao deu certo. Tire uma foto desta janela e mande.
pause
exit /b 1
