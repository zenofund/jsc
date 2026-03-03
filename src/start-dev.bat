@echo off
REM JSC-PMS Development Startup Script for Windows
REM This script starts both backend and frontend servers

echo ===============================================================
echo.
echo    JSC Payroll Management System - Development Mode
echo.
echo ===============================================================
echo.

REM Check if backend .env exists
if not exist "backend\.env" (
    echo [ERROR] backend\.env file not found
    echo.
    echo Please create backend\.env file with your configuration:
    echo 1. cd backend
    echo 2. copy .env.example .env
    echo 3. Edit .env with your Supabase credentials
    echo.
    echo See BACKEND_STARTUP_GUIDE.md for detailed instructions
    pause
    exit /b 1
)

REM Check if node_modules exists in backend
if not exist "backend\node_modules" (
    echo [WARNING] Backend dependencies not installed
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
    echo [SUCCESS] Backend dependencies installed
    echo.
)

REM Check if node_modules exists in frontend
if not exist "node_modules" (
    echo [WARNING] Frontend dependencies not installed
    echo Installing frontend dependencies...
    call npm install
    echo [SUCCESS] Frontend dependencies installed
    echo.
)

echo Starting JSC-PMS Development Servers...
echo.
echo Backend will run on:  http://localhost:3000
echo Frontend will run on: http://localhost:5173
echo.
echo Press Ctrl+C to stop both servers
echo.
echo ---------------------------------------------------------------
echo.

REM Start backend in a new window
start "JSC-PMS Backend" cmd /k "cd backend && npm run start:dev"

REM Wait for backend to start
timeout /t 5 /nobreak > nul

echo [SUCCESS] Backend started in separate window
echo.

REM Start frontend in current window
echo Starting frontend...
echo.
call npm run dev

REM If we get here, frontend was stopped
echo.
echo [INFO] Frontend stopped
echo.
echo Backend is still running in separate window
echo Please close the backend window manually or use Ctrl+C
pause
