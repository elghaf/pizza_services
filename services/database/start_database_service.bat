@echo off
echo 🍕 Starting Pizza Store Database Service
echo =====================================

REM Set environment variables
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=pizza_violations
set DB_USER=pizza_admin
set DB_PASSWORD=secure_pizza_2024
set DATABASE_PORT=8005

echo ✅ Environment variables set
echo 📊 Database Host: %DB_HOST%:%DB_PORT%
echo 🌐 Service Port: %DATABASE_PORT%

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    pause
    exit /b 1
)

echo ✅ Python is available

REM Install dependencies if needed
echo 📦 Installing dependencies...
pip install fastapi uvicorn asyncpg pydantic python-multipart python-json-logger psycopg2-binary

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed

REM Start the database service
echo 🚀 Starting database service on port %DATABASE_PORT%...
python main.py

pause
