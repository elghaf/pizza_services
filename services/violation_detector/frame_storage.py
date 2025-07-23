#!/usr/bin/env python3
"""
Frame Storage Utility for Violation Detection
Handles saving and managing frame images for violations
"""

import os
import base64
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io

logger = logging.getLogger(__name__)

class FrameStorageManager:
    """Manages frame storage for violation detection"""
    
    def __init__(self, storage_config: Dict[str, Any] = None):
        self.config = storage_config or {}
        self.base_storage_path = Path(self.config.get("base_path", "violation_frames"))
        self.max_frame_size = self.config.get("max_frame_size", (1920, 1080))
        self.jpeg_quality = self.config.get("jpeg_quality", 85)
        self.store_base64 = self.config.get("store_base64", True)
        self.store_file = self.config.get("store_file", True)
        
        # Create storage directory
        self.base_storage_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Frame storage initialized: {self.base_storage_path}")
    
    def create_session_directory(self, session_id: str) -> Path:
        """Create directory for session frames"""
        session_path = self.base_storage_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        return session_path
    
    def save_violation_frame(self, frame_data: np.ndarray, violation_info: Dict[str, Any], 
                           session_id: str) -> Dict[str, Any]:
        """
        Save frame with violation annotations
        
        Args:
            frame_data: Raw frame data as numpy array
            violation_info: Violation metadata including bounding boxes
            session_id: Session identifier
            
        Returns:
            Dictionary with frame_path and frame_base64 (if enabled)
        """
        try:
            # Create annotated frame
            annotated_frame = self._annotate_frame(frame_data, violation_info)
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            frame_id = violation_info.get("frame_id", "unknown")
            filename = f"violation_{frame_id}_{timestamp}.jpg"
            
            # Create session directory
            session_path = self.create_session_directory(session_id)
            file_path = session_path / filename
            
            result = {}
            
            # Save to file if enabled
            if self.store_file:
                # Resize if necessary
                if annotated_frame.shape[1] > self.max_frame_size[0] or annotated_frame.shape[0] > self.max_frame_size[1]:
                    annotated_frame = self._resize_frame(annotated_frame, self.max_frame_size)
                
                # Save as JPEG
                cv2.imwrite(str(file_path), annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality])
                result["frame_path"] = str(file_path)
                logger.info(f"💾 Violation frame saved: {file_path}")
            
            # Convert to base64 if enabled
            if self.store_base64:
                # Resize for base64 storage (smaller size)
                base64_frame = self._resize_frame(annotated_frame, (800, 600))
                
                # Encode as JPEG
                _, buffer = cv2.imencode('.jpg', base64_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                
                # Convert to base64
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                result["frame_base64"] = frame_base64
                logger.info(f"📸 Frame converted to base64 ({len(frame_base64)} chars)")
            
            # Save metadata
            metadata_path = session_path / f"{filename}.json"
            with open(metadata_path, 'w') as f:
                json.dump({
                    "violation_info": violation_info,
                    "timestamp": datetime.now().isoformat(),
                    "frame_size": annotated_frame.shape,
                    "file_path": str(file_path) if self.store_file else None,
                    "has_base64": self.store_base64
                }, f, indent=2)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to save violation frame: {e}")
            return {}
    
    def _annotate_frame(self, frame: np.ndarray, violation_info: Dict[str, Any]) -> np.ndarray:
        """Add violation annotations to frame"""
        annotated = frame.copy()
        
        try:
            # Draw violation bounding boxes
            bounding_boxes = violation_info.get("bounding_boxes", [])
            for bbox in bounding_boxes:
                if isinstance(bbox, dict):
                    x1 = int(bbox.get("x", 0))
                    y1 = int(bbox.get("y", 0))
                    x2 = int(x1 + bbox.get("width", 0))
                    y2 = int(y1 + bbox.get("height", 0))
                    
                    # Draw red rectangle for violation
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 3)
                    
                    # Add violation label
                    violation_type = violation_info.get("violation_type", "VIOLATION")
                    confidence = violation_info.get("confidence", 0.0)
                    label = f"{violation_type} ({confidence:.2f})"
                    
                    # Add text background
                    (text_width, text_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                    cv2.rectangle(annotated, (x1, y1 - text_height - 10), (x1 + text_width, y1), (0, 0, 255), -1)
                    cv2.putText(annotated, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Draw ROI zones if available
            roi_info = violation_info.get("roi_info", {})
            if roi_info:
                roi_bounds = roi_info.get("roi_bounds", {})
                if roi_bounds:
                    x = int(roi_bounds.get("x", 0))
                    y = int(roi_bounds.get("y", 0))
                    width = int(roi_bounds.get("width", 0))
                    height = int(roi_bounds.get("height", 0))
                    
                    # Draw ROI zone in yellow
                    cv2.rectangle(annotated, (x, y), (x + width, y + height), (0, 255, 255), 2)
                    
                    # Add ROI label
                    roi_name = roi_info.get("name", "ROI")
                    cv2.putText(annotated, f"ROI: {roi_name}", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            
            # Add timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(annotated, timestamp, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            
            # Add violation severity indicator
            severity = violation_info.get("severity", "medium")
            severity_color = {"low": (0, 255, 0), "medium": (0, 165, 255), "high": (0, 0, 255)}.get(severity, (0, 165, 255))
            cv2.putText(annotated, f"SEVERITY: {severity.upper()}", (10, frame.shape[0] - 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, severity_color, 2)
            
        except Exception as e:
            logger.error(f"❌ Failed to annotate frame: {e}")
            return frame
        
        return annotated
    
    def _resize_frame(self, frame: np.ndarray, target_size: Tuple[int, int]) -> np.ndarray:
        """Resize frame while maintaining aspect ratio"""
        height, width = frame.shape[:2]
        target_width, target_height = target_size
        
        # Calculate scaling factor
        scale = min(target_width / width, target_height / height)
        
        if scale < 1.0:
            new_width = int(width * scale)
            new_height = int(height * scale)
            resized = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)
            return resized
        
        return frame
    
    def get_violation_frame(self, session_id: str, frame_filename: str) -> Optional[np.ndarray]:
        """Load violation frame from storage"""
        try:
            session_path = self.base_storage_path / session_id
            frame_path = session_path / frame_filename
            
            if frame_path.exists():
                frame = cv2.imread(str(frame_path))
                return frame
            else:
                logger.warning(f"⚠️ Frame not found: {frame_path}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to load frame: {e}")
            return None
    
    def cleanup_old_frames(self, max_age_days: int = 30):
        """Clean up old violation frames"""
        try:
            cutoff_time = datetime.now().timestamp() - (max_age_days * 24 * 3600)
            
            for session_dir in self.base_storage_path.iterdir():
                if session_dir.is_dir():
                    for frame_file in session_dir.glob("*.jpg"):
                        if frame_file.stat().st_mtime < cutoff_time:
                            frame_file.unlink()
                            logger.info(f"🗑️ Cleaned up old frame: {frame_file}")
                            
                            # Also remove metadata file
                            metadata_file = frame_file.with_suffix('.jpg.json')
                            if metadata_file.exists():
                                metadata_file.unlink()
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup old frames: {e}")
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            total_files = 0
            total_size = 0
            sessions = 0
            
            for session_dir in self.base_storage_path.iterdir():
                if session_dir.is_dir():
                    sessions += 1
                    for file_path in session_dir.glob("*"):
                        if file_path.is_file():
                            total_files += 1
                            total_size += file_path.stat().st_size
            
            return {
                "total_sessions": sessions,
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "storage_path": str(self.base_storage_path)
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get storage stats: {e}")
            return {}
