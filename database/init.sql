-- Pizza Store Violation Detection Database Schema
-- Initialize PostgreSQL database with all required tables

-- Create database (if running manually)
-- CREATE DATABASE pizza_violations;

-- Connect to the database
-- \c pizza_violations;

-- Enable UUID extension for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions Table - Track video processing sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    video_path VARCHAR(500) NOT NULL,
    video_filename VARCHAR(255),
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    total_violations INTEGER DEFAULT 0,
    total_frames INTEGER DEFAULT 0,
    fps INTEGER DEFAULT 10,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ROI Zones Table - Store region of interest configurations
CREATE TABLE IF NOT EXISTS roi_zones (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50) NOT NULL, -- 'sauce_area', 'cheese_area', 'protein_area'
    shape VARCHAR(20) NOT NULL, -- 'rectangle', 'polygon'
    points JSONB NOT NULL, -- Array of {x, y} coordinates
    requires_scooper BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Workers Table - Track individual workers
CREATE TABLE IF NOT EXISTS workers (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
    worker_number INTEGER NOT NULL,
    first_detected TIMESTAMP DEFAULT NOW(),
    last_detected TIMESTAMP DEFAULT NOW(),
    total_violations INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Violations Table - Store all detected violations
CREATE TABLE IF NOT EXISTS violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
    worker_id VARCHAR(255) REFERENCES workers(id) ON DELETE SET NULL,
    roi_zone_id VARCHAR(255) REFERENCES roi_zones(id) ON DELETE SET NULL,
    frame_number INTEGER NOT NULL,
    frame_path VARCHAR(500),
    frame_base64 TEXT, -- Store frame image as base64
    timestamp TIMESTAMP DEFAULT NOW(),
    violation_type VARCHAR(100) NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
    description TEXT,
    bounding_boxes JSONB, -- Array of detection bounding boxes
    hand_position JSONB, -- {x, y} coordinates of hand
    scooper_present BOOLEAN DEFAULT FALSE,
    scooper_distance FLOAT, -- Distance to nearest scooper
    movement_pattern VARCHAR(50), -- 'grabbing', 'cleaning', 'unknown'
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Detections Table - Store all object detections for analysis
CREATE TABLE IF NOT EXISTS detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    object_class VARCHAR(50) NOT NULL, -- 'hand', 'person', 'pizza', 'scooper'
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    bbox_x1 FLOAT NOT NULL,
    bbox_y1 FLOAT NOT NULL,
    bbox_x2 FLOAT NOT NULL,
    bbox_y2 FLOAT NOT NULL,
    center_x FLOAT GENERATED ALWAYS AS ((bbox_x1 + bbox_x2) / 2) STORED,
    center_y FLOAT GENERATED ALWAYS AS ((bbox_y1 + bbox_y2) / 2) STORED,
    area FLOAT GENERATED ALWAYS AS ((bbox_x2 - bbox_x1) * (bbox_y2 - bbox_y1)) STORED,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Frame Analysis Table - Store frame-level analysis results
CREATE TABLE IF NOT EXISTS frame_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    total_detections INTEGER DEFAULT 0,
    hands_count INTEGER DEFAULT 0,
    persons_count INTEGER DEFAULT 0,
    scoopers_count INTEGER DEFAULT 0,
    pizzas_count INTEGER DEFAULT 0,
    violations_count INTEGER DEFAULT 0,
    processing_time_ms FLOAT,
    frame_size_bytes INTEGER,
    analysis_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_violations_session_id ON violations(session_id);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp);
CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations(resolved);

CREATE INDEX IF NOT EXISTS idx_detections_session_id ON detections(session_id);
CREATE INDEX IF NOT EXISTS idx_detections_frame_number ON detections(frame_number);
CREATE INDEX IF NOT EXISTS idx_detections_object_class ON detections(object_class);
CREATE INDEX IF NOT EXISTS idx_detections_timestamp ON detections(timestamp);

CREATE INDEX IF NOT EXISTS idx_roi_zones_session_id ON roi_zones(session_id);
CREATE INDEX IF NOT EXISTS idx_roi_zones_active ON roi_zones(is_active);

CREATE INDEX IF NOT EXISTS idx_workers_session_id ON workers(session_id);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers(is_active);

CREATE INDEX IF NOT EXISTS idx_frame_analysis_session_id ON frame_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_frame_analysis_frame_number ON frame_analysis(frame_number);

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roi_zones_updated_at BEFORE UPDATE ON roi_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO sessions (id, video_path, video_filename, status, metadata) VALUES 
('test_session_1', '/videos/test_video.mp4', 'test_video.mp4', 'active', '{"test": true}'),
('test_session_2', '/videos/sample.mp4', 'sample.mp4', 'completed', '{"duration": 120}');

INSERT INTO roi_zones (id, session_id, name, zone_type, shape, points, requires_scooper) VALUES 
('zone_1', 'test_session_1', 'Sauce Area', 'sauce_area', 'polygon', '[{"x": 100, "y": 100}, {"x": 200, "y": 100}, {"x": 200, "y": 200}, {"x": 100, "y": 200}]', true),
('zone_2', 'test_session_1', 'Cheese Area', 'cheese_area', 'rectangle', '[{"x": 300, "y": 150}, {"x": 450, "y": 250}]', false);

INSERT INTO workers (id, session_id, worker_number, metadata) VALUES 
('worker_1', 'test_session_1', 1, '{"name": "Worker 1"}'),
('worker_2', 'test_session_1', 2, '{"name": "Worker 2"}');

-- Create views for common queries
CREATE OR REPLACE VIEW violation_summary AS
SELECT 
    s.id as session_id,
    s.video_filename,
    s.status,
    COUNT(v.id) as total_violations,
    COUNT(CASE WHEN v.resolved = false THEN 1 END) as unresolved_violations,
    COUNT(CASE WHEN v.severity = 'high' THEN 1 END) as high_severity_violations,
    MIN(v.timestamp) as first_violation,
    MAX(v.timestamp) as last_violation
FROM sessions s
LEFT JOIN violations v ON s.id = v.session_id
GROUP BY s.id, s.video_filename, s.status;

CREATE OR REPLACE VIEW detection_summary AS
SELECT 
    s.id as session_id,
    s.video_filename,
    COUNT(d.id) as total_detections,
    COUNT(CASE WHEN d.object_class = 'hand' THEN 1 END) as hand_detections,
    COUNT(CASE WHEN d.object_class = 'scooper' THEN 1 END) as scooper_detections,
    COUNT(CASE WHEN d.object_class = 'person' THEN 1 END) as person_detections,
    AVG(d.confidence) as avg_confidence
FROM sessions s
LEFT JOIN detections d ON s.id = d.session_id
GROUP BY s.id, s.video_filename;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pizza_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pizza_app_user;

COMMIT;
