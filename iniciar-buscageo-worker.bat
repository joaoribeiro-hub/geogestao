@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ==========================================
echo Iniciando worker BuscaGEO em 8010
echo ==========================================
echo.

call :LoadEnv ".env.local"
call :LoadEnv "workers\buscageo\.env.local"

if not defined SUPABASE_URL (
  if defined NEXT_PUBLIC_SUPABASE_URL set "SUPABASE_URL=%NEXT_PUBLIC_SUPABASE_URL%"
)

if not defined BUSCAGEO_WORKER_SECRET (
  echo ERRO: BUSCAGEO_WORKER_SECRET nao configurado no .env.local.
  pause
  exit /b 1
)

if not defined SUPABASE_URL (
  echo ERRO: SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL nao configurado.
  pause
  exit /b 1
)

if not defined SUPABASE_SERVICE_ROLE_KEY (
  echo ERRO: SUPABASE_SERVICE_ROLE_KEY nao configurado.
  echo O worker precisa da service role key apenas no servidor local.
  pause
  exit /b 1
)

call :FindConda
if not defined CONDA_BAT (
  echo ERRO: Conda nao encontrado. Rode setup-buscageo-worker.bat primeiro.
  pause
  exit /b 1
)

call "%CONDA_BAT%" run -n buscageo-worker python -c "from osgeo import gdal; import fastapi, supabase; print('Worker deps OK', gdal.VersionInfo())"
if errorlevel 1 (
  echo.
  echo ERRO: ambiente buscageo-worker incompleto. Rode setup-buscageo-worker.bat.
  pause
  exit /b 1
)

echo.
echo Worker: http://127.0.0.1:8010/docs
echo.
call "%CONDA_BAT%" run -n buscageo-worker python -m uvicorn main:app --host 127.0.0.1 --port 8010 --app-dir workers\buscageo
pause
exit /b 0

:LoadEnv
if not exist "%~1" exit /b 0
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%~1") do (
  set "ENV_KEY=%%A"
  set "ENV_VAL=%%B"
  call set "ENV_KEY=%%ENV_KEY:set =%%"
  if defined ENV_KEY if not "%%A"=="" set "%%ENV_KEY%%=%%B"
)
exit /b 0

:FindConda
set "CONDA_BAT="
for /f "delims=" %%I in ('where conda.bat 2^>nul') do (
  if not defined CONDA_BAT set "CONDA_BAT=%%I"
)
if defined CONDA_BAT exit /b 0
if exist "%USERPROFILE%\miniconda3\condabin\conda.bat" set "CONDA_BAT=%USERPROFILE%\miniconda3\condabin\conda.bat"
if defined CONDA_BAT exit /b 0
if exist "%USERPROFILE%\anaconda3\condabin\conda.bat" set "CONDA_BAT=%USERPROFILE%\anaconda3\condabin\conda.bat"
if defined CONDA_BAT exit /b 0
if exist "%LocalAppData%\miniconda3\condabin\conda.bat" set "CONDA_BAT=%LocalAppData%\miniconda3\condabin\conda.bat"
exit /b 0
