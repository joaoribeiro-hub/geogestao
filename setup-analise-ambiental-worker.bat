@echo off
setlocal
cd /d "%~dp0workers\analise-ambiental"

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY_CMD=py -3"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python nao encontrado. Instale Python 3.11+ ou adicione python ao PATH.
    exit /b 1
  )
  set "PY_CMD=python"
)

if not exist ".venv" (
  %PY_CMD% -m venv .venv
)

if not exist ".venv\Scripts\python.exe" (
  echo Nao foi possivel criar a venv em workers\analise-ambiental\.venv.
  echo Apague a pasta .venv se ela estiver incompleta e rode este script novamente.
  exit /b 1
)

".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements-base.txt
".venv\Scripts\python.exe" -m app.tools.create_dev_fixture
echo.
echo Worker Analise Ambiental configurado.
endlocal
