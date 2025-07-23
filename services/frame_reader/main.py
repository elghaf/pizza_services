#!/usr/bin/env python3
"""
Frame Reader Service - Pizza Store Violation Detection System
Handles video ingestion from cameras/files and publishes frames to message broker
"""

import os
import cv2
import json
import base64
import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path

import aiofiles
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Frame Reader Service", version="1.0.0")

class VideoSource(BaseModel):
    source_type: str  # "file", "rtsp", "webcam"
    source_path: str
    fps: int = 30
    resolution: tuple = (1920, 1080)
    session_id: str = None

class FrameReaderConfig:
    """Configuration for frame reader service"""
    def __init__(self):
        self.kafka_broker = os.getenv("KAFKA_BROKER", "localhost:9092")
        self.frame_topic = os.getenv("FRAME_TOPIC", "video_frames")
        self.max_frame_size = int(os.getenv("MAX_FRAME_SIZE", "1048576"))  # 1MB
        self.buffer_size = int(os.getenv("BUFFER_SIZE", "100"))

        # Set video storage path relative to project root
        current_dir = Path(__file__).parent  # services/frame_reader/
        project_root = current_dir.parent.parent  # Go up two levels to project root
        self.video_storage_path = project_root / "videos"
        self.video_storage_path.mkdir(exist_ok=True)

        logger.info(f"📁 Video storage path: {self.video_storage_path.absolute()}")

class ConnectionManager:
    """Manages WebSocket connections"""
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.session_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if session_id:
            if session_id not in self.session_connections:
                self.session_connections[session_id] = []
            self.session_connections[session_id].append(websocket)
        logger.info(f"WebSocket connected. Session: {session_id}, Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, session_id: str = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if session_id and session_id in self.session_connections:
            if websocket in self.session_connections[session_id]:
                self.session_connections[session_id].remove(websocket)
            if not self.session_connections[session_id]:
                del self.session_connections[session_id]
        logger.info(f"WebSocket disconnected. Session: {session_id}, Total connections: {len(self.active_connections)}")

    async def send_to_session(self, session_id: str, message: dict):
        if session_id in self.session_connections:
            disconnected = []
            for connection in self.session_connections[session_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except:
                    disconnected.append(connection)

            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn, session_id)

class FrameReader:
    """Advanced frame reader with multiple source support"""

    def __init__(self, config: FrameReaderConfig):
        self.config = config
        self.is_reading = False
        self.current_source = None
        self.frame_count = 0
        self.start_time = None
        self.current_session_id = None
        
    async def start_reading(self, source: VideoSource, session_id: str = None) -> Dict[str, Any]:
        """Start reading frames from video source"""
        try:
            logger.info(f"🎬 Starting video reading - Source: {source.source_path}, FPS: {source.fps}, Session: {session_id}")

            if self.is_reading:
                logger.warning("⚠️ Already reading from a source")
                raise HTTPException(status_code=400, detail="Already reading from a source")

            # Initialize video capture
            cap = await self._initialize_capture(source)
            if not cap.isOpened():
                error_msg = f"Cannot open video source: {source.source_path}"
                logger.error(f"❌ {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)

            self.current_source = source
            self.is_reading = True
            self.frame_count = 0
            self.start_time = datetime.now()
            self.current_session_id = session_id

            # Get video properties
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            video_fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            logger.info(f"📹 Video properties - Total frames: {total_frames}, Original FPS: {video_fps}, Resolution: {width}x{height}")

            # Start frame reading task
            asyncio.create_task(self._read_frames_loop(cap, source))

            result = {
                "status": "started",
                "source": source.source_path,
                "fps": source.fps,
                "session_id": session_id,
                "video_properties": {
                    "total_frames": total_frames,
                    "original_fps": video_fps,
                    "width": width,
                    "height": height
                },
                "message": "Frame reading started successfully"
            }

            logger.info(f"✅ Frame reading started successfully for session {session_id}")
            return result

        except Exception as e:
            logger.error(f"❌ Failed to start reading: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def _initialize_capture(self, source: VideoSource) -> cv2.VideoCapture:
        """Initialize video capture based on source type"""
        logger.info(f"🔧 Initializing capture for {source.source_type}: {source.source_path}")

        if source.source_type == "file":
            # Get the project root directory (go up from services/frame_reader to project root)
            current_dir = Path(__file__).parent  # services/frame_reader/
            project_root = current_dir.parent.parent  # Go up two levels to project root

            # Try multiple possible paths, prioritizing project root
            possible_paths = [
                project_root / "videos" / source.source_path,  # Project root videos directory
                Path(source.source_path),  # Absolute path
                self.config.video_storage_path / source.source_path,  # Config path
                current_dir / "videos" / source.source_path,  # Local videos dir
                current_dir / source.source_path,  # Current directory
                Path("videos") / source.source_path,  # Relative to current working dir
                Path("../videos") / source.source_path,  # One level up
                Path("../../videos") / source.source_path,  # Two levels up
            ]

            logger.info(f"🗂️ Project root detected: {project_root.absolute()}")
            logger.info(f"📁 Looking for video: {source.source_path}")

            video_path = None
            for i, path in enumerate(possible_paths):
                logger.info(f"🔍 [{i+1}/{len(possible_paths)}] Checking: {path.absolute()}")
                if path.exists() and path.is_file():
                    video_path = path
                    logger.info(f"✅ Found video file at: {video_path.absolute()}")
                    logger.info(f"📊 File size: {video_path.stat().st_size} bytes")
                    break
                else:
                    logger.info(f"❌ Not found: {path.absolute()}")

            if not video_path:
                # List what's actually in the directories for debugging
                logger.error(f"🔍 Debug: Listing directory contents...")
                videos_dir = project_root / "videos"
                if videos_dir.exists():
                    files = list(videos_dir.iterdir())
                    logger.error(f"📁 Files in {videos_dir}: {[f.name for f in files]}")
                else:
                    logger.error(f"📁 Videos directory doesn't exist: {videos_dir}")

                error_msg = f"Video file not found: {source.source_path}. Tried {len(possible_paths)} paths."
                logger.error(f"❌ {error_msg}")
                raise FileNotFoundError(error_msg)

            return cv2.VideoCapture(str(video_path))

        elif source.source_type == "rtsp":
            logger.info(f"📡 Connecting to RTSP stream: {source.source_path}")
            return cv2.VideoCapture(source.source_path)

        elif source.source_type == "webcam":
            camera_id = int(source.source_path) if source.source_path.isdigit() else 0
            logger.info(f"📷 Opening webcam: {camera_id}")
            return cv2.VideoCapture(camera_id)

        else:
            error_msg = f"Unsupported source type: {source.source_type}"
            logger.error(f"❌ {error_msg}")
            raise ValueError(error_msg)
    
    async def _read_frames_loop(self, cap: cv2.VideoCapture, source: VideoSource):
        """Main frame reading loop"""
        try:
            logger.info(f"🎬 Starting frame reading loop - FPS: {source.fps}")

            # Get video properties for frame skipping
            video_fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            # Calculate frame skip for FPS control (for file processing)
            if source.source_type == "file":
                # Skip frames to achieve desired FPS instead of sleeping
                frame_skip = max(1, int(video_fps / source.fps))
                logger.info(f"⚡ Fast file processing mode - Original FPS: {video_fps}, Target FPS: {source.fps}, Frame skip: {frame_skip}")
            else:
                # For live streams, use time-based control
                frame_skip = 1
                frame_interval = 1.0 / source.fps
                logger.info(f"⏱️ Live stream mode - Frame interval: {frame_interval:.3f}s")

            frame_count = 0
            processed_count = 0

            while self.is_reading:
                ret, frame = cap.read()
                if not ret:
                    logger.info(f"📹 End of video stream reached after {frame_count} total frames, {processed_count} processed")
                    break

                frame_count += 1

                # Skip frames for file processing to achieve target FPS
                if source.source_type == "file" and frame_count % frame_skip != 0:
                    continue

                processed_count += 1
                logger.info(f"📸 Processing frame {processed_count} (video frame {frame_count})")

                # Resize frame if needed
                original_size = (frame.shape[1], frame.shape[0])
                if source.resolution != original_size:
                    logger.info(f"🔄 Resizing frame from {original_size} to {source.resolution}")
                    frame = cv2.resize(frame, source.resolution)

                # Process and publish frame
                self.frame_count = processed_count  # Update global frame count
                await self._process_frame(frame, source)

                # Only sleep for live streams, not file processing
                if source.source_type != "file":
                    await asyncio.sleep(frame_interval)

                # Log progress every 10 processed frames
                if processed_count % 10 == 0:
                    logger.info(f"📊 Processed {processed_count} frames ({frame_count} total frames read)")

        except Exception as e:
            logger.error(f"❌ Error in frame reading loop: {e}")
        finally:
            cap.release()
            self.is_reading = False

            # Send completion message
            if self.current_session_id:
                completion_message = {
                    "type": "processing_complete",
                    "session_id": self.current_session_id,
                    "total_frames": self.frame_count,
                    "message": "Video processing completed"
                }
                await manager.send_to_session(self.current_session_id, completion_message)

            logger.info(f"🏁 Frame reading stopped - Total frames processed: {self.frame_count}")
    
    async def _process_frame(self, frame, source: VideoSource):
        """Process and publish frame to message broker"""
        try:
            self.frame_count += 1

            # Encode frame to base64
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_b64 = base64.b64encode(buffer).decode('utf-8')

            # Create frame message
            frame_message = {
                "frame_id": f"{source.source_path}_{self.frame_count}_{int(datetime.now().timestamp())}",
                "timestamp": datetime.now().isoformat(),
                "source_info": {
                    "type": source.source_type,
                    "path": source.source_path,
                    "fps": source.fps,
                    "resolution": source.resolution
                },
                "frame_data": frame_b64,
                "frame_number": self.frame_count,
                "metadata": {
                    "size": len(frame_b64),
                    "encoding": "base64_jpeg",
                    "quality": 85
                }
            }

            # Publish to message broker (Kafka implementation would go here)
            await self._publish_frame(frame_message)

            # Send to WebSocket clients
            if self.current_session_id:
                await self._send_frame_to_websocket(frame_message)

            # Log progress every 50 frames
            if self.frame_count % 50 == 0:
                elapsed = (datetime.now() - self.start_time).total_seconds()
                fps_actual = self.frame_count / elapsed if elapsed > 0 else 0
                logger.info(f"📊 Processed {self.frame_count} frames, actual FPS: {fps_actual:.2f}")

        except Exception as e:
            logger.error(f"❌ Error processing frame {self.frame_count}: {e}")

    async def _send_frame_to_websocket(self, frame_message: Dict[str, Any]):
        """Send frame data to WebSocket clients with real detection and violation analysis"""
        try:
            logger.info(f"🔍 Processing frame {self.frame_count} for detection...")

            # Call detection service for real YOLO detection
            detections = await self._call_detection_service(frame_message)

            # If detection service fails, fall back to mock detections
            if not detections:
                logger.warning("⚠️ Detection service failed, using mock detections")
                detections = await self._get_mock_detections(frame_message)

            # Fetch ROI zones from ROI Manager
            roi_zones = await self._fetch_roi_zones()

            # Skip tracking service - use ONLY original detections
            logger.info(f"✅ Using original detections with {len(detections)} objects")

            # Analyze violations using original violation detection service
            violations = []
            if roi_zones:
                violations = await self._analyze_violations(frame_message, detections, roi_zones)

            # Check if we have tracking data
            has_tracking = any("track_id" in det for det in detections)

            ws_message = {
                "type": "frame_processed",
                "frame_id": frame_message["frame_id"],
                "timestamp": frame_message["timestamp"],
                "frame_data": frame_message["frame_data"],
                "detections": detections,
                "violations": violations,
                "roi_zones": roi_zones,
                "progress": min(100, (self.frame_count / 1000) * 100),  # Mock progress
                "frame_number": self.frame_count,
                "detection_source": "tracking" if has_tracking else ("yolo" if detections != await self._get_mock_detections(frame_message) else "mock"),
                "tracking_enabled": has_tracking,
                "frame_info": {
                    "dimensions": frame_message["source_info"]["resolution"],
                    "fps": frame_message["source_info"]["fps"]
                }
            }

            logger.info(f"📡 Sending frame {self.frame_count} with {len(detections)} detections, {len(violations)} violations, {len(roi_zones)} ROI zones to WebSocket")
            await manager.send_to_session(self.current_session_id, ws_message)

        except Exception as e:
            logger.error(f"❌ Error sending frame to WebSocket: {e}")

    async def _call_detection_service(self, frame_message: Dict[str, Any]) -> List[Dict]:
        """Call the detection service for real YOLO detection"""
        try:
            import httpx

            detection_request = {
                "frame_id": frame_message["frame_id"],
                "frame_data": frame_message["frame_data"],
                "timestamp": frame_message["timestamp"],
                "source_info": frame_message["source_info"]
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "http://localhost:8002/detect",
                    json=detection_request
                )

                if response.status_code == 200:
                    result = response.json()
                    detections = result.get("detections", [])
                    logger.info(f"✅ Detection service returned {len(detections)} detections")
                    return detections
                else:
                    logger.error(f"❌ Detection service error: {response.status_code} - {response.text}")
                    return []

        except Exception as e:
            logger.error(f"❌ Error calling detection service: {e}")
            return []

    async def _fetch_roi_zones(self) -> List[Dict]:
        """Fetch ROI zones from ROI Manager service (fresh data each time)"""
        try:
            import httpx

            # Always fetch fresh ROI data to reflect any changes (additions/deletions)
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get("http://localhost:8004/rois")

                if response.status_code == 200:
                    result = response.json()
                    # ROI Manager returns {"success": true, "data": [...], "count": N}
                    # Extract the actual ROI data
                    if isinstance(result, dict) and 'data' in result:
                        rois = result['data']
                    elif isinstance(result, list):
                        rois = result
                    else:
                        logger.warning(f"⚠️ Unexpected ROI Manager response format: {result}")
                        rois = []

                    logger.info(f"✅ Fetched {len(rois)} ROI zones from ROI Manager")
                    return rois
                else:
                    logger.error(f"❌ ROI Manager error: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"❌ Error fetching ROI zones: {e}")
            return []

    async def _analyze_violations(self, frame_message: Dict[str, Any], detections: List[Dict], roi_zones: List[Dict]) -> List[Dict]:
        """Analyze frame for violations using violation detection service"""
        try:
            import httpx

            # Prepare violation analysis request
            violation_request = {
                "frame_id": frame_message["frame_id"],
                "timestamp": frame_message["timestamp"],
                "detections": detections,
                "rois": roi_zones
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "http://localhost:8003/analyze",
                    json=violation_request
                )

                if response.status_code == 200:
                    result = response.json()
                    violations = result.get("violations", [])
                    logger.info(f"✅ Violation analysis returned {len(violations)} violations")
                    return violations
                else:
                    logger.error(f"❌ Violation detection service error: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"❌ Error analyzing violations: {e}")
            return []

    async def _call_tracking_service(self, frame_message: Dict[str, Any], detections: List[Dict], roi_zones: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Call the tracking service for enhanced object tracking and violation detection"""
        try:
            import httpx

            # Prepare tracking request
            tracking_request = {
                "frame_id": frame_message["frame_id"],
                "timestamp": frame_message["timestamp"],
                "detections": detections,
                "rois": roi_zones,
                "frame_info": frame_message.get("source_info", {})
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "http://localhost:8006/track",
                    json=tracking_request
                )

                if response.status_code == 200:
                    result = response.json()
                    tracked_detections = result.get("tracked_detections", [])
                    violations = result.get("violations", [])

                    # Convert tracked detections to standard detection format
                    standard_detections = []
                    for tracked_det in tracked_detections:
                        standard_detection = {
                            "class_name": tracked_det["class_name"],
                            "confidence": tracked_det["confidence"],
                            "bbox": tracked_det["bbox"],
                            "center": tracked_det["center"],
                            "area": tracked_det["area"],
                            # Add tracking metadata
                            "track_id": tracked_det["track_id"],
                            "stability_score": tracked_det["stability_score"],
                            "frames_tracked": tracked_det["frames_tracked"],
                            "avg_confidence": tracked_det["avg_confidence"],
                            "velocity": tracked_det["velocity"],
                            "associated_objects": tracked_det["associated_objects"]
                        }
                        standard_detections.append(standard_detection)

                    logger.info(f"✅ Tracking service returned {len(tracked_detections)} tracked objects, {len(violations)} violations")
                    return standard_detections, violations
                else:
                    logger.error(f"❌ Tracking service error: {response.status_code}")
                    return [], []

        except Exception as e:
            logger.error(f"❌ Error calling tracking service: {e}")
            return [], []

    async def _get_mock_detections(self, frame_message: Dict[str, Any]) -> List[Dict]:
        """Generate mock detections for testing"""
        import random

        # Generate realistic mock detections
        detections = []

        # Random chance of detecting objects
        if random.random() < 0.7:  # 70% chance of hand detection
            detections.append({
                "class_name": "hand",
                "confidence": random.uniform(0.7, 0.95),
                "bbox": {
                    "x1": random.randint(100, 400),
                    "y1": random.randint(100, 300),
                    "x2": random.randint(450, 600),
                    "y2": random.randint(350, 450)
                }
            })

        if random.random() < 0.3:  # 30% chance of scooper detection
            detections.append({
                "class_name": "scooper",
                "confidence": random.uniform(0.6, 0.9),
                "bbox": {
                    "x1": random.randint(200, 500),
                    "y1": random.randint(150, 350),
                    "x2": random.randint(550, 650),
                    "y2": random.randint(400, 500)
                }
            })

        if random.random() < 0.8:  # 80% chance of person detection
            detections.append({
                "class_name": "person",
                "confidence": random.uniform(0.8, 0.98),
                "bbox": {
                    "x1": random.randint(50, 200),
                    "y1": random.randint(50, 150),
                    "x2": random.randint(400, 700),
                    "y2": random.randint(400, 600)
                }
            })

        return detections
    
    async def _publish_frame(self, frame_message: Dict[str, Any]):
        """Publish frame to message broker"""
        # TODO: Implement Kafka producer
        # For now, we'll simulate publishing
        logger.debug(f"Publishing frame {frame_message['frame_id']}")
        
        # In a real implementation, this would be:
        # await self.kafka_producer.send(self.config.frame_topic, frame_message)
    
    async def stop_reading(self) -> Dict[str, Any]:
        """Stop frame reading"""
        if not self.is_reading:
            return {"status": "not_reading", "message": "No active reading session"}
        
        self.is_reading = False
        elapsed = (datetime.now() - self.start_time).total_seconds()
        
        return {
            "status": "stopped",
            "frames_processed": self.frame_count,
            "duration_seconds": elapsed,
            "average_fps": self.frame_count / elapsed if elapsed > 0 else 0
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get current reading status"""
        if not self.is_reading:
            return {"status": "idle", "is_reading": False}
        
        elapsed = (datetime.now() - self.start_time).total_seconds()
        return {
            "status": "reading",
            "is_reading": True,
            "current_source": self.current_source.model_dump() if self.current_source else None,
            "frames_processed": self.frame_count,
            "duration_seconds": elapsed,
            "current_fps": self.frame_count / elapsed if elapsed > 0 else 0
        }

# Global instances
config = FrameReaderConfig()
frame_reader = FrameReader(config)
manager = ConnectionManager()

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "frame_reader",
        "version": "1.0.0",
        "kafka_broker": config.kafka_broker,
        "frame_topic": config.frame_topic
    }

@app.post("/start")
async def start_reading(source: VideoSource, background_tasks: BackgroundTasks):
    """Start reading frames from video source"""
    # Use session ID from request, or generate one if not provided
    session_id = source.session_id or f"session_{int(datetime.now().timestamp())}"
    logger.info(f"🚀 Starting video processing with session ID: {session_id}")
    return await frame_reader.start_reading(source, session_id)

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time frame streaming"""
    logger.info(f"🔌 WebSocket connection attempt for session: {session_id}")
    try:
        await manager.connect(websocket, session_id)
        logger.info(f"✅ WebSocket connected for session: {session_id}")

        # Send initial connection message
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "session_id": session_id,
            "message": "WebSocket connection established"
        }))

        # Keep connection alive
        while True:
            try:
                # Wait for messages from client (ping/pong)
                data = await websocket.receive_text()
                message = json.loads(data)

                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }))

            except WebSocketDisconnect:
                logger.info(f"🔌 WebSocket disconnected for session: {session_id}")
                break
            except Exception as e:
                logger.error(f"❌ WebSocket error for session {session_id}: {e}")
                break

    except Exception as e:
        logger.error(f"❌ WebSocket connection error for session {session_id}: {e}")
    finally:
        manager.disconnect(websocket, session_id)

@app.post("/stop")
async def stop_reading():
    """Stop frame reading"""
    return await frame_reader.stop_reading()

@app.get("/status")
async def get_status():
    """Get current reading status"""
    return frame_reader.get_status()

@app.get("/config")
async def get_config():
    """Get service configuration"""
    return {
        "kafka_broker": config.kafka_broker,
        "frame_topic": config.frame_topic,
        "max_frame_size": config.max_frame_size,
        "buffer_size": config.buffer_size,
        "video_storage_path": str(config.video_storage_path),
        "video_storage_absolute": str(config.video_storage_path.absolute())
    }

@app.get("/debug/videos")
async def list_videos():
    """Debug endpoint to list available videos"""
    try:
        videos_dir = config.video_storage_path
        if not videos_dir.exists():
            return {
                "error": "Videos directory doesn't exist",
                "path": str(videos_dir.absolute()),
                "videos": []
            }

        video_files = []
        for ext in ['*.mp4', '*.avi', '*.mov', '*.mkv', '*.webm']:
            video_files.extend(videos_dir.glob(ext))

        return {
            "videos_directory": str(videos_dir.absolute()),
            "videos_found": len(video_files),
            "videos": [
                {
                    "name": f.name,
                    "size": f.stat().st_size,
                    "path": str(f.absolute())
                } for f in video_files
            ]
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    logger.info("Starting Frame Reader Service")
    uvicorn.run(app, host="0.0.0.0", port=8001)
