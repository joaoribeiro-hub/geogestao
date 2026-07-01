@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ==========================================
echo Setup do worker BuscaGEO 8010
echo ==========================================
echo.
echo Este worker precisa de GDAL. No Windows, o caminho mais estavel e Conda/conda-forge.
echo.

call :FindConda
if not defined CONDA_BAT (
  echo Conda nao encontrado.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Instale Miniconda manualmente e rode este arquivo de novo:
    echo https://docs.conda.io/en/latest/miniconda.html
    pause
    exit /b 1
  )
  echo Instalando Miniconda pelo winget...
  winget install -e --id Anaconda.Miniconda3 --scope user --accept-package-agreements --accept-source-agreements
  call :FindConda
)

if not defined CONDA_BAT (
  echo Nao consegui localizar o Conda apos a instalacao.
  echo Feche esta janela, abra de novo e execute setup-buscageo-worker.bat.
  pause
  exit /b 1
)

echo Conda: %CONDA_BAT%
echo.

call "%CONDA_BAT%" run -n buscageo-worker python --version >nul 2>nul
if errorlevel 1 (
  echo Criando ambiente buscageo-worker...
  call "%CONDA_BAT%" create -y -n buscageo-worker python=3.11 -c conda-forge
  if errorlevel 1 goto fail
) else (
  echo Ambiente buscageo-worker ja existe.
)

echo Instalando dependencias geoespaciais...
call "%CONDA_BAT%" install -y -n buscageo-worker -c conda-forge gdal numpy rasterio fiona shapely pyproj pillow fastapi uvicorn pydantic requests
if errorlevel 1 goto fail

echo Instalando cliente Supabase...
call "%CONDA_BAT%" run -n buscageo-worker python -m pip install supabase==2.10.0
if errorlevel 1 goto fail

echo.
echo Setup concluido.
echo Agora rode iniciar-buscageo-worker.bat e confira http://127.0.0.1:8010/docs
echo.
pause
exit /b 0

:fail
echo.
echo Falha no setup do worker BuscaGEO.
echo Copie as mensagens acima para diagnostico.
pause
exit /b 1

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
