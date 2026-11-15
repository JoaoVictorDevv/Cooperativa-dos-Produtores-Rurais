@echo off
REM Atualiza o app com a versao mais nova do GitHub. Seus dados (dados-cooperativa) ficam como estao.
cd /d "%~dp0"
set RAMO=claude/pnae-excel-structure-djoy3c
set ZIP=https://github.com/JoaoVictorDevv/Cooperativa-dos-Produtores-Rurais/archive/refs/heads/%RAMO%.zip
echo Baixando a versao nova...
if exist .git (
  git pull origin %RAMO%
  if errorlevel 1 goto erro
) else (
  if exist _nova rmdir /s /q _nova
  powershell -NoProfile -Command "Invoke-WebRequest -Uri \"%ZIP%\" -OutFile _nova.zip; Expand-Archive -Force _nova.zip _nova"
  if errorlevel 1 goto erro
  for /d %%D in (_nova\*) do robocopy "%%D" . /E /XD dados-cooperativa node_modules .next _nova /NFL /NDL /NJH /NJS >nul
  rmdir /s /q _nova
  del _nova.zip
)
echo Instalando e preparando... uns minutos.
call npm install
if exist .next rmdir /s /q .next
call npm run coop:build
if errorlevel 1 goto erro
echo.
echo Pronto! Agora use o abrir-app.bat.
pause
exit /b 0
:erro
echo.
echo DEU ERRO. Tire uma foto desta janela e mande.
pause
exit /b 1
