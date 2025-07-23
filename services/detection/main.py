#!/usr/bin/env python3
"""
Detection Service - Pizza Store Violation Detection System
YOLO-based object detection for Hand, Person, Pizza, Scooper detection
"""

import os
import cv2
import json
import base64
import numpy as np
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logging.warning("Ultralytics YOLO not available. Using mock detection.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Detection Service", version="1.0.0")

class DetectionRequest(BaseModel):
    frame_id: str
    frame_data: str  # base64 encoded image
    timestamp: str
    source_info: Dict[str, Any]

class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: Dict[str, float]  # x1, y1, x2, y2
    center: Dict[str, float]  # x, y
    area: float

class DetectionResponse(BaseModel):
    frame_id: str
    timestamp: str
    detections: List[Detection]
    processing_time_ms: float
    model_info: Dict[str, Any]

class DetectionConfig:
    """Configuration for detection service"""
    def __init__(self):
        self.model_path = os.getenv("MODEL_PATH", "./models/yolo12m-v2.pt")
        self.confidence_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.2"))
        self.iou_threshold = float(os.getenv("IOU_THRESHOLD", "0.45"))
        self.target_classes = ["hand", "person", "pizza", "scooper"]
        self.device = os.getenv("DEVICE", "cpu")  # cpu or cuda
        self.max_detections = int(os.getenv("MAX_DETECTIONS", "50"))

class PizzaStoreDetector:
    """Advanced YOLO-based detector for pizza store objects"""
    
    def __init__(self, config: DetectionConfig):
        self.config = config
        self.model = None
        self.model_loaded = False
        self.detection_count = 0
        self.load_model()
    
    def load_model(self):
        """Load YOLO model"""
        try:
            # Try multiple possible model paths
            current_dir = Path(__file__).parent  # services/detection/
            project_root = current_dir.parent.parent  # Go up two levels to project root

            possible_model_paths = [
                Path(self.config.model_path),  # Original config path
                project_root / "models" / "yolo12m-v2.pt",  # Project root models
                current_dir / "models" / "yolo12m-v2.pt",  # Local models
                Path("models/yolo12m-v2.pt"),  # Relative path
                Path("./models/yolo12m-v2.pt"),  # Current dir relative
            ]

            model_path = None
            for path in possible_model_paths:
                logger.info(f"🔍 Checking model path: {path.absolute()}")
                if path.exists():
                    model_path = path
                    logger.info(f"✅ Found YOLO model at: {model_path.absolute()}")
                    break

            if YOLO_AVAILABLE and model_path:
                logger.info(f"🤖 Loading YOLO model from: {model_path}")
                self.model = YOLO(str(model_path))
                self.model_loaded = True
                logger.info(f"✅ YOLO model loaded successfully!")
                logger.info(f"📊 Model classes: {list(self.model.names.values())}")
            else:
                if not YOLO_AVAILABLE:
                    logger.warning("⚠️ Ultralytics YOLO not available. Using mock detection.")
                else:
                    logger.warning(f"⚠️ YOLO model not found. Tried paths: {[str(p.absolute()) for p in possible_model_paths]}")
                logger.warning("🎭 Using mock detection instead.")
                self.model_loaded = False
        except Exception as e:
            logger.error(f"❌ Failed to load YOLO model: {e}")
            self.model_loaded = False
    
    async def detect_objects(self, request: DetectionRequest) -> DetectionResponse:
        """Perform object detection on frame"""
        start_time = datetime.now()

        try:
            logger.info(f"🔍 Processing detection request for frame: {request.frame_id}")

            # Decode base64 image
            image_data = base64.b64decode(request.frame_data)
            nparr = np.frombuffer(image_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                raise ValueError("Could not decode image")

            logger.info(f"📸 Frame decoded successfully: {frame.shape}")

            # Perform detection
            if self.model_loaded:
                logger.info("🤖 Using YOLO model for detection")
                detections = await self._yolo_detection(frame)
            else:
                logger.info("🎭 Using mock detection (YOLO not available)")
                detections = await self._mock_detection(frame)

            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            self.detection_count += 1

            logger.info(f"✅ Detection completed: {len(detections)} objects found in {processing_time:.1f}ms")

            return DetectionResponse(
                frame_id=request.frame_id,
                timestamp=datetime.now().isoformat(),
                detections=detections,
                processing_time_ms=processing_time,
                model_info={
                    "model_loaded": self.model_loaded,
                    "model_path": self.config.model_path,
                    "confidence_threshold": self.config.confidence_threshold,
                    "target_classes": self.config.target_classes,
                    "total_detections_processed": self.detection_count,
                    "frame_dimensions": {
                        "width": frame.shape[1],
                        "height": frame.shape[0]
                    },
                    "coordinate_system": "top_left_origin"
                }
            )

        except Exception as e:
            logger.error(f"❌ Detection error for frame {request.frame_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def _yolo_detection(self, frame: np.ndarray) -> List[Detection]:
        """Perform YOLO-based detection"""
        try:
            # Run YOLO inference
            results = self.model(
                frame,
                conf=self.config.confidence_threshold,
                iou=self.config.iou_threshold,
                device=self.config.device,
                verbose=False
            )
            
            detections = []
            
            for result in results:
                if result.boxes is not None:
                    boxes = result.boxes.cpu().numpy()
                    
                    for box in boxes:
                        # Extract box information
                        x1, y1, x2, y2 = box.xyxy[0]
                        confidence = float(box.conf[0])
                        class_id = int(box.cls[0])
                        
                        # Get class name
                        class_name = self.model.names[class_id].lower()
                        
                        # Filter for target classes
                        if class_name in self.config.target_classes:
                            # Calculate center and area
                            center_x = (x1 + x2) / 2
                            center_y = (y1 + y2) / 2
                            area = (x2 - x1) * (y2 - y1)
                            
                            detection = Detection(
                                class_name=class_name,
                                confidence=confidence,
                                bbox={
                                    "x1": float(x1),
                                    "y1": float(y1),
                                    "x2": float(x2),
                                    "y2": float(y2),
                                    "width": float(x2 - x1),
                                    "height": float(y2 - y1)
                                },
                                center={
                                    "x": float(center_x),
                                    "y": float(center_y)
                                },
                                area=float(area)
                            )
                            detections.append(detection)
            
            # Sort by confidence and limit detections
            detections.sort(key=lambda x: x.confidence, reverse=True)
            return detections[:self.config.max_detections]
            
        except Exception as e:
            logger.error(f"YOLO detection error: {e}")
            return []
    
    async def _mock_detection(self, frame: np.ndarray) -> List[Detection]:
        """Mock detection for testing when YOLO is not available"""
        import random
        
        height, width = frame.shape[:2]
        detections = []
        
        # Generate mock detections
        mock_objects = [
            {"class": "hand", "count": random.randint(0, 2)},
            {"class": "person", "count": random.randint(0, 1)},
            {"class": "pizza", "count": random.randint(0, 1)},
            {"class": "scooper", "count": random.randint(0, 1)}
        ]
        
        for obj in mock_objects:
            for _ in range(obj["count"]):
                # Generate random but realistic bounding box
                if obj["class"] == "person":
                    w, h = random.randint(100, 200), random.randint(200, 400)
                elif obj["class"] == "pizza":
                    w, h = random.randint(80, 150), random.randint(80, 150)
                elif obj["class"] == "hand":
                    w, h = random.randint(30, 60), random.randint(30, 60)
                else:  # scooper
                    w, h = random.randint(20, 40), random.randint(60, 100)
                
                x1 = random.randint(0, max(1, width - w))
                y1 = random.randint(0, max(1, height - h))
                x2 = x1 + w
                y2 = y1 + h
                
                # Generate realistic confidence values based on object type
                if obj["class"] == "scooper":
                    # Scoopers are often harder to detect, use lower confidence range
                    confidence = random.uniform(0.2, 0.7)
                else:
                    # Other objects maintain higher confidence
                    confidence = random.uniform(0.6, 0.95)

                detection = Detection(
                    class_name=obj["class"],
                    confidence=confidence,
                    bbox={"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    center={"x": (x1 + x2) / 2, "y": (y1 + y2) / 2},
                    area=w * h
                )
                detections.append(detection)
        
        return detections
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "model_loaded": self.model_loaded,
            "model_path": self.config.model_path,
            "confidence_threshold": self.config.confidence_threshold,
            "iou_threshold": self.config.iou_threshold,
            "target_classes": self.config.target_classes,
            "device": self.config.device,
            "max_detections": self.config.max_detections,
            "total_detections_processed": self.detection_count,
            "yolo_available": YOLO_AVAILABLE
        }

# Global instances
config = DetectionConfig()
detector = PizzaStoreDetector(config)

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "detection",
        "version": "1.0.0",
        "model_loaded": detector.model_loaded,
        "yolo_available": YOLO_AVAILABLE
    }

@app.post("/detect", response_model=DetectionResponse)
async def detect_objects(request: DetectionRequest):
    """Perform object detection on frame"""
    return await detector.detect_objects(request)

@app.get("/model_info")
async def get_model_info():
    """Get model information"""
    return detector.get_model_info()





if __name__ == "__main__":
    logger.info("Starting Detection Service")
    uvicorn.run(app, host="0.0.0.0", port=8002)
