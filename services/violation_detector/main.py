#!/usr/bin/env python3
"""
Violation Detection Service - Pizza Store Violation Detection System
Business logic for detecting scooper usage violations
"""

import os
import sys
import json
import logging
import math
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict, deque
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import httpx
import cv2
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add message broker client to path
sys.path.append(str(Path(__file__).parent.parent / "message_broker"))
try:
    from client import MessageBrokerClient, BrokerClientConfig, MessageTypes, publish_violation_detected
    MESSAGE_BROKER_AVAILABLE = True
    logger.info("✅ Message broker client available")
except ImportError:
    MESSAGE_BROKER_AVAILABLE = False
    logger.warning("⚠️ Message broker client not available")

# Import frame storage
try:
    from frame_storage import FrameStorageManager
    FRAME_STORAGE_AVAILABLE = True
    logger.info("✅ Frame storage available")
except ImportError:
    FRAME_STORAGE_AVAILABLE = False
    logger.warning("⚠️ Frame storage not available")

# FastAPI app
app = FastAPI(title="Violation Detection Service", version="1.0.0")

class ViolationType(str, Enum):
    HAND_WITHOUT_SCOOPER = "hand_without_scooper"
    INGREDIENT_GRABBED_NO_SCOOPER = "ingredient_grabbed_no_scooper"
    IMPROPER_HYGIENE = "improper_hygiene"

class ActionType(str, Enum):
    CLEANING = "cleaning"
    GRABBING = "grabbing"
    IDLE = "idle"
    UNKNOWN = "unknown"

@dataclass
class ROISequence:
    """Track a complete sequence of hand interaction with ROI zone"""
    sequence_id: str
    hand_id: str
    roi_name: str
    worker_id: Optional[int] = None

    # Sequence tracking
    entry_frame: str = None
    exit_frame: str = None
    entry_time: datetime = None
    exit_time: datetime = None

    # Frames in sequence
    frames_in_roi: List[str] = None
    positions_in_roi: List[Dict[str, float]] = None

    # Scooper usage tracking
    scooper_usage_frames: List[bool] = None  # True if using scooper in each frame
    scooper_distances: List[float] = None    # Distance to closest scooper in each frame

    # Sequence status
    is_active: bool = True
    is_complete: bool = False

    def __post_init__(self):
        if self.frames_in_roi is None:
            self.frames_in_roi = []
        if self.positions_in_roi is None:
            self.positions_in_roi = []
        if self.scooper_usage_frames is None:
            self.scooper_usage_frames = []
        if self.scooper_distances is None:
            self.scooper_distances = []
        if self.entry_time is None:
            self.entry_time = datetime.now()

    def add_frame(self, frame_id: str, position: Dict[str, float], using_scooper: bool, scooper_distance: float):
        """Add a frame to the sequence"""
        self.frames_in_roi.append(frame_id)
        self.positions_in_roi.append(position)
        self.scooper_usage_frames.append(using_scooper)
        self.scooper_distances.append(scooper_distance)

    def complete_sequence(self, exit_frame: str):
        """Mark sequence as complete when hand exits ROI"""
        self.exit_frame = exit_frame
        self.exit_time = datetime.now()
        self.is_active = False
        self.is_complete = True

    def get_sequence_duration(self) -> float:
        """Get duration of sequence in seconds"""
        if self.exit_time and self.entry_time:
            return (self.exit_time - self.entry_time).total_seconds()
        return 0.0

    def get_scooper_usage_percentage(self) -> float:
        """Get percentage of frames where scooper was used"""
        if not self.scooper_usage_frames:
            return 0.0
        return (sum(self.scooper_usage_frames) / len(self.scooper_usage_frames)) * 100

    def was_scooper_used_properly(self) -> bool:
        """Determine if scooper was used properly during the sequence"""
        if not self.scooper_usage_frames:
            return False

        # Require scooper usage in at least 70% of frames
        usage_percentage = self.get_scooper_usage_percentage()
        return usage_percentage >= 70.0

@dataclass
class HandTracker:
    """Track hand movements over time for temporal analysis"""
    hand_id: str
    positions: List[Tuple[float, float]] = None
    timestamps: List[datetime] = None
    roi_entries: List[str] = None
    last_seen: datetime = None

    def __post_init__(self):
        if self.positions is None:
            self.positions = []
        if self.timestamps is None:
            self.timestamps = []
        if self.roi_entries is None:
            self.roi_entries = []
        if self.last_seen is None:
            self.last_seen = datetime.now()

    def add_position(self, x: float, y: float, roi_name: str = None):
        """Add a new position for this hand"""
        self.positions.append((x, y))
        self.timestamps.append(datetime.now())
        self.last_seen = datetime.now()

        if roi_name and roi_name not in self.roi_entries:
            self.roi_entries.append(roi_name)

        # Keep only last 10 positions for memory efficiency
        if len(self.positions) > 10:
            self.positions = self.positions[-10:]
            self.timestamps = self.timestamps[-10:]

    def get_movement_distance(self) -> float:
        """Calculate total movement distance"""
        if len(self.positions) < 2:
            return 0.0

        total_distance = 0.0
        for i in range(1, len(self.positions)):
            x1, y1 = self.positions[i-1]
            x2, y2 = self.positions[i]
            distance = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
            total_distance += distance

        return total_distance

    def get_direction_changes(self) -> int:
        """Count direction changes to detect erratic movement"""
        if len(self.positions) < 3:
            return 0

        direction_changes = 0
        for i in range(2, len(self.positions)):
            x1, y1 = self.positions[i-2]
            x2, y2 = self.positions[i-1]
            x3, y3 = self.positions[i]

            # Calculate vectors
            v1 = (x2 - x1, y2 - y1)
            v2 = (x3 - x2, y3 - y2)

            # Calculate dot product to determine direction change
            dot_product = v1[0] * v2[0] + v1[1] * v2[1]
            if dot_product < 0:  # Direction changed
                direction_changes += 1

        return direction_changes

    def is_stale(self, max_age_seconds: int = 5) -> bool:
        """Check if this tracker is stale (hand not seen recently)"""
        return (datetime.now() - self.last_seen).total_seconds() > max_age_seconds

@dataclass
class Detection:
    class_name: str
    confidence: float
    bbox: Dict[str, float]
    center: Dict[str, float]
    area: float
    frame_id: str
    timestamp: datetime

@dataclass
class ROI:
    name: str
    shape: str
    ingredient_type: str
    requires_scooper: bool = True
    # Rectangle properties
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    # Polygon properties
    points: Optional[List[Dict[str, float]]] = None

class ViolationEvent(BaseModel):
    violation_id: str
    frame_id: str
    timestamp: str
    violation_type: ViolationType
    description: str
    confidence: float
    evidence: Dict[str, Any]
    worker_id: Optional[str] = None
    roi_name: str
    severity: str  # "low", "medium", "high"
    movement_pattern: Optional[str] = None
    movement_confidence: Optional[float] = None

class AnalysisRequest(BaseModel):
    frame_id: str
    timestamp: str
    detections: List[Dict[str, Any]]
    rois: List[Dict[str, Any]]

class AnalysisWithFrameRequest(BaseModel):
    frame_id: str
    timestamp: str
    detections: List[Dict[str, Any]]
    rois: List[Dict[str, Any]]
    frame_base64: Optional[str] = None  # Base64 encoded frame image
    session_id: Optional[str] = None

class ViolationDetectorConfig:
    """Configuration for violation detection"""
    def __init__(self):
        self.temporal_window_seconds = int(os.getenv("TEMPORAL_WINDOW", "5"))
        self.movement_threshold = float(os.getenv("MOVEMENT_THRESHOLD", "20.0"))
        self.roi_overlap_threshold = float(os.getenv("ROI_OVERLAP_THRESHOLD", "0.3"))
        self.scooper_proximity_threshold = float(os.getenv("SCOOPER_PROXIMITY", "100.0"))
        self.violation_confidence_threshold = float(os.getenv("VIOLATION_CONFIDENCE", "0.7"))

        # Enhanced active usage detection settings
        self.active_usage_threshold = float(os.getenv("ACTIVE_USAGE_THRESHOLD", "40.0"))  # Pixels for active holding
        self.usage_confidence_threshold = float(os.getenv("USAGE_CONFIDENCE", "0.6"))    # Confidence for active usage
        self.enable_active_usage_detection = os.getenv("ENABLE_ACTIVE_USAGE", "true").lower() == "true"
        self.max_workers = int(os.getenv("MAX_WORKERS", "4"))

        # Professional violation deduplication settings
        self.violation_cooldown_seconds = float(os.getenv("VIOLATION_COOLDOWN", "3.0"))
        self.spatial_threshold = float(os.getenv("SPATIAL_THRESHOLD", "50.0"))
        self.temporal_threshold = float(os.getenv("TEMPORAL_THRESHOLD", "5.0"))

        # Continuous violation spam prevention
        self.continuous_violation_window = float(os.getenv("CONTINUOUS_VIOLATION_WINDOW", "60.0"))  # 60 seconds
        self.max_violations_per_window = int(os.getenv("MAX_VIOLATIONS_PER_WINDOW", "1"))  # Max 1 per minute

class WorkerTracker:
    """Track individual workers and their actions"""
    
    def __init__(self, worker_id: str):
        self.worker_id = worker_id
        self.detection_history = deque(maxlen=50)  # Last 50 detections
        self.hand_positions = deque(maxlen=20)     # Last 20 hand positions
        self.current_action = ActionType.IDLE
        self.last_seen = datetime.now()
        self.violations = []
    
    def update(self, detections: List[Detection], frame_id: str):
        """Update worker state with new detections"""
        self.last_seen = datetime.now()
        
        # Find hand detections for this worker
        hand_detections = [d for d in detections if d.class_name == "hand"]
        
        if hand_detections:
            # For simplicity, take the first hand detection
            # In a real system, you'd use person tracking to associate hands with specific workers
            hand = hand_detections[0]
            self.hand_positions.append({
                "position": hand.center,
                "timestamp": hand.timestamp,
                "frame_id": frame_id
            })
            
            # Analyze movement to determine action
            self.current_action = self._analyze_movement()
        
        self.detection_history.extend(detections)
    
    def _analyze_movement(self) -> ActionType:
        """Analyze hand movement to determine action type with enhanced logic"""
        if len(self.hand_positions) < 3:
            return ActionType.UNKNOWN

        # Calculate movement over last few positions
        recent_positions = list(self.hand_positions)[-5:]
        total_movement = 0
        direction_changes = 0

        for i in range(1, len(recent_positions)):
            prev_pos = recent_positions[i-1]["position"]
            curr_pos = recent_positions[i]["position"]

            movement = ((curr_pos["x"] - prev_pos["x"])**2 +
                       (curr_pos["y"] - prev_pos["y"])**2)**0.5
            total_movement += movement

            # Count direction changes (indicates cleaning motion)
            if i > 1:
                prev_prev_pos = recent_positions[i-2]["position"]

                # Calculate direction vectors
                dir1_x = prev_pos["x"] - prev_prev_pos["x"]
                dir1_y = prev_pos["y"] - prev_prev_pos["y"]
                dir2_x = curr_pos["x"] - prev_pos["x"]
                dir2_y = curr_pos["y"] - prev_pos["y"]

                # Check for significant direction change
                if abs(dir1_x) > 5 or abs(dir1_y) > 5:  # Ignore tiny movements
                    dot_product = dir1_x * dir2_x + dir1_y * dir2_y
                    if dot_product < 0:  # Opposite directions
                        direction_changes += 1

        # Enhanced action classification
        avg_movement = total_movement / len(recent_positions) if recent_positions else 0

        # Cleaning: many direction changes, moderate movement
        if direction_changes >= 2 and 15 <= avg_movement <= 40:
            return ActionType.CLEANING

        # Idle: very little movement
        elif avg_movement < 8:
            return ActionType.IDLE

        # Grabbing: significant movement with few direction changes
        elif avg_movement > 12 and direction_changes <= 1:
            return ActionType.GRABBING

        # Default for unclear patterns
        else:
            return ActionType.UNKNOWN
    
    def get_current_hand_position(self) -> Optional[Dict[str, float]]:
        """Get current hand position"""
        if self.hand_positions:
            return self.hand_positions[-1]["position"]
        return None

class ViolationDetector:
    """Advanced violation detection with temporal analysis"""
    
    def __init__(self, config: ViolationDetectorConfig):
        self.config = config
        self.workers = {}  # worker_id -> WorkerTracker
        self.violation_history = []
        self.frame_buffer = deque(maxlen=100)
        self.violation_count = 0
        self.hand_trackers: Dict[str, HandTracker] = {}  # Track hand movements for false positive filtering

        # Professional violation deduplication
        self.active_violations = {}  # Track ongoing violations to prevent duplicates
        self.violation_cooldown_seconds = config.violation_cooldown_seconds
        self.spatial_threshold = config.spatial_threshold

        # SEQUENCE TRACKING - Track complete hand sequences in ROI zones
        self.active_sequences: Dict[str, ROISequence] = {}  # Currently active sequences
        self.completed_sequences: List[ROISequence] = []    # Completed sequences for analysis
        self.sequence_counter = 0

        # SIMPLIFIED SEQUENCE VIOLATIONS - One violation per entry-to-exit sequence
        self.sequence_violations: Dict[str, str] = {}  # sequence_key -> violation_id

        # VIOLATION COOLDOWN - Prevent violations too close in time (minimum 1 second apart)
        self.violation_timestamps: Dict[str, float] = {}  # sequence_key -> last_violation_timestamp
        self.temporal_threshold = config.temporal_threshold

        # Enhanced deduplication for continuous violations
        self.continuous_violations = {}  # Track continuous violations by ROI
        self.continuous_violation_window = config.continuous_violation_window
        self.max_violations_per_window = config.max_violations_per_window
        self.database_url = os.getenv("DATABASE_SERVICE_URL", "http://localhost:8005")
        self.current_session_id = None
        self.message_broker_client = None
        self.frame_storage = None

        # Initialize message broker client if available
        if MESSAGE_BROKER_AVAILABLE:
            self._init_message_broker()

        # Initialize frame storage if available
        if FRAME_STORAGE_AVAILABLE:
            self._init_frame_storage()

    def _init_message_broker(self):
        """Initialize message broker client"""
        try:
            broker_config = BrokerClientConfig(
                service_name="violation_detector",
                use_direct_rabbitmq=False,  # Use HTTP mode
                broker_service_url=os.getenv("BROKER_SERVICE_URL", "http://localhost:8010")
            )
            # Note: We'll initialize this async in the startup event
            self._broker_config = broker_config
            logger.info("🔧 Message broker configuration prepared")
        except Exception as e:
            logger.error(f"❌ Failed to prepare message broker config: {e}")

    def _init_frame_storage(self):
        """Initialize frame storage manager"""
        try:
            storage_config = {
                "base_path": os.getenv("VIOLATION_FRAMES_PATH", "violation_frames"),
                "max_frame_size": (1920, 1080),
                "jpeg_quality": int(os.getenv("FRAME_JPEG_QUALITY", "85")),
                "store_base64": os.getenv("STORE_FRAME_BASE64", "true").lower() == "true",
                "store_file": os.getenv("STORE_FRAME_FILE", "true").lower() == "true"
            }
            self.frame_storage = FrameStorageManager(storage_config)
            logger.info("🖼️ Frame storage manager initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize frame storage: {e}")
            self.frame_storage = None
    
    async def analyze_frame(self, request: AnalysisRequest) -> Dict[str, Any]:
        """Analyze frame for violations"""
        try:
            # Convert request data to internal format
            detections = self._parse_detections(request.detections, request.frame_id, request.timestamp)
            rois = self._parse_rois(request.rois)

            # Debug logging
            detection_classes = [d.class_name for d in detections]
            logger.info(f"🔍 Frame {request.frame_id}: Found {len(detections)} detections: {detection_classes}")
            logger.info(f"🎯 Checking {len(rois)} ROI zones for violations")
            
            # Update worker tracking
            self._update_workers(detections, request.frame_id)
            
            # Detect violations
            violations = await self._detect_violations(detections, rois, request.frame_id)
            
            # Store frame data
            self.frame_buffer.append({
                "frame_id": request.frame_id,
                "timestamp": request.timestamp,
                "detections": detections,
                "violations": violations
            })
            
            return {
                "frame_id": request.frame_id,
                "timestamp": datetime.now().isoformat(),
                "violations": [v.model_dump() for v in violations],
                "worker_count": len(self.workers),
                "analysis_summary": {
                    "total_detections": len(detections),
                    "hands_detected": len([d for d in detections if d.class_name == "hand"]),
                    "scoopers_detected": len([d for d in detections if d.class_name == "scooper"]),
                    "persons_detected": len([d for d in detections if d.class_name == "person"]),
                    "violations_found": len(violations)
                }
            }
            
        except Exception as e:
            logger.error(f"Analysis error for frame {request.frame_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def analyze_frame_with_storage(self, request: AnalysisWithFrameRequest) -> Dict[str, Any]:
        """Analyze frame for violations with frame storage capability"""
        try:
            # Convert request data to internal format
            detections = self._parse_detections(request.detections, request.frame_id, request.timestamp)
            rois = self._parse_rois(request.rois)

            # Decode frame data if provided
            frame_data = None
            if request.frame_base64:
                frame_data = self._decode_frame_data(request.frame_base64)
                if frame_data is not None:
                    logger.info(f"🖼️ Frame data decoded: {frame_data.shape}")

            # Debug logging
            detection_classes = [d.class_name for d in detections]
            logger.info(f"🔍 Frame {request.frame_id}: Found {len(detections)} detections: {detection_classes}")
            logger.info(f"🎯 Checking {len(rois)} ROI zones for violations")

            # Update worker tracking
            self._update_workers(detections, request.frame_id)

            # Analyze violations
            violations = await self._detect_violations(detections, rois, request.frame_id)

            # Process violations with frame storage
            session_id = request.session_id or self.current_session_id or "default_session"
            stored_violations = []
            storage_results = {}

            for violation in violations:
                # Store violation frame if frame data is available
                storage_result = await self._store_violation_frame(frame_data, violation, session_id)
                storage_results.update(storage_result)

                # Update violation with storage info
                violation_dict = {
                    "violation_id": violation.violation_id,
                    "type": violation.violation_type.value,
                    "description": violation.description,
                    "confidence": violation.confidence,
                    "severity": violation.severity,
                    "roi_name": violation.roi_name,
                    "evidence": violation.evidence,
                    "frame_path": storage_result.get("frame_path"),
                    "frame_stored": bool(storage_result)
                }
                stored_violations.append(violation_dict)

            # Save violations to database with frame paths
            if violations:
                await self._save_violations_to_database_with_frames(violations, session_id, request.frame_id, storage_results)

            # Prepare response
            analysis_summary = {
                "total_detections": len(detections),
                "hands_detected": len([d for d in detections if d.class_name == "hand"]),
                "scoopers_detected": len([d for d in detections if d.class_name == "scooper"]),
                "persons_detected": len([d for d in detections if d.class_name == "person"]),
                "violations_found": len(violations),
                "frames_stored": len([v for v in stored_violations if v["frame_stored"]])
            }

            return {
                "frame_id": request.frame_id,
                "timestamp": request.timestamp,
                "violations": stored_violations,
                "worker_count": len(self.workers),
                "analysis_summary": analysis_summary,
                "session_id": session_id
            }

        except Exception as e:
            frame_id = getattr(request, 'frame_id', 'unknown') if 'request' in locals() else 'unknown'
            logger.error(f"Analysis error for frame {frame_id}: {e}")
            return {
                "frame_id": frame_id,
                "timestamp": datetime.now().isoformat(),
                "violations": [],
                "worker_count": 0,
                "analysis_summary": {"error": str(e)},
                "session_id": "error_session"
            }

    def _parse_detections(self, detection_data: List[Dict], frame_id: str, timestamp: str) -> List[Detection]:
        """Parse detection data into internal format"""
        detections = []
        for data in detection_data:
            # Handle None confidence values
            confidence = data.get("confidence", 0.0)
            if confidence is None:
                confidence = 0.0

            detection = Detection(
                class_name=data["class_name"],
                confidence=float(confidence),
                bbox=data["bbox"],
                center=data["center"],
                area=data["area"],
                frame_id=frame_id,
                timestamp=datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            )
            detections.append(detection)
        return detections
    
    def _parse_rois(self, roi_data: List[Dict]) -> List[ROI]:
        """Parse ROI data into internal format"""
        rois = []
        for data in roi_data:
            # Handle coordinates array format (common from frontend)
            coordinates = data.get("coordinates", [])
            x, y, width, height = None, None, None, None
            points = data.get("points")

            if coordinates and len(coordinates) >= 4:
                # Convert coordinates array to rectangle format
                # Assuming coordinates are [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                x_coords = [coord[0] for coord in coordinates]
                y_coords = [coord[1] for coord in coordinates]
                x = min(x_coords)
                y = min(y_coords)
                width = max(x_coords) - x
                height = max(y_coords) - y

                # Also create points for polygon checking
                points = [{"x": coord[0], "y": coord[1]} for coord in coordinates]

            roi = ROI(
                name=data["name"],
                shape=data.get("shape", "rectangle"),
                ingredient_type=data.get("ingredient_type", "unknown"),
                requires_scooper=data.get("requires_scooper", True),
                x=data.get("x", x),
                y=data.get("y", y),
                width=data.get("width", width),
                height=data.get("height", height),
                points=points or data.get("points")
            )
            rois.append(roi)

            # Debug logging
            logger.info(f"📦 Parsed ROI '{roi.name}': shape={roi.shape}, bounds=({roi.x}, {roi.y}, {roi.width}, {roi.height})")

        return rois
    
    def _update_workers(self, detections: List[Detection], frame_id: str):
        """Update worker tracking"""
        # Simple worker assignment based on person detections
        person_detections = [d for d in detections if d.class_name == "person"]
        
        # For each person, create or update worker tracker
        for i, person in enumerate(person_detections):
            worker_id = f"worker_{i}"
            
            if worker_id not in self.workers:
                self.workers[worker_id] = WorkerTracker(worker_id)
            
            # Find associated hand detections (simple proximity-based)
            associated_detections = self._find_associated_detections(person, detections)
            self.workers[worker_id].update(associated_detections, frame_id)
        
        # Clean up old workers
        current_time = datetime.now()
        inactive_workers = [
            worker_id for worker_id, worker in self.workers.items()
            if (current_time - worker.last_seen).total_seconds() > 30
        ]
        for worker_id in inactive_workers:
            del self.workers[worker_id]
    
    def _find_associated_detections(self, person: Detection, all_detections: List[Detection]) -> List[Detection]:
        """Find detections associated with a person"""
        associated = [person]
        
        # Find hands and scoopers near the person
        for detection in all_detections:
            if detection.class_name in ["hand", "scooper"]:
                distance = self._calculate_distance(person.center, detection.center)
                if distance < 200:  # Within 200 pixels
                    associated.append(detection)
        
        return associated
    
    async def _detect_violations(self, detections: List[Detection], rois: List[ROI], frame_id: str) -> List[ViolationEvent]:
        """Detect violations with enhanced multi-worker support"""
        violations = []

        # Get detections by type
        hands = [d for d in detections if d.class_name.lower() in ["hand", "hands"]]
        persons = [d for d in detections if d.class_name.lower() in ["person", "people"]]
        scoopers = [d for d in detections if d.class_name.lower() in ["scooper", "scoopers", "spoon", "utensil"]]

        logger.info(f"👥 Found {len(persons)} persons, {len(hands)} hands, {len(scoopers)} scoopers")

        # Associate hands with workers for multi-worker scenarios
        hand_worker_associations = self._associate_hands_with_workers(hands, persons)

        # Check each hand for violations
        for i, hand in enumerate(hands):
            # Get worker association for this hand
            associated_worker = hand_worker_associations.get(i)
            worker_info = f" (Worker {associated_worker})" if associated_worker else " (Unassigned)"

            logger.info(f"🔍 Checking hand {i+1}{worker_info} at ({hand.center.get('x', 0):.1f}, {hand.center.get('y', 0):.1f})")

            # Check if hand is in any ROI that requires scooper
            for roi in rois:
                is_in_roi = self._is_in_roi(hand, roi)
                logger.info(f"📍 Hand {i+1} ROI check: {'INSIDE' if is_in_roi else 'OUTSIDE'} ROI '{roi.name}' (requires_scooper: {roi.requires_scooper})")

                if roi.requires_scooper and is_in_roi:
                    # Generate unique hand ID for sequence tracking
                    hand_id = f"hand_{i}_worker_{associated_worker}" if associated_worker else f"hand_{i}"
                    sequence_key = f"{hand_id}_{roi.name}"

                    # Check if this is a NEW entry (hand entering ROI)
                    is_new_entry = sequence_key not in self.active_sequences

                    if is_new_entry:
                        logger.warning(f"🚪 FRAME {frame_id}: Hand {i+1}{worker_info} ENTERED ROI '{roi.name}' at position ({hand.center.get('x', 0):.1f}, {hand.center.get('y', 0):.1f})")
                        print(f"🚪 FRAME ENTRY: Hand {i+1}{worker_info} ENTERED ROI '{roi.name}' - SEQUENCE STARTS")
                    else:
                        logger.debug(f"👋 FRAME {frame_id}: Hand {i+1}{worker_info} continues in ROI '{roi.name}' - SEQUENCE CONTINUES")
                        print(f"📍 FRAME CONTINUE: Hand {i+1}{worker_info} still in ROI '{roi.name}' - SAME SEQUENCE")

                    # Check if hand is using scooper in this frame
                    is_using_scooper = self._is_hand_using_scooper_simple(hand, scoopers)
                    closest_scooper_distance = self._get_closest_scooper_distance(hand, scoopers)

                    # Log scooper usage status
                    scooper_status = "USING scooper" if is_using_scooper else "NOT using scooper"
                    logger.info(f"🔍 Hand {i+1}{worker_info} in ROI '{roi.name}': {scooper_status} (distance: {closest_scooper_distance:.1f}px)")

                    # SEQUENCE-BASED VIOLATION: ONE violation per complete entry-to-exit sequence
                    if is_new_entry:
                        # ONLY check violation on ENTRY - this ensures one violation per sequence
                        sequence_violation_needed = self._should_create_sequence_violation(
                            hand_id, roi.name, is_using_scooper
                        )

                        if sequence_violation_needed:
                            print(f"🚨 NEW WORK SESSION VIOLATION: Hand entered ROI '{roi.name}' without scooper!")
                            print(f"   This violation covers ENTIRE work session in this area")
                            print(f"   30-second cooldown prevents duplicate violations for same session")
                            logger.error(f"🚨 WORK SESSION VIOLATION: Hand {i+1}{worker_info} entered ROI '{roi.name}' without scooper!")

                            # Create ONE violation for the ENTIRE sequence (entry to exit)
                            try:
                                sequence_violation = self._create_violation(
                                    ViolationType.HAND_WITHOUT_SCOOPER,
                                    hand, roi, frame_id,
                                    f"Hand {i+1}{worker_info} in {roi.name} without scooper (complete sequence)",
                                    "high"
                                )
                                sequence_violation.worker_id = associated_worker
                                violations.append(sequence_violation)

                                print(f"✅ ONE SEQUENCE VIOLATION CREATED: {sequence_violation.id}")
                                print(f"   Covers: Frame {frame_id} (entry) → continuing frames → exit frame")
                                print(f"   No more violations will be created for this sequence")

                                # Mark this sequence as having a violation to prevent ANY duplicates
                                self._mark_sequence_as_violation(hand_id, roi.name, sequence_violation.id)

                                # Publish sequence violation
                                sequence_violation_data = {
                                    "frame_id": frame_id,
                                    "timestamp": datetime.now().isoformat(),
                                    "type": "complete_sequence_violation",
                                    "confidence": "high",
                                    "worker_id": associated_worker,
                                    "roi_name": roi.name,
                                    "hand_position": {"x": hand.center.get("x", 0), "y": hand.center.get("y", 0)},
                                    "detection_method": "one_violation_per_complete_sequence",
                                    "sequence_key": f"{hand_id}_{roi.name}",
                                    "sequence_description": "Entry → Continue → Exit as ONE violation"
                                }
                                await self._publish_violation_message(sequence_violation_data)

                            except Exception as e:
                                print(f"❌ Error creating sequence violation: {e}")
                                logger.error(f"❌ Error creating sequence violation: {e}")
                        else:
                            print(f"✅ SEQUENCE COMPLIANT: Hand entered ROI '{roi.name}' with scooper")
                            print(f"   No violation needed for this complete sequence")

                    # SEQUENCE TRACKING: Track hand from entry to exit
                    self._update_roi_sequence(
                        hand_id=hand_id,
                        roi_name=roi.name,
                        frame_id=frame_id,
                        hand_position=hand.center,
                        using_scooper=is_using_scooper,
                        scooper_distance=closest_scooper_distance,
                        worker_id=associated_worker
                    )

                else:
                    # Hand is NOT in ROI - check if we need to complete any sequences
                    hand_id = f"hand_{i}_worker_{associated_worker}" if associated_worker else f"hand_{i}"
                    sequence_key = f"{hand_id}_{roi.name}"

                    # Check if hand was previously in ROI (exiting)
                    if sequence_key in self.active_sequences:
                        # Check if this sequence had a violation
                        had_violation = sequence_key in self.sequence_violations
                        violation_status = "WITH VIOLATION" if had_violation else "NO VIOLATION"

                        logger.warning(f"🚪 FRAME {frame_id}: Hand {i+1}{worker_info} EXITED ROI '{roi.name}' at position ({hand.center.get('x', 0):.1f}, {hand.center.get('y', 0):.1f})")
                        print(f"🚪 FRAME EXIT: Hand {i+1}{worker_info} EXITED ROI '{roi.name}' - SEQUENCE ENDS")
                        print(f"📊 COMPLETE SEQUENCE: Entry → Continue → Exit = {violation_status}")

                        if had_violation:
                            violation_id = self.sequence_violations[sequence_key]
                            print(f"   ✅ This sequence already has violation: {violation_id}")
                            print(f"   ✅ ONE violation covers the ENTIRE sequence (as requested)")
                        else:
                            print(f"   ✅ This sequence was compliant - no violation needed")

                    self._check_sequence_completion(hand_id, roi.name, frame_id)

        # SIMPLIFIED SEQUENCE-BASED VIOLATION DETECTION
        # Violations are now created immediately when hand enters ROI without scooper
        # No need for complex sequence analysis - one violation per entry-to-exit sequence

        if violations:
            logger.info(f"🚨 Total violations found: {len(violations)} (simplified sequence-based detection)")

        # Save violations to database
        if violations:
            await self._save_violations_to_database(violations, frame_id)

        # Clean up old sequences and violation timestamps periodically
        self._cleanup_old_sequences()
        self._cleanup_old_violation_timestamps()

        return violations

    def _cleanup_old_sequences(self):
        """Clean up old completed sequences and stale active sequences"""
        current_time = datetime.now()

        # Clean up completed sequences (keep only last 50)
        if len(self.completed_sequences) > 50:
            self.completed_sequences = self.completed_sequences[-50:]

        # Clean up stale active sequences (older than 30 seconds)
        stale_sequences = []
        for sequence_key, sequence in self.active_sequences.items():
            if (current_time - sequence.entry_time).total_seconds() > 30:
                stale_sequences.append(sequence_key)

        for sequence_key in stale_sequences:
            logger.warning(f"🧹 Cleaning up stale sequence: {sequence_key}")
            del self.active_sequences[sequence_key]

    def _cleanup_old_violation_timestamps(self):
        """
        Clean up old violation timestamps (older than 60 seconds)
        This prevents memory buildup and allows fresh violations after work session ends
        """
        current_time = time.time()
        stale_timestamps = []

        for sequence_key, timestamp in self.violation_timestamps.items():
            if (current_time - timestamp) > 60.0:  # 60 seconds old (work session ended)
                stale_timestamps.append(sequence_key)

        for key in stale_timestamps:
            del self.violation_timestamps[key]
            logger.debug(f"🧹 Cleaned up old violation timestamp for: {key} (work session ended)")

    async def _save_violations_to_database(self, violations: List[ViolationEvent], frame_id: str) -> None:
        """Save violations to database"""
        try:
            # Extract session ID from frame_id (format: path_frame_timestamp)
            session_id = self._extract_session_id(frame_id)

            async with httpx.AsyncClient(timeout=10.0) as client:
                for violation in violations:
                    # Prepare violation data for database
                    violation_data = {
                        "session_id": session_id,
                        "worker_id": getattr(violation, 'worker_id', None),
                        "roi_zone_id": violation.roi_name,
                        "frame_number": self._extract_frame_number(frame_id),
                        "frame_path": self._extract_frame_path(frame_id),
                        "violation_type": violation.violation_type.value,
                        "confidence": violation.confidence,
                        "severity": violation.severity,
                        "description": violation.description,
                        "bounding_boxes": [violation.evidence.get("hand_bbox", {})],
                        "hand_position": violation.evidence.get("hand_center", {}),
                        "scooper_present": False,  # Will be enhanced later
                        "movement_pattern": getattr(violation, 'movement_pattern', None)
                    }

                    # Save to database
                    response = await client.post(
                        f"{self.database_url}/violations",
                        json=violation_data
                    )

                    if response.status_code == 200:
                        logger.info(f"✅ Violation saved to database: {violation.violation_id}")
                    else:
                        logger.error(f"❌ Failed to save violation to database: {response.status_code}")

        except Exception as e:
            logger.error(f"❌ Database save error: {e}")

    def _extract_session_id(self, frame_id: str) -> str:
        """Extract session ID from frame ID"""
        # Frame ID format: path_frame_timestamp
        parts = frame_id.split('_')
        if len(parts) >= 3:
            # Use video filename as session base
            video_path = parts[0]
            return f"session_{video_path.split('/')[-1].replace('.mp4', '')}"
        return "default_session"



    async def _save_violations_to_database_with_frames(self, violations: List[ViolationEvent],
                                                     session_id: str, frame_id: str,
                                                     storage_results: Dict[str, Any]):
        """Save violations to database with frame storage information"""
        if not violations:
            return

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for violation in violations:
                    # Prepare violation data for database with frame storage info
                    violation_data = {
                        "session_id": session_id,
                        "worker_id": getattr(violation, 'worker_id', None),
                        "roi_zone_id": violation.roi_name,
                        "frame_number": self._extract_frame_number(frame_id),
                        "frame_path": storage_results.get("frame_path"),
                        "frame_base64": storage_results.get("frame_base64"),
                        "violation_type": violation.violation_type.value,
                        "confidence": violation.confidence,
                        "severity": violation.severity,
                        "description": violation.description,
                        "bounding_boxes": [violation.evidence.get("hand_bbox", {})],
                        "hand_position": violation.evidence.get("hand_center", {}),
                        "scooper_present": False,  # Will be enhanced later
                        "movement_pattern": getattr(violation, 'movement_pattern', None)
                    }

                    # Save to database
                    response = await client.post(
                        f"{self.database_url}/violations",
                        json=violation_data
                    )

                    if response.status_code == 200:
                        logger.info(f"💾 Violation saved to database with frame: {violation.violation_id}")
                    else:
                        logger.error(f"❌ Failed to save violation: {response.status_code}")

        except Exception as e:
            logger.error(f"❌ Failed to save violations with frames to database: {e}")

    def _extract_frame_number(self, frame_id: str) -> int:
        """Extract frame number from frame ID"""
        parts = frame_id.split('_')
        if len(parts) >= 2:
            try:
                return int(parts[1])
            except ValueError:
                pass
        return 0

    def _extract_frame_path(self, frame_id: str) -> str:
        """Extract frame path from frame ID"""
        parts = frame_id.split('_')
        if len(parts) >= 1:
            return parts[0]
        return ""

    def _update_hand_tracking(self, hand_id: str, hand: Detection, roi_name: str = None) -> None:
        """Update hand tracking data for temporal sequence analysis"""
        if hand_id not in self.hand_trackers:
            self.hand_trackers[hand_id] = HandTracker(hand_id)

        # Add position with ROI context for temporal analysis
        x, y = hand.center.get("x", 0), hand.center.get("y", 0)
        self.hand_trackers[hand_id].add_position(x, y, roi_name)

        # Clean up stale trackers
        stale_trackers = [
            hid for hid, tracker in self.hand_trackers.items()
            if tracker.is_stale(10)
        ]
        for hid in stale_trackers:
            del self.hand_trackers[hid]

    def _analyze_hand_movement(self, hand_id: str) -> Dict[str, Any]:
        """Analyze hand movement pattern with temporal sequence analysis"""
        if hand_id not in self.hand_trackers:
            return {
                "action_type": ActionType.UNKNOWN,
                "confidence": 0.0,
                "total_movement": 0.0,
                "direction_changes": 0
            }

        tracker = self.hand_trackers[hand_id]

        # Get movement metrics from tracker
        total_movement = tracker.get_movement_distance()
        direction_changes = tracker.get_direction_changes()

        # Determine action type based on movement patterns
        action_type = self._classify_action_from_movement(total_movement, direction_changes, tracker)

        # Calculate confidence based on tracking history and movement consistency
        confidence = min(1.0, len(tracker.positions) / 5.0)  # More positions = higher confidence

        return {
            "action_type": action_type,
            "confidence": confidence,
            "total_movement": total_movement,
            "direction_changes": direction_changes,
            "sequence_analysis": self._analyze_temporal_sequence(tracker)
        }

    def _classify_action_from_movement(self, total_movement: float, direction_changes: int, tracker: HandTracker) -> ActionType:
        """Classify action type based on movement patterns and temporal sequence"""
        if len(tracker.positions) < 3:
            return ActionType.UNKNOWN

        # Analyze temporal sequence for better classification
        sequence_info = self._analyze_temporal_sequence(tracker)

        # Enhanced classification with temporal context
        avg_movement = total_movement / len(tracker.positions) if tracker.positions else 0

        # Check for ROI entry/exit patterns
        roi_pattern = sequence_info.get("roi_pattern", "none")

        # Cleaning: many direction changes, moderate movement, possibly in ROI
        if direction_changes >= 2 and 15 <= avg_movement <= 40:
            if roi_pattern == "cleaning_motion":
                return ActionType.CLEANING

        # Idle: very little movement
        elif avg_movement < 8:
            return ActionType.IDLE

        # Grabbing: significant movement with clear ROI entry/exit pattern
        elif avg_movement > 12 and roi_pattern in ["roi_entry", "roi_grab_exit"]:
            return ActionType.GRABBING

        # Moving: moderate movement without clear ROI interaction (classify as UNKNOWN for now)
        elif avg_movement > 8:
            return ActionType.UNKNOWN

        return ActionType.UNKNOWN

    def _analyze_temporal_sequence(self, tracker: HandTracker) -> Dict[str, Any]:
        """Analyze temporal sequence of hand movements for violation detection"""
        if len(tracker.positions) < 3:
            return {"roi_pattern": "none", "sequence_confidence": 0.0}

        # Analyze ROI entry/exit patterns
        roi_entries = tracker.roi_entries
        positions = tracker.positions
        timestamps = tracker.timestamps

        sequence_analysis = {
            "roi_pattern": "none",
            "sequence_confidence": 0.0,
            "roi_dwell_time": 0.0,
            "movement_consistency": 0.0
        }

        # Check for ROI interaction patterns
        if roi_entries:
            # Calculate time spent in ROI
            roi_start_time = None
            roi_end_time = None

            for i, timestamp in enumerate(timestamps):
                if i < len(roi_entries) and roi_entries[i]:
                    if roi_start_time is None:
                        roi_start_time = timestamp
                    roi_end_time = timestamp

            if roi_start_time and roi_end_time:
                dwell_time = (roi_end_time - roi_start_time).total_seconds()
                sequence_analysis["roi_dwell_time"] = dwell_time

                # Classify ROI interaction pattern
                if dwell_time > 2.0:  # Long dwell time suggests grabbing
                    sequence_analysis["roi_pattern"] = "roi_grab_exit"
                    sequence_analysis["sequence_confidence"] = 0.8
                elif dwell_time > 0.5:  # Medium dwell time
                    sequence_analysis["roi_pattern"] = "roi_entry"
                    sequence_analysis["sequence_confidence"] = 0.6
                else:  # Short dwell time might be cleaning
                    sequence_analysis["roi_pattern"] = "cleaning_motion"
                    sequence_analysis["sequence_confidence"] = 0.4

        # Calculate movement consistency
        if len(positions) >= 3:
            movements = []
            for i in range(1, len(positions)):
                x1, y1 = positions[i-1]
                x2, y2 = positions[i]
                movement = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
                movements.append(movement)

            if movements:
                avg_movement = sum(movements) / len(movements)
                movement_variance = sum((m - avg_movement) ** 2 for m in movements) / len(movements)
                consistency = 1.0 / (1.0 + movement_variance / 100.0)  # Normalize consistency
                sequence_analysis["movement_consistency"] = consistency

        return sequence_analysis

    def _decode_frame_data(self, frame_base64: str) -> Optional[np.ndarray]:
        """Decode base64 frame data to numpy array"""
        try:
            import base64
            # Remove data URL prefix if present
            if frame_base64.startswith('data:image'):
                frame_base64 = frame_base64.split(',')[1]

            # Decode base64
            frame_bytes = base64.b64decode(frame_base64)

            # Convert to numpy array
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            return frame

        except Exception as e:
            logger.error(f"❌ Failed to decode frame data: {e}")
            return None

    async def _store_violation_frame(self, frame_data: Optional[np.ndarray],
                                   violation: ViolationEvent, session_id: str) -> Dict[str, Any]:
        """Store violation frame with annotations"""
        if not self.frame_storage or frame_data is None:
            return {}

        try:
            # Prepare violation info for annotation
            violation_info = {
                "frame_id": violation.frame_id,
                "violation_type": violation.violation_type.value,
                "confidence": violation.confidence,
                "severity": violation.severity,
                "bounding_boxes": [violation.evidence.get("hand_bbox", {})],
                "roi_info": {
                    "name": violation.roi_name,
                    "roi_bounds": violation.evidence.get("roi_bounds", {})
                }
            }

            # Save frame with annotations
            storage_result = self.frame_storage.save_violation_frame(
                frame_data, violation_info, session_id
            )

            return storage_result

        except Exception as e:
            logger.error(f"❌ Failed to store violation frame: {e}")
            return {}

    async def _publish_violation_message(self, violation: Dict[str, Any]):
        """Publish violation message to message broker"""
        if not MESSAGE_BROKER_AVAILABLE or not hasattr(self, '_broker_config'):
            return

        try:
            # Initialize client if not already done
            if not self.message_broker_client:
                self.message_broker_client = MessageBrokerClient(self._broker_config)
                await self.message_broker_client.initialize()

            # Prepare violation message
            violation_message = {
                "violation_id": f"viol_{violation.get('frame_id', 'unknown')}_{datetime.now().timestamp()}",
                "frame_id": violation.get("frame_id"),
                "timestamp": violation.get("timestamp", datetime.now().isoformat()),
                "violation_type": violation.get("type", "unknown"),
                "severity": "high" if violation.get("confidence", 0) > 0.8 else "medium",
                "worker_id": violation.get("worker_id"),
                "roi_zone": violation.get("roi_name"),
                "confidence": violation.get("confidence", 0.0),
                "hand_position": violation.get("hand_position"),
                "scooper_present": violation.get("scooper_present", False),
                "details": {
                    "hand_id": violation.get("hand_id"),
                    "action_analysis": violation.get("action_analysis", {}),
                    "temporal_sequence": violation.get("temporal_sequence", {})
                }
            }

            # Publish violation message
            success = await self.message_broker_client.publish_message(
                MessageTypes.VIOLATION_DETECTED,
                violation_message,
                priority=5  # High priority for violations
            )

            if success:
                logger.info(f"📤 Published violation message for frame {violation.get('frame_id')}")
            else:
                logger.warning(f"⚠️ Failed to publish violation message for frame {violation.get('frame_id')}")

        except Exception as e:
            logger.error(f"❌ Error publishing violation message: {e}")

    def _associate_hands_with_workers(self, hands: List[Detection], persons: List[Detection]) -> Dict[int, int]:
        """Associate hands with workers based on proximity"""
        hand_worker_associations = {}

        if not persons:
            # No persons detected, can't associate hands
            logger.info("⚠️ No persons detected - hands cannot be associated with workers")
            return hand_worker_associations

        # For each hand, find the closest person
        for hand_idx, hand in enumerate(hands):
            min_distance = float('inf')
            closest_worker = None

            for person_idx, person in enumerate(persons):
                distance = self._calculate_distance(hand.center, person.center)

                # Only associate if hand is reasonably close to person (within 150 pixels)
                if distance < min_distance and distance < 150:
                    min_distance = distance
                    closest_worker = person_idx + 1  # Worker IDs start from 1

            if closest_worker is not None:
                hand_worker_associations[hand_idx] = closest_worker
                logger.info(f"🤝 Associated hand {hand_idx + 1} with worker {closest_worker} (distance: {min_distance:.1f})")
            else:
                logger.info(f"❓ Hand {hand_idx + 1} could not be associated with any worker")

        return hand_worker_associations

    def _check_scooper_availability(self, hand: Detection, scoopers: List[Detection], worker_id: Optional[int], persons: List[Detection]) -> bool:
        """
        Enhanced scooper availability check with temporal analysis
        Checks current frame AND recent frames to see if scooper was present
        """
        # Check current frame first
        current_frame_scooper = self._check_current_frame_scooper(hand, scoopers)
        if current_frame_scooper:
            return True

        # If no scooper in current frame, check recent frames
        recent_frame_scooper = self._check_recent_frames_scooper(hand, worker_id)
        if recent_frame_scooper:
            logger.info(f"✅ Scooper was present in recent frames for worker {worker_id}")
            return True

        return False

    def _check_current_frame_scooper(self, hand: Detection, scoopers: List[Detection]) -> bool:
        """
        Enhanced scooper check: Verify ACTIVE USAGE, not just proximity
        Checks if hand is actually holding/using the scooper, not just near it
        """
        if not scoopers:
            return False

        # Check each scooper for active usage
        for scooper in scoopers:
            is_actively_using = self._is_hand_actively_using_scooper(hand, scooper)
            if is_actively_using:
                return True

        return False

    def _is_hand_actively_using_scooper(self, hand: Detection, scooper: Detection) -> bool:
        """
        Professional detection of active scooper usage
        Analyzes spatial relationship, movement patterns, and temporal consistency
        """
        hand_center = hand.center
        scooper_center = scooper.center

        # Calculate distance between hand and scooper
        distance = self._calculate_distance(hand_center, scooper_center)

        # Stage 1: Proximity Check (must be very close for active usage)
        active_usage_threshold = 40  # Much closer than just "nearby" (was 100)
        if distance > active_usage_threshold:
            logger.debug(f"🔍 Scooper too far for active usage: {distance:.1f}px (threshold: {active_usage_threshold}px)")
            return False

        # Stage 2: Spatial Relationship Analysis
        spatial_score = self._analyze_hand_scooper_spatial_relationship(hand, scooper)

        # Stage 3: Movement Synchronization Check
        movement_sync_score = self._check_hand_scooper_movement_sync(hand, scooper)

        # Stage 4: Temporal Consistency (has hand been consistently near scooper?)
        temporal_score = self._check_scooper_usage_temporal_consistency(hand, scooper)

        # Combined scoring for active usage detection
        total_score = (spatial_score * 0.4) + (movement_sync_score * 0.4) + (temporal_score * 0.2)
        usage_threshold = 0.6  # 60% confidence required for active usage

        is_using = total_score >= usage_threshold

        if is_using:
            logger.info(f"✅ ACTIVE SCOOPER USAGE detected: distance={distance:.1f}px, spatial={spatial_score:.2f}, movement={movement_sync_score:.2f}, temporal={temporal_score:.2f}, total={total_score:.2f}")
        else:
            logger.warning(f"⚠️ Scooper nearby but NOT actively used: distance={distance:.1f}px, spatial={spatial_score:.2f}, movement={movement_sync_score:.2f}, temporal={temporal_score:.2f}, total={total_score:.2f}")

        return is_using

    def _check_recent_frames_scooper(self, hand: Detection) -> bool:
        """
        Check if scooper was present in recent frames for this worker/hand area
        This helps catch cases where hand briefly obscures scooper or scooper moves slightly
        """
        if not self.frame_buffer:
            return False

        # Look at last 5 frames (about 0.5-1 second at 5-10 FPS)
        recent_frames = list(self.frame_buffer)[-5:]
        scooper_found_in_recent = False

        for frame_data in recent_frames:
            frame_detections = frame_data.get("detections", [])
            frame_scoopers = [d for d in frame_detections if d.class_name.lower() in ["scooper", "scoopers", "spoon", "utensil"]]

            if frame_scoopers:
                # Check if any scooper was near the hand area in recent frames
                for scooper in frame_scoopers:
                    distance = self._calculate_distance(hand.center, scooper.center)
                    # Use slightly larger threshold for recent frames (allows for movement)
                    if distance < (self.config.scooper_proximity_threshold * 1.5):
                        scooper_found_in_recent = True
                        logger.info(f"🕐 Scooper found in recent frame near hand area (distance: {distance:.1f})")
                        break

            if scooper_found_in_recent:
                break

        return scooper_found_in_recent

    def _is_hand_touching_food(self, hand: Detection, roi: ROI, movement_analysis: Dict[str, Any]) -> bool:
        """
        Enhanced detection for when hand is actively touching/grabbing food
        Combines spatial analysis (hand position in ROI) with temporal movement patterns
        """
        # Check if hand is deep inside the ROI (not just at edge)
        hand_center_x = hand.center.get('x', 0)
        hand_center_y = hand.center.get('y', 0)

        # Calculate how deep the hand is inside the ROI
        roi_depth_factor = self._calculate_roi_depth_factor(hand_center_x, hand_center_y, roi)

        # Hand is considered "touching food" if:
        # 1. It's significantly inside the ROI (not just at edge)
        # 2. Movement pattern suggests interaction (not just passing through)
        # 3. Hand has been in ROI for multiple frames (temporal consistency)

        is_deep_in_roi = roi_depth_factor > 0.3  # At least 30% into ROI
        has_interaction_movement = movement_analysis.get("direction_changes", 0) > 1
        has_temporal_consistency = movement_analysis.get("sequence_analysis", {}).get("roi_pattern") != "passing_through"

        # Additional check: Look for grabbing-like movement patterns
        total_movement = movement_analysis.get("total_movement", 0)
        is_active_movement = total_movement > 10  # Some movement but not excessive

        touching_food = (
            is_deep_in_roi and
            (has_interaction_movement or has_temporal_consistency) and
            is_active_movement
        )

        if touching_food:
            logger.info(f"🤏 Hand appears to be touching food: depth={roi_depth_factor:.2f}, movement={total_movement:.1f}, changes={movement_analysis.get('direction_changes', 0)}")

        return touching_food

    def _calculate_roi_depth_factor(self, x: float, y: float, roi: ROI) -> float:
        """
        Calculate how deep a point is inside an ROI (0.0 = at edge, 1.0 = at center)
        """
        try:
            if roi.shape == "rectangle" and roi.x is not None and roi.y is not None:
                # For rectangle, calculate distance from edges
                roi_center_x = roi.x + (roi.width or 0) / 2
                roi_center_y = roi.y + (roi.height or 0) / 2

                # Distance from center as fraction of ROI size
                dx = abs(x - roi_center_x) / ((roi.width or 1) / 2)
                dy = abs(y - roi_center_y) / ((roi.height or 1) / 2)

                # Depth factor (1.0 at center, 0.0 at edge)
                depth_factor = max(0.0, 1.0 - max(dx, dy))
                return depth_factor

            elif roi.shape == "polygon" and roi.points:
                # For polygon, calculate distance from centroid
                points = roi.points
                if len(points) >= 3:
                    # Calculate centroid
                    centroid_x = sum(p.get('x', 0) for p in points) / len(points)
                    centroid_y = sum(p.get('y', 0) for p in points) / len(points)

                    # Calculate average distance from centroid to vertices
                    avg_radius = sum(
                        ((p.get('x', 0) - centroid_x)**2 + (p.get('y', 0) - centroid_y)**2)**0.5
                        for p in points
                    ) / len(points)

                    # Distance from point to centroid
                    point_distance = ((x - centroid_x)**2 + (y - centroid_y)**2)**0.5

                    # Depth factor
                    depth_factor = max(0.0, 1.0 - (point_distance / avg_radius))
                    return depth_factor

        except Exception as e:
            logger.warning(f"Error calculating ROI depth factor: {e}")

        return 0.5  # Default moderate depth if calculation fails

    def _analyze_hand_scooper_spatial_relationship(self, hand: Detection, scooper: Detection) -> float:
        """
        Analyze spatial relationship between hand and scooper to detect active holding
        Returns score 0.0-1.0 indicating likelihood of active usage
        """
        try:
            hand_center = hand.center
            scooper_center = scooper.center

            # Get bounding boxes for more detailed analysis
            hand_bbox = hand.bbox
            scooper_bbox = scooper.bbox

            # Calculate overlap between hand and scooper bounding boxes
            overlap_score = self._calculate_bbox_overlap(hand_bbox, scooper_bbox)

            # Analyze relative positions (scooper should be in front of/extension of hand)
            position_score = self._analyze_hand_scooper_position(hand_center, scooper_center, hand_bbox, scooper_bbox)

            # Size relationship analysis (scooper should be proportional to hand)
            size_score = self._analyze_hand_scooper_size_relationship(hand_bbox, scooper_bbox)

            # Combined spatial score
            spatial_score = (overlap_score * 0.5) + (position_score * 0.3) + (size_score * 0.2)

            logger.debug(f"🔍 Spatial analysis: overlap={overlap_score:.2f}, position={position_score:.2f}, size={size_score:.2f}, total={spatial_score:.2f}")

            return min(1.0, max(0.0, spatial_score))

        except Exception as e:
            logger.warning(f"Error in spatial relationship analysis: {e}")
            return 0.0

    def _calculate_bbox_overlap(self, bbox1: Dict, bbox2: Dict) -> float:
        """Calculate overlap ratio between two bounding boxes"""
        try:
            # Extract coordinates
            x1_1, y1_1 = bbox1.get('x', 0), bbox1.get('y', 0)
            w1, h1 = bbox1.get('width', 0), bbox1.get('height', 0)
            x2_1, y2_1 = x1_1 + w1, y1_1 + h1

            x1_2, y1_2 = bbox2.get('x', 0), bbox2.get('y', 0)
            w2, h2 = bbox2.get('width', 0), bbox2.get('height', 0)
            x2_2, y2_2 = x1_2 + w2, y1_2 + h2

            # Calculate intersection
            x_left = max(x1_1, x1_2)
            y_top = max(y1_1, y1_2)
            x_right = min(x2_1, x2_2)
            y_bottom = min(y2_1, y2_2)

            if x_right < x_left or y_bottom < y_top:
                return 0.0  # No overlap

            # Calculate areas
            intersection_area = (x_right - x_left) * (y_bottom - y_top)
            bbox1_area = w1 * h1
            bbox2_area = w2 * h2
            union_area = bbox1_area + bbox2_area - intersection_area

            if union_area == 0:
                return 0.0

            # IoU (Intersection over Union)
            overlap_ratio = intersection_area / union_area
            return overlap_ratio

        except Exception as e:
            logger.warning(f"Error calculating bbox overlap: {e}")
            return 0.0

    def _analyze_hand_scooper_position(self, hand_center: Dict, scooper_center: Dict) -> float:
        """
        Analyze relative position of hand and scooper
        Scooper should be positioned as extension of hand (in front, not beside)
        """
        try:
            hand_x, hand_y = hand_center.get('x', 0), hand_center.get('y', 0)
            scooper_x, scooper_y = scooper_center.get('x', 0), scooper_center.get('y', 0)

            # Calculate relative position vector
            dx = scooper_x - hand_x
            dy = scooper_y - hand_y

            # Distance between centers
            distance = (dx**2 + dy**2)**0.5

            if distance == 0:
                return 1.0  # Perfect overlap

            # Analyze angle relationship
            # Scooper should be in "forward" direction from hand (not sideways)
            angle = abs(math.atan2(dy, dx))

            # Prefer angles that suggest scooper is extension of hand
            # 0° (right), 90° (down), 180° (left), 270° (up) are good
            angle_score = 1.0 - (min(angle, math.pi - angle) / (math.pi / 2))

            # Distance score (closer is better for active usage)
            distance_score = max(0.0, 1.0 - (distance / 60))  # 60px max for good score

            position_score = (angle_score * 0.6) + (distance_score * 0.4)

            return position_score

        except Exception as e:
            logger.warning(f"Error analyzing hand-scooper position: {e}")
            return 0.0

    def _analyze_hand_scooper_size_relationship(self, hand_bbox: Dict, scooper_bbox: Dict) -> float:
        """
        Analyze size relationship between hand and scooper
        Scooper should be reasonable size relative to hand
        """
        try:
            hand_area = hand_bbox.get('width', 0) * hand_bbox.get('height', 0)
            scooper_area = scooper_bbox.get('width', 0) * scooper_bbox.get('height', 0)

            if hand_area == 0 or scooper_area == 0:
                return 0.0

            # Calculate size ratio
            size_ratio = scooper_area / hand_area

            # Ideal ratio: scooper should be 20%-80% of hand size
            if 0.2 <= size_ratio <= 0.8:
                return 1.0  # Perfect size relationship
            elif 0.1 <= size_ratio <= 1.2:
                return 0.7  # Acceptable size relationship
            elif 0.05 <= size_ratio <= 2.0:
                return 0.4  # Questionable but possible
            else:
                return 0.0  # Unrealistic size relationship

        except Exception as e:
            logger.warning(f"Error analyzing size relationship: {e}")
            return 0.0

    def _check_hand_scooper_movement_sync(self, hand: Detection, scooper: Detection) -> float:
        """
        Check if hand and scooper are moving together (synchronized movement)
        This indicates active holding/usage rather than just proximity
        """
        try:
            # Get recent movement data from frame buffer
            if len(self.frame_buffer) < 3:
                return 0.5  # Not enough data, neutral score

            recent_frames = list(self.frame_buffer)[-5:]  # Last 5 frames
            hand_movements = []
            scooper_movements = []

            # Track hand and scooper positions across recent frames
            for i, frame_data in enumerate(recent_frames):
                frame_detections = frame_data.get("detections", [])

                # Find similar hand and scooper in this frame
                frame_hand = self._find_similar_detection(hand, frame_detections, "hand")
                frame_scooper = self._find_similar_detection(scooper, frame_detections, "scooper")

                if frame_hand and frame_scooper:
                    hand_movements.append(frame_hand.center)
                    scooper_movements.append(frame_scooper.center)

            if len(hand_movements) < 2 or len(scooper_movements) < 2:
                return 0.5  # Not enough movement data

            # Calculate movement vectors for hand and scooper
            hand_vectors = []
            scooper_vectors = []

            for i in range(1, len(hand_movements)):
                hand_dx = hand_movements[i].get('x', 0) - hand_movements[i-1].get('x', 0)
                hand_dy = hand_movements[i].get('y', 0) - hand_movements[i-1].get('y', 0)
                hand_vectors.append((hand_dx, hand_dy))

                scooper_dx = scooper_movements[i].get('x', 0) - scooper_movements[i-1].get('x', 0)
                scooper_dy = scooper_movements[i].get('y', 0) - scooper_movements[i-1].get('y', 0)
                scooper_vectors.append((scooper_dx, scooper_dy))

            # Calculate movement synchronization score
            sync_scores = []
            for hand_vec, scooper_vec in zip(hand_vectors, scooper_vectors):
                # Calculate similarity of movement vectors
                hand_mag = (hand_vec[0]**2 + hand_vec[1]**2)**0.5
                scooper_mag = (scooper_vec[0]**2 + scooper_vec[1]**2)**0.5

                if hand_mag == 0 and scooper_mag == 0:
                    sync_scores.append(1.0)  # Both stationary
                elif hand_mag == 0 or scooper_mag == 0:
                    sync_scores.append(0.0)  # One moving, one not
                else:
                    # Calculate cosine similarity of movement directions
                    dot_product = hand_vec[0] * scooper_vec[0] + hand_vec[1] * scooper_vec[1]
                    cosine_sim = dot_product / (hand_mag * scooper_mag)

                    # Convert to 0-1 score (1 = same direction, 0 = opposite)
                    direction_score = (cosine_sim + 1) / 2

                    # Also consider magnitude similarity
                    mag_ratio = min(hand_mag, scooper_mag) / max(hand_mag, scooper_mag)

                    # Combined synchronization score
                    sync_score = (direction_score * 0.7) + (mag_ratio * 0.3)
                    sync_scores.append(sync_score)

            # Average synchronization across all movement vectors
            avg_sync = sum(sync_scores) / len(sync_scores) if sync_scores else 0.0

            logger.debug(f"🔄 Movement sync analysis: {len(sync_scores)} vectors, avg_sync={avg_sync:.2f}")

            return avg_sync

        except Exception as e:
            logger.warning(f"Error checking movement synchronization: {e}")
            return 0.0

    def _check_scooper_usage_temporal_consistency(self, hand: Detection, scooper: Detection) -> float:
        """
        Check temporal consistency of hand-scooper relationship
        Active usage should show consistent proximity over time
        """
        try:
            if len(self.frame_buffer) < 3:
                return 0.5  # Not enough temporal data

            recent_frames = list(self.frame_buffer)[-10:]  # Last 10 frames
            proximity_scores = []

            for frame_data in recent_frames:
                frame_detections = frame_data.get("detections", [])

                # Find similar hand and scooper in this frame
                frame_hand = self._find_similar_detection(hand, frame_detections, "hand")
                frame_scooper = self._find_similar_detection(scooper, frame_detections, "scooper")

                if frame_hand and frame_scooper:
                    distance = self._calculate_distance(frame_hand.center, frame_scooper.center)
                    # Score based on proximity (closer = higher score)
                    proximity_score = max(0.0, 1.0 - (distance / 60))  # 60px threshold
                    proximity_scores.append(proximity_score)

            if not proximity_scores:
                return 0.0

            # Calculate consistency metrics
            avg_proximity = sum(proximity_scores) / len(proximity_scores)

            # Calculate stability (low variance = more consistent)
            if len(proximity_scores) > 1:
                variance = sum((score - avg_proximity)**2 for score in proximity_scores) / len(proximity_scores)
                stability_score = max(0.0, 1.0 - variance)
            else:
                stability_score = 1.0

            # Combined temporal score
            temporal_score = (avg_proximity * 0.7) + (stability_score * 0.3)

            logger.debug(f"⏱️ Temporal consistency: {len(proximity_scores)} frames, avg_prox={avg_proximity:.2f}, stability={stability_score:.2f}, total={temporal_score:.2f}")

            return temporal_score

        except Exception as e:
            logger.warning(f"Error checking temporal consistency: {e}")
            return 0.0

    def _find_similar_detection(self, target_detection: Detection, frame_detections: List[Detection], detection_type: str) -> Optional[Detection]:
        """
        Find detection in frame that's most similar to target detection
        Used for tracking objects across frames
        """
        try:
            candidates = [d for d in frame_detections if detection_type.lower() in d.class_name.lower()]

            if not candidates:
                return None

            # Find closest detection by center position
            target_center = target_detection.center
            min_distance = float('inf')
            best_match = None

            for candidate in candidates:
                distance = self._calculate_distance(target_center, candidate.center)
                if distance < min_distance:
                    min_distance = distance
                    best_match = candidate

            # Only return if reasonably close (within 100px movement between frames)
            if min_distance < 100:
                return best_match

            return None

        except Exception as e:
            logger.warning(f"Error finding similar detection: {e}")
            return None

    def _comprehensive_scooper_analysis(self, hand: Detection, scoopers: List[Detection]) -> Dict[str, Any]:
        """
        Comprehensive two-tier scooper analysis
        Returns detailed analysis for professional violation decision making
        """
        analysis = {
            "scoopers_detected": len(scoopers),
            "closest_scooper_distance": None,
            "active_usage_detected": False,
            "active_usage_score": 0.0,
            "nearby_scooper_detected": False,
            "analysis_method": "comprehensive",
            "decision_factors": []
        }

        if not scoopers:
            analysis["decision_factors"].append("no_scoopers_detected")
            return analysis

        # Find closest scooper
        closest_distance = float('inf')
        closest_scooper = None

        for scooper in scoopers:
            distance = self._calculate_distance(hand.center, scooper.center)
            if distance < closest_distance:
                closest_distance = distance
                closest_scooper = scooper

        analysis["closest_scooper_distance"] = closest_distance

        # Tier 1: Check for active usage (strict)
        if closest_scooper:
            is_actively_using = self._is_hand_actively_using_scooper(hand, closest_scooper)
            analysis["active_usage_detected"] = is_actively_using

            if is_actively_using:
                analysis["decision_factors"].append("active_scooper_usage_confirmed")
                return analysis

        # Tier 2: Check for nearby scooper (lenient fallback)
        nearby_threshold = self.config.scooper_proximity_threshold  # 100px default
        if closest_distance < nearby_threshold:
            analysis["nearby_scooper_detected"] = True
            analysis["decision_factors"].append(f"scooper_nearby_{closest_distance:.1f}px")
        else:
            analysis["decision_factors"].append(f"no_scooper_within_{nearby_threshold}px")

        return analysis

    def _make_violation_decision(self, hand: Detection, roi: ROI, scooper_analysis: Dict, movement_analysis: Dict, hand_index: int, worker_info: str) -> Dict[str, Any]:
        """
        Professional violation decision making with two-tier logic

        TIER 1 (Strict): Active scooper usage required
        TIER 2 (Fallback): Nearby scooper acceptable
        """
        decision = {
            "trigger_violation": False,
            "violation_type": None,
            "violation_reason": None,
            "confidence_level": "low",
            "decision_tier": None
        }

        # Check if hand is actually interacting with food (not just passing through)
        is_touching_food = self._is_hand_touching_food(hand, roi, movement_analysis)
        is_grabbing = movement_analysis["action_type"] == ActionType.GRABBING
        is_likely_interaction = movement_analysis["confidence"] > 0.2

        # Only proceed if hand is actually interacting with food
        if not (is_touching_food or is_grabbing or is_likely_interaction):
            logger.info(f"👋 Hand {hand_index+1}{worker_info} in ROI but not interacting with food - no violation")
            decision["violation_reason"] = "hand_not_interacting_with_food"
            return decision

        # TIER 1: Strict Active Usage Check (Professional Standard)
        if scooper_analysis["active_usage_detected"]:
            logger.info(f"✅ Hand {hand_index+1}{worker_info} actively using scooper - NO VIOLATION")
            decision["violation_reason"] = "active_scooper_usage_confirmed"
            decision["decision_tier"] = "tier1_strict"
            return decision

        # TIER 2: Fallback Nearby Scooper Check (Lenient)
        if scooper_analysis["nearby_scooper_detected"]:
            # Configurable: Allow nearby scooper as acceptable?
            allow_nearby_fallback = os.getenv("ALLOW_NEARBY_SCOOPER_FALLBACK", "true").lower() == "true"

            if allow_nearby_fallback:
                logger.info(f"⚠️ Hand {hand_index+1}{worker_info} has nearby scooper (fallback) - NO VIOLATION")
                decision["violation_reason"] = "nearby_scooper_fallback_accepted"
                decision["decision_tier"] = "tier2_fallback"
                return decision
            else:
                logger.warning(f"🚨 Hand {hand_index+1}{worker_info} has nearby scooper but not actively using - VIOLATION (strict mode)")
                decision["trigger_violation"] = True
                decision["violation_type"] = "scooper_nearby_but_not_used"
                decision["violation_reason"] = "strict_mode_requires_active_usage"
                decision["confidence_level"] = "medium"
                decision["decision_tier"] = "tier1_strict"
                return decision

        # NO SCOOPER DETECTED: Clear violation
        logger.warning(f"🚨 Hand {hand_index+1}{worker_info} in ROI with no scooper - VIOLATION")
        decision["trigger_violation"] = True
        decision["violation_type"] = "no_scooper_detected"
        decision["violation_reason"] = "no_scooper_within_proximity"
        decision["confidence_level"] = "high"
        decision["decision_tier"] = "tier2_fallback"

        return decision

    def _create_violation_description(self, violation_decision: Dict, worker_id: Optional[int], roi_name: str, scooper_analysis: Dict) -> str:
        """
        Create professional violation description based on decision analysis
        """
        worker_prefix = f"Worker {worker_id}" if worker_id else "Hand"

        if violation_decision["violation_type"] == "no_scooper_detected":
            return (
                f"{worker_prefix} touching food in {roi_name} without scooper - "
                f"No scooper detected within {self.config.scooper_proximity_threshold}px "
                f"(Decision: {violation_decision['decision_tier']})"
            )

        elif violation_decision["violation_type"] == "scooper_nearby_but_not_used":
            distance = scooper_analysis.get("closest_scooper_distance", "unknown")
            return (
                f"{worker_prefix} touching food in {roi_name} without actively using scooper - "
                f"Scooper nearby ({distance:.1f}px) but not being held/used properly "
                f"(Decision: {violation_decision['decision_tier']}, Strict mode enabled)"
            )

        else:
            # Generic fallback
            return (
                f"{worker_prefix} touching food in {roi_name} with improper scooper usage - "
                f"Professional analysis detected violation "
                f"(Decision: {violation_decision.get('decision_tier', 'unknown')})"
            )

    def _is_in_roi(self, detection: Detection, roi: ROI) -> bool:
        """Check if detection overlaps with ROI"""
        try:
            if not detection.bbox:
                return False

            # Get detection center point
            det_center_x = detection.center.get("x", 0)
            det_center_y = detection.center.get("y", 0)

            if roi.shape == "rectangle" and roi.x is not None and roi.y is not None:
                # Rectangle ROI - check if detection center is inside
                return (roi.x <= det_center_x <= roi.x + (roi.width or 0) and
                        roi.y <= det_center_y <= roi.y + (roi.height or 0))

            elif roi.shape == "polygon" and roi.points:
                # Polygon ROI - use point-in-polygon algorithm
                return self._point_in_polygon(det_center_x, det_center_y, roi.points)

            return False
        except Exception as e:
            logger.warning(f"Error checking ROI overlap: {e}")
            return False

    def _point_in_polygon(self, x: float, y: float, points: List[Dict[str, float]]) -> bool:
        """Check if point is inside polygon using ray casting algorithm"""
        try:
            n = len(points)
            inside = False

            p1x, p1y = points[0]["x"], points[0]["y"]
            for i in range(1, n + 1):
                p2x, p2y = points[i % n]["x"], points[i % n]["y"]
                if y > min(p1y, p2y):
                    if y <= max(p1y, p2y):
                        if x <= max(p1x, p2x):
                            if p1y != p2y:
                                xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                            if p1x == p2x or x <= xinters:
                                inside = not inside
                p1x, p1y = p2x, p2y

            return inside
        except Exception as e:
            logger.warning(f"Error in point-in-polygon calculation: {e}")
            return False
    
    def _find_worker_for_hand(self, hand: Detection) -> Optional[WorkerTracker]:
        """Find which worker this hand belongs to"""
        # Simple approach: find closest worker
        min_distance = float('inf')
        closest_worker = None
        
        for worker in self.workers.values():
            hand_pos = worker.get_current_hand_position()
            if hand_pos:
                distance = self._calculate_distance(hand.center, hand_pos)
                if distance < min_distance:
                    min_distance = distance
                    closest_worker = worker
        
        return closest_worker if min_distance < 100 else None
    
    def _calculate_distance(self, pos1: Dict[str, float], pos2: Dict[str, float]) -> float:
        """Calculate Euclidean distance between two positions"""
        try:
            x1 = pos1.get("x", 0) or 0
            y1 = pos1.get("y", 0) or 0
            x2 = pos2.get("x", 0) or 0
            y2 = pos2.get("y", 0) or 0
            return ((x1 - x2)**2 + (y1 - y2)**2)**0.5
        except Exception as e:
            logger.warning(f"Error calculating distance: {e}")
            return float('inf')
    
    def _create_violation(self, violation_type: ViolationType, hand: Detection, roi: ROI, 
                         frame_id: str, description: str, severity: str) -> ViolationEvent:
        """Create a violation event"""
        self.violation_count += 1
        
        return ViolationEvent(
            violation_id=f"violation_{self.violation_count}_{frame_id}",
            frame_id=frame_id,
            timestamp=datetime.now().isoformat(),
            violation_type=violation_type,
            description=description,
            confidence=hand.confidence,
            evidence={
                "hand_bbox": hand.bbox,
                "hand_center": hand.center,
                "roi_name": roi.name,
                "roi_bounds": {
                    "x": roi.x, "y": roi.y,
                    "width": roi.width, "height": roi.height
                },
                "ingredient_type": roi.ingredient_type
            },
            roi_name=roi.name,
            severity=severity
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get violation detection statistics"""
        return {
            "total_violations": self.violation_count,
            "active_workers": len(self.workers),
            "frames_processed": len(self.frame_buffer),
            "worker_details": {
                worker_id: {
                    "current_action": worker.current_action.value,
                    "violations": len(worker.violations),
                    "last_seen": worker.last_seen.isoformat()
                }
                for worker_id, worker in self.workers.items()
            }
        }

    def _is_hand_using_scooper_simple(self, hand: Detection, scoopers: List[Detection]) -> bool:
        """
        SIMPLE DIRECT CHECK: Is the hand using a scooper?

        Scenario: Hand enters ROI → Check if using scooper → VIOLATION if not

        Logic:
        1. No scoopers detected → NOT using scooper → VIOLATION
        2. Scooper very close (≤50px) → USING scooper → NO VIOLATION
        3. Scooper nearby (50-100px) → Check fallback setting
        4. Scooper far (>100px) → NOT using scooper → VIOLATION
        """
        if not scoopers:
            logger.warning(f"❌ No scoopers detected - VIOLATION")
            return False

        # Find closest scooper to hand
        closest_distance = float('inf')
        for scooper in scoopers:
            distance = self._calculate_distance(hand.center, scooper.center)
            if distance < closest_distance:
                closest_distance = distance

        logger.info(f"📏 Closest scooper distance: {closest_distance:.1f}px")

        # TIER 1: Very close = actively using (strict)
        if closest_distance <= 50:
            logger.info(f"✅ Hand USING scooper (close: {closest_distance:.1f}px) - NO VIOLATION")
            return True

        # TIER 2: Nearby = check if fallback allowed (configurable)
        elif closest_distance <= 100:
            allow_nearby = os.getenv("ALLOW_NEARBY_SCOOPER_FALLBACK", "true").lower() == "true"
            if allow_nearby:
                logger.info(f"✅ Hand USING scooper (nearby fallback: {closest_distance:.1f}px) - NO VIOLATION")
                return True
            else:
                logger.warning(f"❌ Hand NOT using scooper (nearby but strict mode: {closest_distance:.1f}px) - VIOLATION")
                return False

        # TIER 3: Far away = not using
        else:
            logger.warning(f"❌ Hand NOT using scooper (too far: {closest_distance:.1f}px) - VIOLATION")
            return False

    def _get_closest_scooper_distance(self, hand: Detection, scoopers: List[Detection]) -> float:
        """Get distance to closest scooper"""
        if not scoopers:
            return float('inf')

        closest_distance = float('inf')
        for scooper in scoopers:
            distance = self._calculate_distance(hand.center, scooper.center)
            if distance < closest_distance:
                closest_distance = distance

        return closest_distance

    def _update_roi_sequence(self, hand_id: str, roi_name: str, frame_id: str,
                           hand_position: Dict[str, float], using_scooper: bool,
                           scooper_distance: float, worker_id: Optional[int]):
        """
        Update or create ROI sequence for hand tracking
        Tracks complete sequence from entry to exit
        """
        sequence_key = f"{hand_id}_{roi_name}"

        # Check if sequence already exists
        if sequence_key in self.active_sequences:
            # Add frame to existing sequence
            sequence = self.active_sequences[sequence_key]
            sequence.add_frame(frame_id, hand_position, using_scooper, scooper_distance)
            logger.debug(f"📝 Added frame to sequence {sequence_key}: scooper_used={using_scooper}, distance={scooper_distance:.1f}px")
        else:
            # Create new sequence (hand entering ROI)
            self.sequence_counter += 1
            sequence = ROISequence(
                sequence_id=f"seq_{self.sequence_counter}",
                hand_id=hand_id,
                roi_name=roi_name,
                worker_id=worker_id,
                entry_frame=frame_id
            )
            sequence.add_frame(frame_id, hand_position, using_scooper, scooper_distance)
            self.active_sequences[sequence_key] = sequence
            logger.warning(f"🚀 NEW SEQUENCE started: {sequence_key} in frame {frame_id}")
            print(f"🚀 NEW SEQUENCE started: {sequence_key} - Worker {worker_id} in ROI '{roi_name}'")

    def _check_sequence_completion(self, hand_id: str, roi_name: str, frame_id: str):
        """
        Check if hand has exited ROI and complete sequence
        """
        sequence_key = f"{hand_id}_{roi_name}"

        if sequence_key in self.active_sequences:
            # Hand has exited ROI - complete the sequence
            sequence = self.active_sequences[sequence_key]
            sequence.complete_sequence(frame_id)

            # Move to completed sequences
            self.completed_sequences.append(sequence)
            del self.active_sequences[sequence_key]

            # Clean up violation tracking for this sequence
            if sequence_key in self.sequence_violations:
                violation_id = self.sequence_violations[sequence_key]
                logger.info(f"🧹 Sequence {sequence_key} completed, had violation: {violation_id}")
                del self.sequence_violations[sequence_key]

            # Clean up violation timestamp tracking
            if sequence_key in self.violation_timestamps:
                logger.info(f"🧹 Cleaning up violation timestamp for {sequence_key}")
                del self.violation_timestamps[sequence_key]

            duration = sequence.get_sequence_duration()
            usage_percentage = sequence.get_scooper_usage_percentage()

            logger.warning(f"🏁 SEQUENCE COMPLETED: {sequence_key}")
            logger.warning(f"   Duration: {duration:.1f}s, Frames: {len(sequence.frames_in_roi)}")
            logger.warning(f"   Scooper usage: {usage_percentage:.1f}% of frames")
            logger.warning(f"   Proper usage: {'YES' if sequence.was_scooper_used_properly() else 'NO'}")

            print(f"🏁 SEQUENCE COMPLETED: {sequence_key}")
            print(f"   Duration: {duration:.1f}s, Frames: {len(sequence.frames_in_roi)}")
            print(f"   Scooper usage: {usage_percentage:.1f}% of frames")
            print(f"   Proper usage: {'YES' if sequence.was_scooper_used_properly() else 'NO'}")

            if not sequence.was_scooper_used_properly():
                print(f"⚠️ POTENTIAL VIOLATION: Scooper usage {usage_percentage:.1f}% < 70% threshold")



    def _should_create_sequence_violation(self, hand_id: str, roi_name: str, is_using_scooper: bool) -> bool:
        """
        Determine if we should create a violation for this sequence
        Enhanced with 1-second cooldown to prevent spam violations
        """
        sequence_key = f"{hand_id}_{roi_name}"
        current_time = time.time()

        # Check if we already created a violation for this sequence
        if sequence_key in self.sequence_violations:
            logger.debug(f"🔄 Sequence {sequence_key} already has violation, skipping")
            return False

        # Check 30-second cooldown - prevent violations too close in time
        # This prevents multiple violations for same work session
        if sequence_key in self.violation_timestamps:
            last_violation_time = self.violation_timestamps[sequence_key]
            time_since_last = current_time - last_violation_time

            if time_since_last < 30.0:  # Less than 30 seconds
                logger.info(f"⏰ WORK SESSION COOLDOWN: {sequence_key} violation blocked - only {time_since_last:.1f}s since last violation (need 30.0s)")
                print(f"⏰ WORK SESSION COOLDOWN: {sequence_key} - same work session, waiting {30.0 - time_since_last:.1f}s more")
                print(f"   This prevents multiple violations for continuous work in same area")
                return False

        # If hand is not using scooper when entering, this sequence needs a violation
        if not is_using_scooper:
            logger.info(f"🚨 Sequence {sequence_key} needs violation: hand entered without scooper")
            return True

        # If hand is using scooper, no violation needed
        logger.info(f"✅ Sequence {sequence_key} is compliant: hand entered with scooper")
        return False

    def _mark_sequence_as_violation(self, hand_id: str, roi_name: str, violation_id: str):
        """
        Mark a sequence as having a violation and record timestamp for cooldown
        """
        sequence_key = f"{hand_id}_{roi_name}"
        current_time = time.time()

        # Mark sequence as having violation
        self.sequence_violations[sequence_key] = violation_id

        # Record timestamp for 1-second cooldown
        self.violation_timestamps[sequence_key] = current_time

        logger.info(f"📝 Marked sequence {sequence_key} as violation: {violation_id}")
        logger.info(f"⏰ Violation timestamp recorded: {current_time} (30-second work session cooldown active)")
        print(f"⏰ WORK SESSION COOLDOWN: Next violation for {sequence_key} allowed after 30 seconds")
        print(f"   This prevents multiple violations during continuous work session")

# Global instances
config = ViolationDetectorConfig()
detector = ViolationDetector(config)

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "violation_detector",
        "version": "1.0.0",
        "active_workers": len(detector.workers),
        "total_violations": detector.violation_count
    }

@app.post("/analyze")
async def analyze_frame(request: AnalysisRequest):
    """Analyze frame for violations"""
    return await detector.analyze_frame(request)

@app.post("/analyze_with_frame")
async def analyze_frame_with_storage(request: AnalysisWithFrameRequest):
    """Analyze frame for violations with frame storage capability"""
    return await detector.analyze_frame_with_storage(request)

@app.get("/statistics")
async def get_statistics():
    """Get violation detection statistics"""
    return detector.get_statistics()

@app.get("/config")
async def get_config():
    """Get service configuration"""
    return {
        "temporal_window_seconds": config.temporal_window_seconds,
        "movement_threshold": config.movement_threshold,
        "roi_overlap_threshold": config.roi_overlap_threshold,
        "scooper_proximity_threshold": config.scooper_proximity_threshold,
        "violation_confidence_threshold": config.violation_confidence_threshold,
        "max_workers": config.max_workers
    }



if __name__ == "__main__":
    logger.info("Starting Violation Detection Service")
    uvicorn.run(app, host="0.0.0.0", port=8003)
