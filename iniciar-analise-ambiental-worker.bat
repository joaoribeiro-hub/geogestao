@echo off
setlocal
cd /d "%~dp0workers\analise-ambiental"

if not exist ".venv\Scripts\python.exe" (
  echo Venv do worker nao encontrada.
  echo Rode primeiro: setup-analise-ambiental-worker.bat
  exit /b 1
)

if not exist ".env.local" (
  echo Arquivo workers\analise-ambiental\.env.local nao encontrado.
  echo Crie esse arquivo a partir de .env.example e configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ANALISE_AMBIENTAL_WORKER_SECRET.
  exit /b 1
)

if exist ".env.local" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env.local") do (
    if not "%%A"=="" set "%%A=%%B"
  )
)

if "%SUPABASE_URL%"=="" (
  echo SUPABASE_URL nao configurado em workers\analise-ambiental\.env.local.
  exit /b 1
)

if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
  echo SUPABASE_SERVICE_ROLE_KEY nao configurado em workers\analise-ambiental\.env.local.
  echo Use a service_role secret key do Supabase. Nao use anon/publishable key.
  exit /b 1
)

if "%ANALISE_AMBIENTAL_WORKER_SECRET%"=="" (
  echo ANALISE_AMBIENTAL_WORKER_SECRET nao configurado em workers\analise-ambiental\.env.local.
  exit /b 1
)

".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8020
endlocal
