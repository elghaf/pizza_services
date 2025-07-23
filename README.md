# 🍕 Pizza Store Detection System

A comprehensive AI-powered violation detection system for pizza stores that monitors hand hygiene and scooper usage compliance using computer vision and YOLO object detection.

## 📋 Overview

This system detects violations when workers handle food ingredients without proper scooper usage in designated ROI (Region of Interest) zones. It provides real-time monitoring, violation tracking, and a web-based dashboard for compliance management.

## 🏗️ System Architecture

### **Microservices Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  API Gateway    │    │   Detection     │
│   (Web UI)      │◄──►│   (Port 8000)   │◄──►│  (Port 8002)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Database   │ │ ROI Manager │ │Frame Reader │
            │(Port 8005)  │ │(Port 8004)  │ │(Port 8001)  │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │           │           │
                    └───────────┼───────────┘
                                ▼
                    ┌─────────────────────────┐
                    │   Violation Detector    │
                    │     (Port 8003)         │
                    └─────────────────────────┘
```

## 📁 Project Structure

```
pizza_store_detection/
├── 📂 services/                    # Microservices
│   ├── 📂 api_gateway/            # Main API endpoint (Port 8000)
│   ├── 📂 database/               # Data storage service (Port 8005)
│   ├── 📂 detection/              # YOLO object detection (Port 8002)
│   ├── 📂 frame_reader/           # Video processing (Port 8001)
│   ├── 📂 message_broker/         # Inter-service communication
│   ├── 📂 roi_manager/            # ROI zone management (Port 8004)
│   └── 📂 violation_detector/     # Business logic (Port 8003)
├── 📂 frontend/                   # Web dashboard
├── 📂 models/                     # YOLO model files
├── 📂 uploads/                    # Video uploads
├── 📂 data/                       # Database and logs
├── 🦇 start_all_services.bat     # Start all services
├── 🦇 stop_all_services.bat      # Stop all services
└── 📄 README.md                  # This file
```

## 🚀 Quick Start

### **Method 1: Using Batch Files (Recommended)**

1. **Start All Services:**
   ```bash
   # Double-click or run in terminal
   start_all_services.bat
   ```

2. **Stop All Services:**
   ```bash
   # Double-click or run in terminal
   stop_all_services.bat
   ```

3. **Access the System:**
   - Open browser: `http://localhost:8000`
   - Upload video and set ROI zones
   - Monitor violations in real-time

### **Method 2: Manual Service Startup**

Start each service individually:
```bash
# Terminal 1 - Database
cd services/database
python main.py

# Terminal 2 - Frame Reader  
cd services/frame_reader
python main.py

# Terminal 3 - Detection
cd services/detection
python main.py

# Terminal 4 - ROI Manager
cd services/roi_manager
python main.py

# Terminal 5 - Violation Detector
cd services/violation_detector
python main.py

# Terminal 6 - API Gateway
cd services/api_gateway
python main.py
```

## 🔧 Configuration

### **Environment Variables**
Create `.env` files in service directories:

**Detection Service (`services/detection/.env`):**
```env
CONFIDENCE_THRESHOLD=0.2
IOU_THRESHOLD=0.45
MAX_DETECTIONS=50
MODEL_PATH=./models/yolo12m-v2.pt
```

**Violation Detector (`services/violation_detector/.env`):**
```env
SCOOPER_PROXIMITY_THRESHOLD=100.0
WORK_SESSION_COOLDOWN=30.0
ROI_OVERLAP_THRESHOLD=0.3
```

## 📊 Service Details

### **🎯 Detection Service (Port 8002)**
- **Purpose:** YOLO-based object detection
- **Detects:** Hands, persons, scoopers, pizza
- **Model:** YOLOv8 (yolo12m-v2.pt)
- **Endpoints:** `/detect`, `/health`, `/model_info`

### **🚨 Violation Detector (Port 8003)**
- **Purpose:** Business logic for violation detection
- **Features:** 
  - Sequence-based violation tracking
  - 30-second work session cooldown
  - Hand-scooper proximity analysis
- **Endpoints:** `/process_frame`, `/health`, `/config`

### **🎥 Frame Reader (Port 8001)**
- **Purpose:** Video processing and frame extraction
- **Features:** Multi-format support, frame buffering
- **Endpoints:** `/upload`, `/process`, `/health`

### **🎯 ROI Manager (Port 8004)**
- **Purpose:** Region of Interest zone management
- **Features:** Dynamic ROI creation, zone validation
- **Endpoints:** `/roi`, `/zones`, `/health`

### **💾 Database (Port 8005)**
- **Purpose:** Data persistence
- **Storage:** Violations, sessions, analytics
- **Endpoints:** `/violations`, `/sessions`, `/health`

### **🌐 API Gateway (Port 8000)**
- **Purpose:** Main entry point and frontend serving
- **Features:** Request routing, static file serving
- **Endpoints:** `/api/*`, `/health`, `/`

## 🎮 Usage Guide

### **1. System Startup**
```bash
# Start all services
start_all_services.bat

# Wait for all services to be ready (check console output)
# Look for "✅ All services healthy" message
```

### **2. Access Web Interface**
- Open: `http://localhost:8000`
- Upload video file (MP4, AVI, MOV supported)
- Set processing speed (2-5 FPS recommended)

### **3. Configure ROI Zones**
- Click "🎯 Setup ROI Zones"
- Draw rectangles around food preparation areas
- Name zones (e.g., "pizza_sauce", "cheese", "toppings")
- Save configuration

### **4. Monitor Violations**
- Start video processing
- Watch real-time violation detection
- View violation list with timestamps
- Check service health status

### **5. System Shutdown**
```bash
# Stop all services cleanly
stop_all_services.bat
```

## 🔍 Violation Detection Logic

### **Detection Process:**
1. **Hand Detection:** YOLO identifies hands in video frames
2. **ROI Analysis:** Check if hands are in designated zones
3. **Scooper Detection:** Look for scoopers near hands
4. **Violation Decision:** Apply business rules:
   - Hand enters ROI without scooper = Violation
   - 30-second cooldown prevents duplicate violations
   - One violation per work session (entry to exit)

### **Violation Types:**
- **Hand Without Scooper:** Hand touches food without proper tool
- **Sequence Violation:** Complete work session without compliance
- **Work Session:** Continuous work treated as single violation unit

## 🛠️ Troubleshooting

### **Common Issues:**

**Services Won't Start:**
```bash
# Check if ports are in use
netstat -an | findstr "8000 8001 8002 8003 8004 8005"

# Kill existing Python processes
taskkill /f /im python.exe

# Restart services
start_all_services.bat
```

**No Detections:**
- Check YOLO model file: `models/yolo12m-v2.pt`
- Verify confidence threshold: 0.2 (20%)
- Ensure good video quality and lighting

**No Violations Detected:**
- Verify ROI zones are properly configured
- Check scooper proximity threshold (100px)
- Ensure hands are clearly visible in video

**Frontend Not Loading:**
- Check API Gateway service (Port 8000)
- Verify all services are healthy
- Clear browser cache

## 📈 Performance Optimization

### **Recommended Settings:**
- **FPS:** 2-5 for accuracy, 10+ for speed
- **Confidence:** 0.2 for sensitivity, 0.5 for precision
- **Resolution:** 720p-1080p optimal
- **Video Length:** <5 minutes for testing

### **System Requirements:**
- **CPU:** Multi-core processor (4+ cores recommended)
- **RAM:** 8GB minimum, 16GB recommended
- **Storage:** 2GB free space for models and data
- **Python:** 3.8+ with required packages

## 🔒 Security Notes

- System runs locally (no external connections)
- Video files stored temporarily in `uploads/`
- Database files in `data/` directory
- No sensitive data transmitted externally

## 📝 Logs and Debugging

### **Log Locations:**
- Service logs: Console output
- Violation logs: `log_violation.md`
- Error logs: Service-specific console output

### **Debug Endpoints:**
- Health checks: `http://localhost:800X/health`
- Service status: Check console outputs
- Violation tracking: Monitor violation detector logs

## 🎯 Next Steps

1. **Upload Test Video:** Use sample pizza preparation video
2. **Configure ROI Zones:** Draw zones around ingredient areas  
3. **Monitor Results:** Watch violation detection in action
4. **Adjust Settings:** Fine-tune thresholds as needed
5. **Scale Up:** Add more cameras/videos for full coverage

---

**🚀 Ready to start? Run `start_all_services.bat` and open `http://localhost:8000`!**
