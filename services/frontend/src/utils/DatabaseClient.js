/**
 * Database Client for Pizza Store Violation Detection
 * Handles all database operations from the frontend
 */

class DatabaseClient {
  constructor(baseUrl = 'http://localhost:8005') {
    this.baseUrl = baseUrl;
  }

  // Helper method for API calls
  async apiCall(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${errorData.detail || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Database API call failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Session Operations
  async createSession(sessionData) {
    console.log('📊 Creating database session:', sessionData);
    return await this.apiCall('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    });
  }

  async getSession(sessionId) {
    return await this.apiCall(`/sessions/${sessionId}`);
  }

  async updateSession(sessionId, updateData) {
    console.log('📊 Updating database session:', sessionId, updateData);
    return await this.apiCall(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async getSessionStats(sessionId) {
    return await this.apiCall(`/sessions/${sessionId}/stats`);
  }

  // ROI Zone Operations
  async createROIZone(zoneData) {
    console.log('🎯 Creating database ROI zone:', zoneData);
    return await this.apiCall('/roi-zones', {
      method: 'POST',
      body: JSON.stringify(zoneData)
    });
  }

  async getROIZones(sessionId) {
    return await this.apiCall(`/sessions/${sessionId}/roi-zones`);
  }

  async saveROIZones(sessionId, zones) {
    console.log('🎯 Saving ROI zones to database:', zones.length, 'zones');
    const results = [];
    
    for (const zone of zones) {
      try {
        const zoneData = {
          id: zone.id,
          session_id: sessionId,
          name: zone.name,
          zone_type: zone.type || 'sauce_area',
          shape: zone.shape,
          points: zone.points,
          requires_scooper: zone.requiresScooper || zone.requires_scooper || true
        };
        
        const result = await this.createROIZone(zoneData);
        results.push(result);
      } catch (error) {
        console.error('Failed to save ROI zone:', zone.id, error);
      }
    }
    
    return results;
  }

  // Violation Operations
  async createViolation(violationData) {
    console.log('🚨 Creating database violation:', violationData);
    return await this.apiCall('/violations', {
      method: 'POST',
      body: JSON.stringify(violationData)
    });
  }

  async getViolations(sessionId, limit = 100) {
    return await this.apiCall(`/sessions/${sessionId}/violations?limit=${limit}`);
  }

  async saveViolation(sessionId, violation) {
    const violationData = {
      session_id: sessionId,
      worker_id: violation.workerId || null,
      roi_zone_id: violation.zoneId || null,
      frame_number: violation.frameNumber || 0,
      frame_path: violation.framePath || null,
      frame_base64: violation.frameBase64 || null,
      violation_type: violation.type || 'HAND_WITHOUT_SCOOPER',
      confidence: violation.confidence || 0.8,
      severity: violation.severity || 'medium',
      description: violation.description || '',
      bounding_boxes: violation.boundingBoxes || [],
      hand_position: violation.handPosition || null,
      scooper_present: violation.scooperPresent || false,
      scooper_distance: violation.scooperDistance || null,
      movement_pattern: violation.movementPattern || null
    };

    return await this.createViolation(violationData);
  }

  // Detection Operations
  async createDetection(detectionData) {
    return await this.apiCall('/detections', {
      method: 'POST',
      body: JSON.stringify(detectionData)
    });
  }

  async saveDetections(sessionId, frameNumber, detections) {
    console.log('🔍 Saving detections to database:', detections.length, 'detections');
    const results = [];
    
    for (const detection of detections) {
      try {
        const detectionData = {
          session_id: sessionId,
          frame_number: frameNumber,
          object_class: detection.class_name || detection.className,
          confidence: detection.confidence,
          bbox_x1: detection.bbox?.x1 || detection.x1,
          bbox_y1: detection.bbox?.y1 || detection.y1,
          bbox_x2: detection.bbox?.x2 || detection.x2,
          bbox_y2: detection.bbox?.y2 || detection.y2,
          metadata: {
            original_detection: detection
          }
        };
        
        const result = await this.createDetection(detectionData);
        results.push(result);
      } catch (error) {
        console.error('Failed to save detection:', detection, error);
      }
    }
    
    return results;
  }

  // Worker Operations
  async createWorker(workerData) {
    return await this.apiCall('/workers', {
      method: 'POST',
      body: JSON.stringify(workerData)
    });
  }

  // Frame Analysis Operations
  async saveFrameAnalysis(sessionId, frameNumber, analysisData) {
    const frameAnalysis = {
      session_id: sessionId,
      frame_number: frameNumber,
      total_detections: analysisData.totalDetections || 0,
      hands_count: analysisData.handsCount || 0,
      persons_count: analysisData.personsCount || 0,
      scoopers_count: analysisData.scoopersCount || 0,
      pizzas_count: analysisData.pizzasCount || 0,
      violations_count: analysisData.violationsCount || 0,
      processing_time_ms: analysisData.processingTimeMs || null,
      frame_size_bytes: analysisData.frameSizeBytes || null,
      analysis_metadata: analysisData.metadata || null
    };

    return await this.apiCall('/frame-analysis', {
      method: 'POST',
      body: JSON.stringify(frameAnalysis)
    });
  }

  // Health Check
  async healthCheck() {
    try {
      const result = await this.apiCall('/health');
      console.log('✅ Database health check passed:', result);
      return result;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      throw error;
    }
  }

  // Utility Methods
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateZoneId() {
    return `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateWorkerId() {
    return `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Batch Operations
  async saveBatchData(sessionId, frameNumber, data) {
    const promises = [];

    // Save detections
    if (data.detections && data.detections.length > 0) {
      promises.push(this.saveDetections(sessionId, frameNumber, data.detections));
    }

    // Save violations
    if (data.violations && data.violations.length > 0) {
      for (const violation of data.violations) {
        violation.frameNumber = frameNumber;
        promises.push(this.saveViolation(sessionId, violation));
      }
    }

    // Save frame analysis
    if (data.frameAnalysis) {
      promises.push(this.saveFrameAnalysis(sessionId, frameNumber, data.frameAnalysis));
    }

    try {
      const results = await Promise.allSettled(promises);
      console.log('📊 Batch data saved:', results.length, 'operations');
      return results;
    } catch (error) {
      console.error('❌ Batch save failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const databaseClient = new DatabaseClient();

export default databaseClient;
