@echo off
echo ========================================
echo 🍕 Pizza Store Detection System
echo ✅ CORE VIOLATION DETECTION WORKING
echo ✅ MESSAGE BROKER SYSTEM WORKING
echo ✅ ENHANCED DEDUPLICATION SYSTEM
echo ✅ FPS CONTROL & PROFESSIONAL FEATURES
echo Starting Essential Microservices (Cleaned & Optimized)
echo ========================================
echo.

REM Set the base directory
set BASE_DIR=%~dp0
cd /d "%BASE_DIR%"

echo 📁 Base Directory: %BASE_DIR%
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

echo ✅ Python is available
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

echo ✅ Node.js is available
echo.

echo 🚀 Starting all microservices...
echo Each service will open in a separate command window
echo.

REM Start API Gateway Service (Port 8000)
echo 🌐 Starting API Gateway Service on port 8000...
start "API Gateway (Port 8000)" cmd /k "cd /d "%BASE_DIR%services\api_gateway" && echo 🌐 API Gateway Starting... && python main.py"
timeout /t 2 /nobreak >nul

REM Start Frame Reader Service (Port 8001)
echo 📹 Starting Frame Reader Service on port 8001...
start "Frame Reader (Port 8001)" cmd /k "cd /d "%BASE_DIR%services\frame_reader" && echo 📹 Frame Reader Starting... && python main.py"
timeout /t 2 /nobreak >nul

REM Start Detection Service (Port 8002)
echo 🔍 Starting Detection Service on port 8002...
start "Detection Service (Port 8002)" cmd /k "cd /d "%BASE_DIR%services\detection" && echo 🔍 Detection Service Starting... && python main.py"
timeout /t 2 /nobreak >nul

REM Start Violation Detector (Port 8003)
echo 🚨 Starting Violation Detector on port 8003...
start "Violation Detector (Port 8003)" cmd /k "cd /d "%BASE_DIR%services\violation_detector" && echo 🚨 Violation Detector Starting... && python main.py"
timeout /t 2 /nobreak >nul

REM Start ROI Manager Service (Port 8004)
echo 📐 Starting ROI Manager Service on port 8004...
start "ROI Manager (Port 8004)" cmd /k "cd /d "%BASE_DIR%services\roi_manager" && echo 📐 ROI Manager Starting... && python main.py"
timeout /t 2 /nobreak >nul

REM Start Database Service (Port 8005)
echo 📊 Starting Database Service on port 8005...
start "Database Service (Port 8005)" cmd /k "cd /d "%BASE_DIR%services\database" && echo 📊 Database Service Starting... && set DB_HOST=127.0.0.1 && set DB_PORT=5432 && set DB_NAME=pizza_violations && set DB_USER=pizza_admin && set DB_PASSWORD=secure_pizza_2024 && set DATABASE_PORT=8005 && python main.py"
timeout /t 2 /nobreak >nul

REM Start Message Broker Service (Port 8010)
echo 📨 Starting Message Broker Service on port 8010...
start "Message Broker (Port 8010)" cmd /k "cd /d "%BASE_DIR%services\message_broker" && echo 📨 Message Broker Starting... && python main.py"
timeout /t 2 /nobreak >nul

REM Start Frontend (Port 3000)
echo 🖥️ Starting Frontend on port 3000...
start "Frontend (Port 3000)" cmd /k "cd /d "%BASE_DIR%services\frontend" && echo 🖥️ Frontend Starting... && npm start"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo ✅ All services are starting up!
echo ========================================
echo.
echo 🌐 API Gateway:        http://localhost:8000 (✅ NEW - Central API & video upload)
echo 📹 Frame Reader:       http://localhost:8001 (Video processing)
echo 🔍 Detection Service:  http://localhost:8002 (YOLO object detection)
echo 🚨 Violation Detector: http://localhost:8003 (✅ CORE - Enhanced violation detection)
echo 📐 ROI Manager:        http://localhost:8004 (✅ NEW - ROI zone management)
echo 📊 Database Service:   http://localhost:8005 (PostgreSQL data persistence)
echo 📨 Message Broker:     http://localhost:8010 (✅ RabbitMQ messaging system)
echo 🖥️ Frontend:           http://localhost:3000 (React dashboard)
echo.
echo ⏱️ Services may take 30-60 seconds to fully start
echo 🌐 Open http://localhost:3000 in your browser when ready
echo.
echo ⚠️ Keep this window open to see the startup status
echo ❌ Close this window to stop monitoring (services will continue running)
echo.

REM Wait and show status
echo 🔄 Waiting for services to initialize...
timeout /t 10 /nobreak >nul

echo.
echo 🔍 Checking service health...
echo.

REM Check each service health (optional)
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo ⏳ API Gateway: Starting...
) else (
    echo ✅ API Gateway: Ready
)

curl -s http://localhost:8001/health >nul 2>&1
if errorlevel 1 (
    echo ⏳ Frame Reader: Starting...
) else (
    echo ✅ Frame Reader: Ready
)

curl -s http://localhost:8002/health >nul 2>&1
if errorlevel 1 (
    echo ⏳ Detection Service: Starting...
) else (
    echo ✅ Detection Service: Ready
)

curl -s http://localhost:8003/health >nul 2>&1
if errorlevel 1 (
    echo ⏳ Violation Detector: Starting...
) else (
    echo ✅ Violation Detector: Ready
)

curl -s http://localhost:8004/health >nul 2>&1
if errorlevel 1 (
    echo ⏳ ROI Manager: Starting...
) else (
    echo ✅ ROI Manager: Ready
)

curl -s http://localhost:8005/health >nul 2>&1
if errorlevel 1 (
    echo ⏳ Database Service: Starting...
) else (
    echo ✅ Database Service: Ready
)

curl -s http://localhost:8010/health >nul 2>&1
if errorlevel 1 (
    echo ⏳ Message Broker: Starting...
) else (
    echo ✅ Message Broker: Ready
)

echo.
echo 🎉 Startup complete! Essential services should be running.

echo.
echo ✨ System Features Available:
echo 🚨 Enhanced Violation Detection - Professional deduplication system
echo 🎯 FPS Control - User-selectable 1-30 FPS processing speed
echo 🚫 Continuous Violation Prevention - Prevents spam violations
echo 📊 Smart Deduplication - Spatial + Temporal + Continuous filtering
echo 🔍 Scooper Detection - Hands with scoopers are allowed
echo 📨 RabbitMQ Messaging - Professional message broker system
echo 💾 PostgreSQL Database - Complete data persistence
echo.

echo 🌐 Access Points:
echo - Main Dashboard: http://localhost:3000
echo - API Gateway: http://localhost:8000 (✅ NEW - Video upload & API routing)
echo - Frame Reader: http://localhost:8001
echo - Detection Service: http://localhost:8002
echo - Violation Detector: http://localhost:8003 (✅ CORE WORKING)
echo - ROI Manager: http://localhost:8004 (✅ NEW - ROI zone management)
echo - Database Service: http://localhost:8005
echo - Message Broker: http://localhost:8010 (✅ MESSAGING WORKING)
echo.

echo 🔧 Quick Commands:
echo - Test Database: python test_database_direct.py
echo - Test Violation Detection: python test_simple_violation.py
echo - Test Continuous Prevention: python test_continuous_violation_prevention.py
echo - Test FPS Control: python test_fps_and_deduplication.py
echo - API Gateway Health: curl http://localhost:8000/health
echo - ROI Manager Health: curl http://localhost:8004/health
echo - Database Health: curl http://localhost:8005/health
echo - Message Broker Health: curl http://localhost:8010/health
echo - Violation Detector Health: curl http://localhost:8003/health
echo.

echo 🎯 Key Features:
echo ✅ CORE VIOLATION DETECTION - Hand in/out of ROI with/without scooper
echo ✅ RABBITMQ MESSAGE BROKER - Professional messaging system
echo ✅ ENHANCED DEDUPLICATION - Prevents violation spam
echo ✅ FPS CONTROL - User-selectable processing speed
echo ✅ CONTINUOUS VIOLATION PREVENTION - 60s window, max 1 per ROI
echo ✅ SCOOPER DETECTION - Smart scooper proximity detection
echo ✅ POSTGRESQL DATABASE - Complete data persistence
echo ✅ PROFESSIONAL MONITORING - Real-time health checks
echo ✅ CLEAN ARCHITECTURE - Optimized and streamlined
echo.

echo Press any key to exit this monitoring window...
pause >nul
