@echo off
echo 🎨 Installing Design Transformation Dependencies...
echo.

REM Navigate to frontend directory
cd /d "%~dp0"

echo 📦 Installing Tailwind CSS and related packages...
npm install -D tailwindcss postcss autoprefixer
npm install -D @tailwindcss/forms @tailwindcss/typography

echo 📊 Installing Chart library (ECharts)...
npm install echarts echarts-for-react

echo 🎨 Installing Icons and utilities...
npm install remixicon
npm install clsx tailwind-merge

echo.
echo ✅ All dependencies installed successfully!
echo.
echo 🚀 Next steps:
echo 1. Run: npm start
echo 2. Open: http://localhost:3000
echo 3. The new design should be active!
echo.
pause
