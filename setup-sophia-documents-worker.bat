@echo off
cd /d "%~dp0workers\sophia-documents"
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo Worker instalado. Configure as variaveis do README_PRODUCTION.md antes de iniciar.
pause
