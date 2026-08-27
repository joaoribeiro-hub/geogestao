@echo off
cd /d "%~dp0workers\sophia-documents"
call .venv\Scripts\activate.bat
uvicorn main:app --host 127.0.0.1 --port 8030
