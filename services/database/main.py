"""
Database Service for Pizza Store Violation Detection
Provides database operations and API endpoints for data persistence
"""

import os
import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

import asyncpg
import asyncio
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration with connection retry logic
# Try multiple credential combinations for existing containers
CREDENTIAL_OPTIONS = [
    {
        "host": os.getenv("DB_HOST", "localhost").strip(),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": os.getenv("DB_NAME", "pizza_violations").strip(),
        "user": os.getenv("DB_USER", "pizza_admin").strip(),
        "password": os.getenv("DB_PASSWORD", "secure_pizza_2024").strip(),
    },
    {
        "host": os.getenv("DB_HOST", "localhost").strip(),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": "pizza_store_db",
        "user": "pizza_user",
        "password": "pizza_password",
    },
    {
        "host": os.getenv("DB_HOST", "localhost").strip(),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": "postgres",
        "user": "postgres",
        "password": "postgres",
    },
    {
        "host": os.getenv("DB_HOST", "localhost").strip(),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": "postgres",
        "user": "postgres",
        "password": "",
    },
]

# Default to first option for backward compatibility
DATABASE_CONFIG = CREDENTIAL_OPTIONS[0]

# Alternative hosts to try if localhost fails
ALTERNATIVE_HOSTS = [
    "127.0.0.1",
    "host.docker.internal",
    "172.17.0.1",  # Common Docker bridge IP
]

# Global connection pool
db_pool = None

# Pydantic Models
class SessionCreate(BaseModel):
    id: str
    video_path: str
    video_filename: str
    fps: int = 10
    metadata: Optional[Dict[str, Any]] = None

class SessionUpdate(BaseModel):
    end_time: Optional[datetime] = None
    total_violations: Optional[int] = None
    total_frames: Optional[int] = None
    status: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ROIZoneCreate(BaseModel):
    id: str
    session_id: str
    name: str
    zone_type: str
    shape: str
    points: List[Dict[str, float]]
    requires_scooper: bool = True

class WorkerCreate(BaseModel):
    id: str
    session_id: str
    worker_number: int
    metadata: Optional[Dict[str, Any]] = None

class ViolationCreate(BaseModel):
    session_id: str
    worker_id: Optional[str] = None
    roi_zone_id: Optional[str] = None
    frame_number: int
    frame_path: Optional[str] = None
    frame_base64: Optional[str] = None
    violation_type: str
    confidence: float = Field(..., ge=0, le=1)
    severity: str = "medium"
    description: Optional[str] = None
    bounding_boxes: Optional[List[Dict[str, Any]]] = None
    hand_position: Optional[Dict[str, float]] = None
    scooper_present: bool = False
    scooper_distance: Optional[float] = None
    movement_pattern: Optional[str] = None

class DetectionCreate(BaseModel):
    session_id: str
    frame_number: int
    object_class: str
    confidence: float = Field(..., ge=0, le=1)
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float
    metadata: Optional[Dict[str, Any]] = None

class FrameAnalysisCreate(BaseModel):
    session_id: str
    frame_number: int
    total_detections: int = 0
    hands_count: int = 0
    persons_count: int = 0
    scoopers_count: int = 0
    pizzas_count: int = 0
    violations_count: int = 0
    processing_time_ms: Optional[float] = None
    frame_size_bytes: Optional[int] = None
    analysis_metadata: Optional[Dict[str, Any]] = None

# Database connection management with retry logic
async def get_db_pool():
    global db_pool
    if db_pool is None:
        # Try different credential combinations
        for cred_idx, config in enumerate(CREDENTIAL_OPTIONS):
            logger.info(f"🔄 Trying credential set {cred_idx + 1}: {config['database']}@{config['user']}")

            # Try different hosts for each credential set
            for attempt, host in enumerate([config["host"]] + ALTERNATIVE_HOSTS):
                test_config = config.copy()
                test_config["host"] = host
                logger.info(f"🔄 Attempting to connect to PostgreSQL at {host}:{test_config['port']} (attempt {attempt + 1})")

                try:
                    db_pool = await asyncpg.create_pool(
                        **test_config,
                        min_size=5,
                        max_size=20,
                        command_timeout=60
                    )
                    logger.info(f"✅ Database connection pool created successfully!")
                    logger.info(f"✅ Connected to: {test_config['database']} as {test_config['user']} at {host}:{test_config['port']}")
                    # Update global config with working credentials
                    global DATABASE_CONFIG
                    DATABASE_CONFIG = test_config
                    return db_pool

                except Exception as e:
                    logger.warning(f"⚠️ Failed to connect to {host}:{test_config['port']}: {e}")
                    continue

        # If we get here, all combinations failed
        logger.error("❌ Failed to connect to PostgreSQL after trying all credential combinations")
        logger.error("💡 Make sure PostgreSQL container is running and accessible")
        logger.error("💡 Try: docker ps | findstr postgres")
        logger.error("💡 Try: docker-compose up -d postgres")
        raise Exception("Could not connect to PostgreSQL with any credential combination")

    return db_pool

async def get_db_connection():
    pool = await get_db_pool()
    async with pool.acquire() as connection:
        yield connection

# Database operations
class DatabaseService:
    def __init__(self):
        self.pool = None
    
    async def init_pool(self):
        self.pool = await get_db_pool()
    
    # Session operations
    async def create_session(self, session: SessionCreate) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            query = """
                INSERT INTO sessions (id, video_path, video_filename, fps, metadata)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            """
            result = await conn.fetchrow(
                query, session.id, session.video_path, session.video_filename,
                session.fps, json.dumps(session.metadata) if session.metadata else None
            )
            return dict(result)
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            query = "SELECT * FROM sessions WHERE id = $1"
            result = await conn.fetchrow(query, session_id)
            return dict(result) if result else None
    
    async def update_session(self, session_id: str, update: SessionUpdate) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            # Build dynamic update query
            set_clauses = []
            values = []
            param_count = 1
            
            if update.end_time is not None:
                set_clauses.append(f"end_time = ${param_count}")
                values.append(update.end_time)
                param_count += 1
            
            if update.total_violations is not None:
                set_clauses.append(f"total_violations = ${param_count}")
                values.append(update.total_violations)
                param_count += 1
            
            if update.total_frames is not None:
                set_clauses.append(f"total_frames = ${param_count}")
                values.append(update.total_frames)
                param_count += 1
            
            if update.status is not None:
                set_clauses.append(f"status = ${param_count}")
                values.append(update.status)
                param_count += 1
            
            if update.metadata is not None:
                set_clauses.append(f"metadata = ${param_count}")
                values.append(json.dumps(update.metadata))
                param_count += 1
            
            if not set_clauses:
                raise ValueError("No fields to update")
            
            query = f"""
                UPDATE sessions 
                SET {', '.join(set_clauses)}, updated_at = NOW()
                WHERE id = ${param_count}
                RETURNING *
            """
            values.append(session_id)
            
            result = await conn.fetchrow(query, *values)
            return dict(result) if result else None
    
    # ROI Zone operations
    async def create_roi_zone(self, zone: ROIZoneCreate) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            query = """
                INSERT INTO roi_zones (id, session_id, name, zone_type, shape, points, requires_scooper)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            """
            result = await conn.fetchrow(
                query, zone.id, zone.session_id, zone.name, zone.zone_type,
                zone.shape, json.dumps(zone.points), zone.requires_scooper
            )
            return dict(result)
    
    async def get_roi_zones(self, session_id: str) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            query = "SELECT * FROM roi_zones WHERE session_id = $1 AND is_active = true"
            results = await conn.fetch(query, session_id)
            return [dict(row) for row in results]
    
    # Violation operations
    async def create_violation(self, violation: ViolationCreate) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            # First, ensure the session exists
            await self._ensure_session_exists(conn, violation.session_id)

            # Ensure ROI zone exists or set to NULL
            roi_zone_id = await self._ensure_roi_zone_exists(conn, violation.session_id, violation.roi_zone_id)

            query = """
                INSERT INTO violations (
                    session_id, worker_id, roi_zone_id, frame_number, frame_path,
                    frame_base64, violation_type, confidence, severity, description,
                    bounding_boxes, hand_position, scooper_present, scooper_distance,
                    movement_pattern
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            """
            result = await conn.fetchrow(
                query, violation.session_id, violation.worker_id, roi_zone_id,
                violation.frame_number, violation.frame_path, violation.frame_base64,
                violation.violation_type, violation.confidence, violation.severity,
                violation.description, json.dumps(violation.bounding_boxes) if violation.bounding_boxes else None,
                json.dumps(violation.hand_position) if violation.hand_position else None,
                violation.scooper_present, violation.scooper_distance, violation.movement_pattern
            )
            return dict(result)

    async def _ensure_session_exists(self, conn, session_id: str):
        """Ensure a session exists, create it if it doesn't"""
        try:
            # Check if session exists
            check_query = "SELECT id FROM sessions WHERE id = $1"
            existing = await conn.fetchrow(check_query, session_id)

            if not existing:
                # Create the session with correct schema
                create_query = """
                    INSERT INTO sessions (id, video_path, video_filename, status, metadata)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO NOTHING
                """
                video_path = f"/auto-created/{session_id}"
                video_filename = f"auto_{session_id}.mp4"
                metadata = {"auto_created": True, "created_for": "violation_detection"}

                await conn.execute(create_query, session_id, video_path, video_filename, "active", json.dumps(metadata))
                logger.info(f"✅ Auto-created session: {session_id}")
        except Exception as e:
            logger.warning(f"⚠️ Could not ensure session exists: {e}")

    async def _ensure_roi_zone_exists(self, conn, session_id: str, roi_zone_name: str) -> str:
        """Ensure an ROI zone exists, create it if it doesn't, or return None if invalid"""
        if not roi_zone_name:
            return None

        try:
            # Check if ROI zone exists
            check_query = "SELECT id FROM roi_zones WHERE session_id = $1 AND name = $2"
            existing = await conn.fetchrow(check_query, session_id, roi_zone_name)

            if existing:
                return existing['id']

            # Create the ROI zone with default settings
            roi_zone_id = f"{session_id}_{roi_zone_name}"
            create_query = """
                INSERT INTO roi_zones (id, session_id, name, zone_type, shape, points, requires_scooper)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
                RETURNING id
            """

            # Default ROI zone settings
            zone_type = "ingredient_area"
            shape = "rectangle"
            default_points = [{"x": 400, "y": 300}, {"x": 600, "y": 300}, {"x": 600, "y": 500}, {"x": 400, "y": 500}]
            requires_scooper = True

            result = await conn.fetchrow(
                create_query, roi_zone_id, session_id, roi_zone_name,
                zone_type, shape, json.dumps(default_points), requires_scooper
            )

            if result:
                logger.info(f"✅ Auto-created ROI zone: {roi_zone_name} for session {session_id}")
                return result['id']
            else:
                # ROI zone already existed (conflict), fetch it
                existing = await conn.fetchrow(check_query, session_id, roi_zone_name)
                return existing['id'] if existing else None

        except Exception as e:
            logger.warning(f"⚠️ Could not ensure ROI zone exists: {e}")
            return None

    async def get_violations(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            query = """
                SELECT * FROM violations 
                WHERE session_id = $1 
                ORDER BY timestamp DESC 
                LIMIT $2
            """
            results = await conn.fetch(query, session_id, limit)
            return [dict(row) for row in results]
    
    # Detection operations
    async def create_detection(self, detection: DetectionCreate) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            # First, ensure the session exists
            await self._ensure_session_exists(conn, detection.session_id)

            query = """
                INSERT INTO detections (
                    session_id, frame_number, object_class, confidence,
                    bbox_x1, bbox_y1, bbox_x2, bbox_y2, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            """
            result = await conn.fetchrow(
                query, detection.session_id, detection.frame_number, detection.object_class,
                detection.confidence, detection.bbox_x1, detection.bbox_y1,
                detection.bbox_x2, detection.bbox_y2,
                json.dumps(detection.metadata) if detection.metadata else None
            )
            return dict(result)
    
    # Statistics operations
    async def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            query = """
                SELECT 
                    s.*,
                    COALESCE(v.violation_count, 0) as violation_count,
                    COALESCE(d.detection_count, 0) as detection_count,
                    COALESCE(z.zone_count, 0) as zone_count
                FROM sessions s
                LEFT JOIN (
                    SELECT session_id, COUNT(*) as violation_count 
                    FROM violations 
                    WHERE session_id = $1 
                    GROUP BY session_id
                ) v ON s.id = v.session_id
                LEFT JOIN (
                    SELECT session_id, COUNT(*) as detection_count 
                    FROM detections 
                    WHERE session_id = $1 
                    GROUP BY session_id
                ) d ON s.id = d.session_id
                LEFT JOIN (
                    SELECT session_id, COUNT(*) as zone_count 
                    FROM roi_zones 
                    WHERE session_id = $1 AND is_active = true
                    GROUP BY session_id
                ) z ON s.id = z.session_id
                WHERE s.id = $1
            """
            result = await conn.fetchrow(query, session_id)
            return dict(result) if result else None

# Initialize database service
db_service = DatabaseService()

# FastAPI app
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db_service.init_pool()
    logger.info("🚀 Database service started")
    yield
    # Shutdown
    if db_service.pool:
        await db_service.pool.close()
    logger.info("🛑 Database service stopped")

app = FastAPI(
    title="Pizza Store Database Service",
    description="Database operations for violation detection system",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        async with db_service.pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {
            "status": "healthy",
            "service": "database",
            "version": "1.0.0",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Database connection failed")

# Session endpoints
@app.post("/sessions")
async def create_session_endpoint(session: SessionCreate):
    try:
        result = await db_service.create_session(session)
        logger.info(f"✅ Created session: {session.id}")
        return result
    except Exception as e:
        logger.error(f"❌ Failed to create session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}")
async def get_session_endpoint(session_id: str):
    result = await db_service.get_session(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result

@app.put("/sessions/{session_id}")
async def update_session_endpoint(session_id: str, update: SessionUpdate):
    try:
        result = await db_service.update_session(session_id, update)
        if not result:
            raise HTTPException(status_code=404, detail="Session not found")
        logger.info(f"✅ Updated session: {session_id}")
        return result
    except Exception as e:
        logger.error(f"❌ Failed to update session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}/stats")
async def get_session_stats_endpoint(session_id: str):
    result = await db_service.get_session_stats(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result

# ROI Zone endpoints
@app.post("/roi-zones")
async def create_roi_zone_endpoint(zone: ROIZoneCreate):
    try:
        result = await db_service.create_roi_zone(zone)
        logger.info(f"✅ Created ROI zone: {zone.id}")
        return result
    except Exception as e:
        logger.error(f"❌ Failed to create ROI zone: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}/roi-zones")
async def get_roi_zones_endpoint(session_id: str):
    return await db_service.get_roi_zones(session_id)

# Violation endpoints
@app.post("/violations")
async def create_violation_endpoint(violation: ViolationCreate):
    try:
        result = await db_service.create_violation(violation)
        logger.info(f"✅ Created violation: {result['id']}")
        return result
    except Exception as e:
        logger.error(f"❌ Failed to create violation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}/violations")
async def get_violations_endpoint(session_id: str, limit: int = 100):
    return await db_service.get_violations(session_id, limit)

# Detection endpoints
@app.post("/detections")
async def create_detection_endpoint(detection: DetectionCreate):
    try:
        result = await db_service.create_detection(detection)
        return result
    except Exception as e:
        logger.error(f"❌ Failed to create detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import os
    port = int(os.getenv("DATABASE_PORT", "8005"))  # Use port 8005 by default
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
