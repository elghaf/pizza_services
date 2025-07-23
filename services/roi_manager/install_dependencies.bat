@echo off
echo Installing ROI Manager Service dependencies...
cd /d "%~dp0"
pip install -r requirements.txt
echo ROI Manager dependencies installed successfully!
pause
