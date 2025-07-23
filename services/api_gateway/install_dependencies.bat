@echo off
echo Installing API Gateway Service dependencies...
cd /d "%~dp0"
pip install -r requirements.txt
echo API Gateway dependencies installed successfully!
pause
