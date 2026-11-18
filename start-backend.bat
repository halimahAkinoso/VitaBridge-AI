@echo off
REM VitaBridge AI - start the FastAPI backend from the Desktop project.
REM Stops any old server on port 8000, installs deps, runs tests, starts uvicorn.
title VitaBridge AI backend (port 8000)
cd /d "%~dp0backend"
set LOG=%~dp0backend\startup.log
echo ==== %DATE% %TIME% ==== > "%LOG%"
echo Working folder: %CD% >> "%LOG%"

echo [1/5] Stopping anything already listening on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  echo   stopping PID %%a
  echo stopping PID %%a >> "%LOG%"
  taskkill /PID %%a /F >> "%LOG%" 2>&1
)
timeout /t 2 /nobreak >nul

echo [2/5] Selecting Python...
set PY=
if exist "%USERPROFILE%\anaconda3\envs\vitabridge\python.exe" set PY=%USERPROFILE%\anaconda3\envs\vitabridge\python.exe
if not defined PY if exist "%USERPROFILE%\.conda\envs\vitabridge\python.exe" set PY=%USERPROFILE%\.conda\envs\vitabridge\python.exe
if not defined PY if exist "%USERPROFILE%\Anaconda3\envs\vitabridge\python.exe" set PY=%USERPROFILE%\Anaconda3\envs\vitabridge\python.exe
if not defined PY if exist "%~dp0backend\.conda\python.exe" set PY=%~dp0backend\.conda\python.exe
if not defined PY set PY=python
echo Python: %PY% >> "%LOG%"
"%PY%" --version >> "%LOG%" 2>&1
echo   using %PY%

echo [3/5] Installing backend requirements (first run can take a few minutes)...
"%PY%" -m pip install -r requirements.txt >> "%LOG%" 2>&1
if errorlevel 1 (echo   pip install FAILED - see backend\startup.log & echo PIP FAILED >> "%LOG%")

echo [4/5] Running backend tests...
"%PY%" -m pytest -q > "%~dp0backend\test-results.log" 2>&1
type "%~dp0backend\test-results.log"

echo [5/5] Starting backend at http://127.0.0.1:8000  (docs: http://127.0.0.1:8000/docs)
echo Keep this window open. Close it to stop the backend.
echo STARTING UVICORN >> "%LOG%"
"%PY%" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 >> "%LOG%" 2>&1
echo Backend stopped. See backend\startup.log
pause
