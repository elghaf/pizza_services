/**
 * Simple Dashboard - Clean and minimal interface for video processing
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import './SimpleDashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SimpleDashboard = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [detections, setDetections] = useState([]);
  const [violations, setViolations] = useState([]);
  const [stats, setStats] = useState({ frames: 0, detections: 0, violations: 0 });

  // FPS Control
  const [targetFPS, setTargetFPS] = useState(5); // Default 5 FPS for better control

  // Service Health Monitoring
  const [serviceHealth, setServiceHealth] = useState({});

  // ROI Drawing States
  const [showROIEditor, setShowROIEditor] = useState(false);
  const [roiMode, setRoiMode] = useState('polygon'); // 'polygon' or 'rectangle'
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentROI, setCurrentROI] = useState([]);
  const [savedROIs, setSavedROIs] = useState([]);
  const [firstFrame, setFirstFrame] = useState(null);
  const [roiName, setRoiName] = useState('');

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const roiCanvasRef = useRef(null);
  const wsRef = useRef(null);

  // Load existing ROIs from backend on component mount
  useEffect(() => {
    loadExistingROIs();
    checkServiceHealth(); // Initial health check

    // Set up periodic health checks
    const healthInterval = setInterval(checkServiceHealth, 30000); // Every 30 seconds

    return () => clearInterval(healthInterval);
  }, []);

  // Redraw ROI canvas when currentROI or savedROIs change
  useEffect(() => {
    if (showROIEditor && firstFrame) {
      // Use setTimeout to avoid initialization issues
      setTimeout(() => {
        if (typeof drawROICanvas === 'function') {
          drawROICanvas();
        }
      }, 0);
    }
  }, [currentROI, savedROIs, showROIEditor, firstFrame]);

  const loadExistingROIs = async () => {
    try {
      const response = await fetch('http://localhost:8004/rois');
      if (response.ok) {
        const data = await response.json();
        console.log('Raw ROI response:', data);

        // Handle different response formats
        let rois = [];
        if (Array.isArray(data)) {
          rois = data;
        } else if (data && Array.isArray(data.rois)) {
          rois = data.rois;
        } else if (data && data.data && Array.isArray(data.data)) {
          rois = data.data;
        } else {
          console.log('No ROIs found or unexpected format');
          return;
        }

        const formattedROIs = rois.map(roi => {
          let points = [];

          // Handle different coordinate formats
          if (roi.coordinates && Array.isArray(roi.coordinates)) {
            // New format: coordinates array
            points = roi.coordinates.map(coord => ({
              x: coord[0] || 0,
              y: coord[1] || 0
            }));
          } else if (roi.points && Array.isArray(roi.points)) {
            // Polygon format: points array
            points = roi.points;
          } else if (roi.x !== undefined && roi.y !== undefined && roi.width !== undefined && roi.height !== undefined) {
            // Rectangle format: x, y, width, height
            points = [
              { x: roi.x, y: roi.y },
              { x: roi.x + roi.width, y: roi.y + roi.height }
            ];
          }

          return {
            id: roi.id || roi.name || Date.now() + Math.random(),
            name: roi.name || 'Unnamed ROI',
            type: roi.shape === 'rectangle' ? 'rectangle' : 'polygon',
            points: points,
            created_at: roi.created_at || new Date().toISOString()
          };
        });

        setSavedROIs(formattedROIs);
        console.log('Loaded existing ROIs:', formattedROIs);
      } else {
        console.log('Failed to load ROIs, status:', response.status);
      }
    } catch (error) {
      console.error('Error loading existing ROIs:', error);
    }
  };

  // Service Health Monitoring (via API Gateway)
  const checkServiceHealth = async () => {
    try {
      // Get system status from API Gateway (which checks all services)
      const response = await fetch(`${API_BASE_URL}/api/system/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const systemStatus = await response.json();
        const healthStatus = {};

        // Convert API Gateway format to frontend format
        if (systemStatus.services) {
          Object.entries(systemStatus.services).forEach(([serviceName, serviceData]) => {
            // Map service names to display names
            const displayName = serviceName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

            healthStatus[displayName] = {
              status: serviceData.status === 'healthy' ? 'healthy' : 'offline',
              responseTime: serviceData.response_time || 0,
              error: serviceData.error || null
            };
          });
        }

        // Add API Gateway itself (since it responded)
        healthStatus['API Gateway'] = {
          status: 'healthy',
          responseTime: Date.now(),
          error: null
        };

        setServiceHealth(healthStatus);

        // Log unhealthy services
        const unhealthyServices = Object.entries(healthStatus)
          .filter(([_, health]) => health.status !== 'healthy')
          .map(([name, _]) => name);

        if (unhealthyServices.length > 0) {
          console.warn('⚠️ Unhealthy services:', unhealthyServices);
        }

      } else {
        // API Gateway is down
        console.error('❌ API Gateway is not responding');
        setServiceHealth({
          'API Gateway': {
            status: 'offline',
            responseTime: Date.now(),
            error: `HTTP ${response.status}`
          }
        });
      }

    } catch (error) {
      console.error('❌ Error checking service health:', error);
      // API Gateway is completely offline
      setServiceHealth({
        'API Gateway': {
          status: 'offline',
          responseTime: Date.now(),
          error: error.message
        }
      });
    }
  };

  // File selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      toast.success(`Video selected: ${file.name}`);
    } else {
      toast.error('Please select a valid video file');
    }
  };

  // Upload video and start processing (combined in API Gateway)
  const uploadVideo = async (file, fps = 10) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('fps', fps.toString());
    formData.append('roi_zones', JSON.stringify(savedROIs));

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return await response.json();
  };

  // Start processing
  const startProcessing = async () => {
    if (!selectedFile) {
      toast.error('Please select a video file first');
      return;
    }

    try {
      setIsProcessing(true);
      setDetections([]);
      setViolations([]);
      setStats({ frames: 0, detections: 0, violations: 0 });

      // Check if essential services are healthy before starting
      const essentialServices = ['API Gateway', 'Frame Reader'];
      const unhealthyEssential = essentialServices.filter(service =>
        !serviceHealth[service] || serviceHealth[service].status !== 'healthy'
      );

      if (unhealthyEssential.length > 0) {
        toast.error(`Cannot start processing: ${unhealthyEssential.join(', ')} service(s) are not available`);
        return;
      }

      // Upload video and start processing (combined in API Gateway)
      toast.info('Uploading video and starting processing...');
      const result = await uploadVideo(selectedFile, targetFPS);

      if (result.success) {
        const sessionId = result.data.video_id; // Use video_id as session_id
        setSessionId(sessionId);

        toast.success(`Video processing started successfully! Processing at ${targetFPS} FPS`);

        // Connect to WebSocket for real-time updates
        connectWebSocket(sessionId);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // Stop processing professionally
  const stopProcessing = async () => {
    try {
      console.log('🛑 Stopping video processing...');

      // Close WebSocket connection first
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Call backend stop endpoint
      try {
        const response = await fetch('http://localhost:8001/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Backend processing stopped:', result);
          toast.success('Processing stopped successfully');
        } else {
          console.warn('⚠️ Backend stop request failed:', response.status);
          toast.warning('Processing stopped (frontend only)');
        }
      } catch (error) {
        console.error('❌ Error stopping backend:', error);
        toast.warning('Processing stopped (frontend only)');
      }

      // Reset frontend state
      setIsProcessing(false);
      setSessionId(null);
      setCurrentFrame(null);

    } catch (error) {
      console.error('❌ Error during stop:', error);
      toast.error('Error stopping processing');
    }
  };

  // WebSocket connection
  const connectWebSocket = (sessionId) => {
    try {
      // Construct WebSocket URL for frame reader service
      const wsUrl = `ws://localhost:8001/ws/${sessionId}`;
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data.type, data);

          // Handle frame_processed messages from backend
          if (data.type === 'frame_processed' && data.frame_data) {
            console.log('Frame processed - detections:', data.detections?.length || 0, 'violations:', data.violations?.length || 0, 'ROI zones:', data.roi_zones?.length || 0);
            setCurrentFrame(data.frame_data);
            setStats(prev => ({
              ...prev,
              frames: prev.frames + 1,
              violations: prev.violations + (data.violations?.length || 0)
            }));

            // Update violations list
            if (data.violations && data.violations.length > 0) {
              setViolations(prev => [...prev, ...data.violations].slice(-50)); // Keep last 50 violations
            }

            // Capture first frame for ROI drawing
            if (!firstFrame) {
              setFirstFrame(data.frame_data);
            }

            drawFrame(data.frame_data, data.detections || [], data.roi_zones || [], data.violations || [], data.tracking_summary || null);
          }

          // Also handle legacy 'frame' type for compatibility
          if (data.type === 'frame' && data.frame_data) {
            setCurrentFrame(data.frame_data);
            setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
            drawFrame(data.frame_data, data.detections || [], [], [], data.tracking_summary || null);
          }

          if (data.type === 'detection' && data.detections) {
            setDetections(data.detections);
            setStats(prev => ({ ...prev, detections: data.detections.length }));
          }

          if (data.type === 'violation' && data.violation) {
            setViolations(prev => [...prev, data.violation]);
            setStats(prev => ({ ...prev, violations: prev.violations + 1 }));
            toast.warning(`Violation: ${data.violation.description}`);
          }

          // Handle processing completion
          if (data.type === 'processing_complete') {
            console.log('✅ Video processing completed:', data);
            setIsProcessing(false);
            setSessionId(null);
            toast.success(`Processing completed! Processed ${data.total_frames || 0} frames`);

            // Close WebSocket connection
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsProcessing(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Connection lost to video processing service');
        setIsProcessing(false);
        setSessionId(null);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  // Draw frame on canvas
  const drawFrame = (frameData, detections = [], roiZones = [], violations = [], trackingSummary = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      console.log('Drawing:', { detections: detections.length, roiZones: roiZones.length, violations: violations.length });

      // Draw ROI zones first (behind detections)
      roiZones.forEach((roi, index) => {
        drawROIZone(ctx, roi, index);
      });

      // Draw detections
      detections.forEach((detection, index) => {
        const { bbox, class_name, confidence } = detection;

        if (bbox) {
          let x, y, w, h;

          // Handle different bbox formats
          if (Array.isArray(bbox) && bbox.length === 4) {
            // Array format: [x, y, w, h]
            [x, y, w, h] = bbox;
          } else if (typeof bbox === 'object' && bbox.x1 !== undefined) {
            // Object format: {x1, y1, x2, y2, width, height}
            x = bbox.x1;
            y = bbox.y1;
            w = bbox.width || (bbox.x2 - bbox.x1);
            h = bbox.height || (bbox.y2 - bbox.y1);
          } else {
            console.warn('Unknown bbox format:', bbox);
            return;
          }

          // Set different colors for different classes
          const colors = {
            'hand': '#ff0000',      // Red
            'person': '#00ff00',    // Green
            'pizza': '#0000ff',     // Blue
            'scooper': '#ffff00'    // Yellow
          };

          const color = colors[class_name.toLowerCase()] || '#00ff00';

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, w, h);

          // Draw original bounding box (unchanged)
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);

          // Draw original label (unchanged)
          const label = `${class_name} ${(confidence * 100).toFixed(1)}%`;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          ctx.font = 'bold 11px Arial';
          const textWidth = ctx.measureText(label).width;
          ctx.fillRect(x, y - 28, textWidth + 10, 25);

          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, x + 5, y - 10);

          // ONLY ADD tracking information if object is tracked
          const isTracked = detection.track_id !== undefined;
          if (isTracked) {
            const centerX = x + w / 2;
            const centerY = y + h / 2;

            // Draw small track ID label below the main label
            const trackLabel = `[${detection.track_id.substring(0, 4)}]`;
            ctx.fillStyle = 'rgba(255, 255, 0, 0.8)'; // Yellow background
            ctx.font = 'bold 10px Arial';
            const trackTextWidth = ctx.measureText(trackLabel).width;
            ctx.fillRect(x, y - 3, trackTextWidth + 6, 15);

            ctx.fillStyle = '#000000'; // Black text
            ctx.fillText(trackLabel, x + 3, y + 8);

            // Draw center point
            ctx.fillStyle = '#ffff00'; // Yellow center point
            ctx.beginPath();
            ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
            ctx.fill();

            // Draw small cross at center
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX - 3, centerY);
            ctx.lineTo(centerX + 3, centerY);
            ctx.moveTo(centerX, centerY - 3);
            ctx.lineTo(centerX, centerY + 3);
            ctx.stroke();
          }
        }
      });

      // Draw violations (on top)
      violations.forEach((violation, index) => {
        drawViolation(ctx, violation, index);
      });

      // Display enhanced tracking info if available
      if (trackingSummary) {
        const summary = trackingSummary;
        const panelHeight = 120;

        // Draw tracking panel background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, 10, 320, panelHeight);

        // Draw border
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, 320, panelHeight);

        // Title
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🎯 Object Tracking Status', 20, 35);

        // Tracking stats
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        let yPos = 55;
        ctx.fillText(`Active Tracks: ${summary.active_tracks}`, 20, yPos);
        yPos += 18;
        ctx.fillText(`Total Created: ${summary.total_tracks_created}`, 20, yPos);
        yPos += 18;
        ctx.fillText(`Frame: ${summary.frame_count}`, 20, yPos);

        // Tracks by class
        if (summary.tracks_by_class) {
          ctx.fillStyle = '#ffff00';
          ctx.font = 'bold 12px Arial';
          let xPos = 180;
          yPos = 55;
          ctx.fillText('By Class:', xPos, yPos);
          ctx.fillStyle = '#ffffff';
          ctx.font = '11px Arial';
          yPos += 16;

          Object.entries(summary.tracks_by_class).forEach(([className, count]) => {
            ctx.fillText(`${className}: ${count}`, xPos, yPos);
            yPos += 14;
          });
        }
      }
    };

    img.src = `data:image/jpeg;base64,${frameData}`;
  };

  // Draw ROI zone on canvas with coordinate scaling
  const drawROIZone = (ctx, roi, index) => {
    try {
      console.log(`Drawing ROI ${index}:`, roi);

      // Use 1:1 coordinate system (no scaling needed)
      const scaleX = 1.0;
      const scaleY = 1.0;

      ctx.strokeStyle = '#00ff00'; // Green for ROI zones (more visible)
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]); // Dashed line
      ctx.globalAlpha = 0.7;

      // Handle backend format: roi.type and roi.coordinates
      const roiType = roi.type || roi.shape; // Support both formats
      const coordinates = roi.coordinates || [];

      if (roiType === 'rectangle' && coordinates.length >= 4) {
        // Rectangle ROI from coordinates array [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        const xCoords = coordinates.map(coord => coord[0]);
        const yCoords = coordinates.map(coord => coord[1]);
        const x = Math.min(...xCoords) * scaleX;
        const y = Math.min(...yCoords) * scaleY;
        const width = (Math.max(...xCoords) - Math.min(...xCoords)) * scaleX;
        const height = (Math.max(...yCoords) - Math.min(...yCoords)) * scaleY;

        console.log(`Rectangle ROI: x=${x}, y=${y}, width=${width}, height=${height}`);

        // Draw rectangle outline
        ctx.strokeRect(x, y, width, height);

        // Fill with semi-transparent color
        ctx.fillStyle = '#00ff00';
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x, y, width, height);
        ctx.globalAlpha = 0.7;

      } else if (roiType === 'polygon' && coordinates.length >= 3) {
        // Polygon ROI from coordinates array [[x1,y1], [x2,y2], ...]
        console.log(`Polygon ROI with ${coordinates.length} points:`, coordinates);

        ctx.beginPath();
        coordinates.forEach((coord, i) => {
          const px = coord[0] * scaleX;
          const py = coord[1] * scaleY;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.closePath();

        // Fill with semi-transparent color
        ctx.fillStyle = '#00ff00';
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 0.7;

        // Draw outline
        ctx.stroke();

      } else {
        console.warn(`Unknown ROI format:`, { type: roiType, coordinates: coordinates.length });
      }

      // Draw ROI label - scale label position too
      ctx.globalAlpha = 1.0;
      ctx.setLineDash([]); // Reset dash
      ctx.fillStyle = '#ffffff'; // White text for better visibility
      ctx.strokeStyle = '#000000'; // Black outline for text
      ctx.lineWidth = 1;
      ctx.font = 'bold 16px Arial';

      // Get label position from coordinates
      let labelX = 10, labelY = 30; // Default position
      if (coordinates && coordinates.length > 0) {
        labelX = coordinates[0][0] * scaleX;
        labelY = coordinates[0][1] * scaleY - 10;
      }

      // Draw text with outline for better visibility
      const labelText = roi.name || `ROI ${index + 1}`;
      ctx.strokeText(labelText, labelX, labelY);
      ctx.fillText(labelText, labelX, labelY);

    } catch (error) {
      console.error(`Error drawing ROI ${index}:`, error);
    }
  };

  // Draw violation indicator on canvas
  const drawViolation = (ctx, violation, index) => {
    // Draw violation alert
    ctx.strokeStyle = '#ff0000';
    ctx.fillStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.8;

    // Draw violation location if available
    if (violation.location && violation.location.x !== undefined) {
      const x = violation.location.x - 20;
      const y = violation.location.y - 20;

      // Draw warning triangle
      ctx.beginPath();
      ctx.moveTo(x + 20, y);
      ctx.lineTo(x, y + 35);
      ctx.lineTo(x + 40, y + 35);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      // Draw exclamation mark
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('!', x + 16, y + 25);
    }

    ctx.globalAlpha = 1.0;
  };

  // ROI Drawing Functions
  const openROIEditor = () => {
    if (!firstFrame) {
      toast.error('Please start video processing first to capture a frame for ROI drawing');
      return;
    }
    setShowROIEditor(true);
    setCurrentROI([]);
    setIsDrawing(false);

    // Draw first frame on ROI canvas
    setTimeout(() => {
      drawROICanvas();
    }, 100);
  };

  const drawROICanvas = useCallback(() => {
    const canvas = roiCanvasRef.current;
    if (!canvas || !firstFrame) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.drawImage(img, 0, 0);

      console.log('🎨 ROI Canvas dimensions:', { width: canvas.width, height: canvas.height });
      console.log('🖼️ ROI Image dimensions:', { width: img.width, height: img.height });
      console.log('📏 ROI Canvas display size:', {
        displayWidth: canvas.offsetWidth,
        displayHeight: canvas.offsetHeight
      });

      // Draw existing ROIs
      drawExistingROIs(ctx);

      // Draw current ROI being drawn
      if (currentROI.length > 0) {
        drawCurrentROI(ctx);
      }
    };

    img.src = `data:image/jpeg;base64,${firstFrame}`;
  }, [firstFrame, currentROI, savedROIs]);

  const drawExistingROIs = (ctx) => {
    savedROIs.forEach((roi, index) => {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (roi.type === 'rectangle') {
        const [start, end] = roi.points;
        const width = end.x - start.x;
        const height = end.y - start.y;
        ctx.strokeRect(start.x, start.y, width, height);
      } else if (roi.type === 'polygon') {
        ctx.beginPath();
        roi.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      // Draw ROI label
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 14px Arial';
      ctx.setLineDash([]);
      const labelX = roi.points[0].x;
      const labelY = roi.points[0].y - 10;
      ctx.fillText(`${roi.name} (${roi.type})`, labelX, labelY);
    });
  };

  const drawCurrentROI = (ctx) => {
    if (currentROI.length === 0) return;

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    if (roiMode === 'rectangle' && currentROI.length === 2) {
      const [start, end] = currentROI;
      const width = end.x - start.x;
      const height = end.y - start.y;
      ctx.strokeRect(start.x, start.y, width, height);

      // Draw corner points
      [start, end].forEach(point => {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx.fill();

        // White border for visibility
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
      });
    } else if (roiMode === 'polygon') {
      // Draw lines
      if (currentROI.length > 1) {
        ctx.beginPath();
        currentROI.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        if (currentROI.length > 2) {
          ctx.lineTo(currentROI[0].x, currentROI[0].y); // Close polygon preview
        }
        ctx.stroke();
      }

      // Draw points with better visibility
      currentROI.forEach((point, index) => {
        // White border
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI);
        ctx.fill();

        // Red center
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Point number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), point.x, point.y + 4);
      });
    }
  };

  // Get precise canvas coordinates accounting for scaling
  const getCanvasCoordinates = (e) => {
    const canvas = roiCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x: Math.round(x), y: Math.round(y) };
  };

  // Mouse event handlers for ROI drawing
  const handleCanvasMouseDown = (e) => {
    if (!isDrawing) return;

    const { x, y } = getCanvasCoordinates(e);
    console.log('Canvas click at:', { x, y });

    if (roiMode === 'rectangle') {
      if (currentROI.length === 0) {
        setCurrentROI([{ x, y }]);
      } else if (currentROI.length === 1) {
        setCurrentROI([...currentROI, { x, y }]);
        setIsDrawing(false);
      }
    } else if (roiMode === 'polygon') {
      setCurrentROI([...currentROI, { x, y }]);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || currentROI.length === 0) return;

    const { x, y } = getCanvasCoordinates(e);

    if (roiMode === 'rectangle' && currentROI.length === 1) {
      // Update rectangle preview
      const newROI = [currentROI[0], { x, y }];
      setCurrentROI(newROI);
      drawROICanvas();
    }
  };

  const handleCanvasDoubleClick = (e) => {
    if (roiMode === 'polygon' && currentROI.length >= 3) {
      // Finish polygon drawing
      setIsDrawing(false);
      console.log('Polygon completed with', currentROI.length, 'points');
    }
  };

  const finishPolygonDrawing = () => {
    if (roiMode === 'polygon' && currentROI.length >= 3) {
      setIsDrawing(false);
      console.log('Polygon drawing finished manually');
    }
  };

  const saveCurrentROI = () => {
    console.log('Attempting to save ROI:', {
      roiMode,
      currentROILength: currentROI.length,
      roiName: roiName.trim(),
      isDrawing
    });

    if (currentROI.length === 0 || !roiName.trim()) {
      toast.error('Please draw an ROI and enter a name');
      return;
    }

    if (roiMode === 'rectangle' && currentROI.length !== 2) {
      toast.error('Please complete the rectangle by clicking two points');
      return;
    }

    if (roiMode === 'polygon' && currentROI.length < 3) {
      toast.error('Please draw at least 3 points for a polygon');
      return;
    }

    // For polygon, automatically finish drawing if not already finished
    if (roiMode === 'polygon' && isDrawing && currentROI.length >= 3) {
      setIsDrawing(false);
    }

    const newROI = {
      id: Date.now(),
      name: roiName.trim(),
      type: roiMode,
      points: [...currentROI],
      created_at: new Date().toISOString()
    };

    console.log('Saving ROI:', newROI);

    setSavedROIs([...savedROIs, newROI]);
    setCurrentROI([]);
    setRoiName('');
    setIsDrawing(false);

    // Send ROI to backend
    sendROIToBackend(newROI);

    toast.success(`ROI "${newROI.name}" saved successfully`);
    drawROICanvas();
  };

  const sendROIToBackend = async (roi) => {
    try {
      let coordinates;

      if (roi.type === 'rectangle' && roi.points.length === 2) {
        // Rectangle format: convert to coordinate array
        const [point1, point2] = roi.points;
        coordinates = [
          [point1.x, point1.y],
          [point2.x, point1.y],
          [point2.x, point2.y],
          [point1.x, point2.y]
        ];
      } else if (roi.type === 'polygon' && roi.points.length >= 3) {
        // Polygon format: convert points to coordinate array
        coordinates = roi.points.map(p => [p.x, p.y]);
      } else {
        console.error('❌ Invalid ROI format:', roi);
        toast.error('Invalid ROI format - cannot save');
        return;
      }

      // ROI Manager expects simple format: name, coordinates, type
      const payload = {
        name: roi.name,
        coordinates: coordinates,
        type: roi.type
      };

      console.log('🚀 Sending ROI to backend:', payload);
      console.log('📊 Original ROI points:', roi.points);

      const response = await fetch('http://localhost:8004/rois', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📡 Backend response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ ROI sent to backend successfully:', result);
        toast.success(`ROI "${roi.name}" saved to backend`);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to send ROI to backend:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        toast.error(`Failed to save ROI to backend: ${response.status}`);
      }
    } catch (error) {
      console.error('💥 Error sending ROI to backend:', error);
      toast.error('Network error saving ROI to backend');
    }
  };

  const deleteROI = async (roiId) => {
    try {
      // Find the ROI to delete
      const roiToDelete = savedROIs.find(roi => roi.id === roiId);
      if (!roiToDelete) {
        toast.error('ROI not found');
        return;
      }

      // Delete from backend first
      const response = await fetch(`http://localhost:8004/rois/${roiToDelete.name}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from frontend state
        setSavedROIs(savedROIs.filter(roi => roi.id !== roiId));
        drawROICanvas();
        toast.success(`ROI "${roiToDelete.name}" deleted from backend and frontend`);

        // Force refresh of ROI data in live feed by reloading existing ROIs
        setTimeout(() => {
          loadExistingROIs();
        }, 500);
      } else {
        toast.error('Failed to delete ROI from backend');
      }
    } catch (error) {
      console.error('Error deleting ROI:', error);
      toast.error('Error deleting ROI');
    }
  };

  const clearAllROIs = async () => {
    try {
      // Delete all ROIs from backend
      const deletePromises = savedROIs.map(roi =>
        fetch(`http://localhost:8004/rois/${roi.name}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      // Clear frontend state
      setSavedROIs([]);
      setCurrentROI([]);
      setIsDrawing(false);
      drawROICanvas();
      toast.success('All ROIs cleared from backend and frontend');

      // Force refresh of ROI data in live feed
      setTimeout(() => {
        loadExistingROIs();
      }, 500);
    } catch (error) {
      console.error('Error clearing ROIs:', error);
      toast.error('Error clearing ROIs');
    }
  };

  return (
    <div className="simple-dashboard">
      <header className="dashboard-header">
        <h1>🍕 Pizza Store Detection System</h1>
        <p>Simple and clean video processing interface</p>
      </header>

      <div className="dashboard-content">
        {/* File Upload Section */}
        <div className="upload-section">
          <h2>📁 Select Video</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary"
            disabled={isProcessing}
          >
            Choose Video File
          </button>
          {selectedFile && (
            <p className="file-info">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}

          {/* FPS Control */}
          <div className="fps-control">
            <h3>⚡ Processing Speed Control</h3>
            <div className="fps-selector">
              <label htmlFor="fps-input">Frames Per Second (FPS):</label>
              <input
                id="fps-input"
                type="number"
                min="1"
                max="30"
                value={targetFPS}
                onChange={(e) => setTargetFPS(parseInt(e.target.value) || 5)}
                disabled={isProcessing}
                className="fps-input"
              />
              <span className="fps-info">
                {targetFPS === 1 && "🐌 Very Slow (1 FPS) - Best for detailed analysis"}
                {targetFPS >= 2 && targetFPS <= 5 && "🚶 Slow (2-5 FPS) - Good balance"}
                {targetFPS >= 6 && targetFPS <= 15 && "🏃 Medium (6-15 FPS) - Faster processing"}
                {targetFPS >= 16 && "⚡ Fast (16+ FPS) - Quick processing"}
              </span>
            </div>
            <p className="fps-description">
              💡 Lower FPS = More accurate violation detection, fewer duplicate violations<br/>
              💡 Higher FPS = Faster processing, but may detect same violation multiple times
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="controls-section">
          <h2>🎮 Controls</h2>
          <div className="button-group">
            <button
              onClick={startProcessing}
              disabled={!selectedFile || isProcessing}
              className="btn btn-success"
            >
              {isProcessing ? '⏳ Processing...' : '▶️ Start Processing'}
            </button>
            <button
              onClick={stopProcessing}
              disabled={!isProcessing}
              className="btn btn-danger"
            >
              ⏹️ Stop
            </button>
            <button
              onClick={openROIEditor}
              disabled={!firstFrame}
              className="btn btn-warning"
              title="Draw violation zones on the video frame"
            >
              🎯 Setup ROI Zones
            </button>
          </div>
        </div>

        {/* Service Health Status */}
        <div className="service-health-section">
          <h2>🏥 Service Health</h2>
          <div className="service-health-grid">
            {Object.entries(serviceHealth).map(([serviceName, health]) => (
              <div key={serviceName} className={`service-status ${health.status}`}>
                <span className="service-name">{serviceName}:</span>
                <span className={`status-indicator ${health.status}`}>
                  {health.status === 'healthy' ? '✅' : health.status === 'offline' ? '❌' : '⚠️'}
                  {health.status}
                </span>
                {health.error && (
                  <span className="error-detail" title={health.error}>⚠️</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="stats-section">
          <h2>📊 Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Frames:</span>
              <span className="stat-value">{stats.frames}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Detections:</span>
              <span className="stat-value">{stats.detections}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Violations:</span>
              <span className="stat-value">{stats.violations}</span>
            </div>
          </div>
        </div>

        {/* Video Display */}
        <div className="video-section">
          <h2>🎥 Live Video Feed</h2>
          <div className="video-container">
            <canvas
              ref={canvasRef}
              className="video-canvas"
              style={{
                maxWidth: '100%',
                height: 'auto',
                border: '2px solid #ddd',
                borderRadius: '8px'
              }}
            />
            {!currentFrame && (
              <div className="no-video">
                <p>No video feed</p>
                <p>Select a video and start processing to see live feed</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Violations */}
        {violations.length > 0 && (
          <div className="violations-section">
            <h2>⚠️ Recent Violations</h2>
            <div className="violations-list">
              {violations.slice(-5).map((violation, index) => (
                <div key={index} className="violation-item">
                  <span className="violation-time">
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="violation-desc">{violation.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ROI Editor Modal */}
      {showROIEditor && (
        <div className="roi-modal-overlay">
          <div className="roi-modal">
            <div className="roi-modal-header">
              <h2>🎯 ROI Zone Editor</h2>
              <button
                onClick={() => setShowROIEditor(false)}
                className="btn btn-close"
              >
                ✕
              </button>
            </div>

            <div className="roi-modal-content">
              <div className="roi-controls">
                <div className="roi-mode-selector">
                  <label>Drawing Mode:</label>
                  <select
                    value={roiMode}
                    onChange={(e) => setRoiMode(e.target.value)}
                    disabled={isDrawing}
                  >
                    <option value="polygon">Polygon (Sauce Area)</option>
                    <option value="rectangle">Rectangle (Simple Zone)</option>
                  </select>
                </div>

                <div className="roi-name-input">
                  <label>Zone Name:</label>
                  <input
                    type="text"
                    value={roiName}
                    onChange={(e) => setRoiName(e.target.value)}
                    placeholder="e.g., Sauce Container, Protein Area"
                    disabled={isDrawing}
                  />
                </div>

                <div className="roi-drawing-controls">
                  {!isDrawing ? (
                    <button
                      onClick={() => setIsDrawing(true)}
                      className="btn btn-primary"
                      disabled={!roiName.trim()}
                    >
                      🖊️ Start Drawing
                    </button>
                  ) : (
                    <div className="drawing-instructions">
                      {roiMode === 'polygon' ? (
                        <p>📍 Click to add points ({currentROI.length} points).
                           {currentROI.length >= 3 ? ' Ready to finish!' : ' Need at least 3 points.'}</p>
                      ) : (
                        <p>📍 Click two corners to create rectangle.</p>
                      )}
                      <div className="drawing-buttons">
                        <button
                          onClick={() => setIsDrawing(false)}
                          className="btn btn-secondary"
                        >
                          Cancel Drawing
                        </button>
                        {roiMode === 'polygon' && currentROI.length >= 3 && (
                          <button
                            onClick={finishPolygonDrawing}
                            className="btn btn-success"
                          >
                            ✅ Finish Polygon
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {currentROI.length > 0 && (
                    <button
                      onClick={saveCurrentROI}
                      className="btn btn-success"
                      disabled={isDrawing || (roiMode === 'polygon' && currentROI.length < 3) || (roiMode === 'rectangle' && currentROI.length < 2)}
                      title={
                        isDrawing ? 'Finish drawing first' :
                        roiMode === 'polygon' && currentROI.length < 3 ? 'Need at least 3 points' :
                        roiMode === 'rectangle' && currentROI.length < 2 ? 'Need 2 points for rectangle' :
                        'Save this ROI zone'
                      }
                    >
                      💾 Save ROI {roiMode === 'polygon' ? `(${currentROI.length} points)` : ''}
                    </button>
                  )}
                </div>
              </div>

              <div className="roi-canvas-container">
                <canvas
                  ref={roiCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onDoubleClick={handleCanvasDoubleClick}
                  style={{
                    cursor: isDrawing ? 'crosshair' : 'default',
                    border: '2px solid #ccc',
                    maxWidth: '800px',
                    maxHeight: '600px',
                    objectFit: 'contain'
                  }}
                />
              </div>

              {savedROIs.length > 0 && (
                <div className="saved-rois">
                  <h3>📋 Saved ROI Zones ({savedROIs.length})</h3>
                  <div className="roi-list">
                    {savedROIs.map((roi) => (
                      <div key={roi.id} className="roi-item">
                        <span className="roi-info">
                          <strong>{roi.name}</strong> ({roi.type})
                          <small>{roi.points.length} points</small>
                        </span>
                        <button
                          onClick={() => deleteROI(roi.id)}
                          className="btn btn-danger btn-small"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={clearAllROIs}
                    className="btn btn-warning"
                  >
                    🗑️ Clear All ROIs
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleDashboard;
