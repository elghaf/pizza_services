#!/usr/bin/env python3
"""
API Gateway Service - Port 8000
Central API gateway for pizza store detection system
Handles video uploads and routes requests to appropriate microservices
"""

import os
import logging
import requests
import tempfile
from datetime import datetime
from typing import Dict, Any
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configuration
PORT = int(os.environ.get('API_GATEWAY_PORT', 8000))
# Save uploaded videos to the project's videos directory that frame reader expects
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))  # Go up to project root
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'videos')
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}

# Service endpoints
SERVICES = {
    'frame_reader': 'http://localhost:8001',
    'detection': 'http://localhost:8002',
    'violation_detector': 'http://localhost:8003',
    'roi_manager': 'http://localhost:8004',
    'database': 'http://localhost:8005',
    'message_broker': 'http://localhost:8010'
}

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def proxy_request(service_name: str, path: str, method: str = 'GET', **kwargs):
    """Proxy request to a microservice"""
    if service_name not in SERVICES:
        raise ValueError(f"Unknown service: {service_name}")
    
    url = f"{SERVICES[service_name]}{path}"
    
    try:
        response = requests.request(method, url, timeout=30, **kwargs)
        return response
    except requests.exceptions.RequestException as e:
        logger.error(f"Error proxying to {service_name}: {e}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    # Check health of all services
    service_health = {}
    for service_name, service_url in SERVICES.items():
        try:
            response = requests.get(f"{service_url}/health", timeout=5)
            service_health[service_name] = {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'response_time': response.elapsed.total_seconds()
            }
        except Exception as e:
            service_health[service_name] = {
                'status': 'unhealthy',
                'error': str(e)
            }
    
    return jsonify({
        'status': 'healthy',
        'service': 'api_gateway',
        'port': PORT,
        'timestamp': datetime.now().isoformat(),
        'services': service_health
    })

@app.route('/api/upload', methods=['POST'])
def upload_video():
    """Upload video file and start processing"""
    try:
        # Check if file is present
        if 'video' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No video file provided'
            }), 400
        
        file = request.files['video']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Check file extension
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        filename = f"{file_id}.{file_extension}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Save file
        file.save(filepath)
        file_size = os.path.getsize(filepath)
        
        logger.info(f"Video uploaded: {original_filename} -> {filename} ({file_size} bytes)")
        
        # Get additional parameters
        fps = request.form.get('fps', 10)
        roi_zones = request.form.get('roi_zones', '[]')
        
        # Start processing by sending to frame reader
        try:
            # Create VideoSource object for frame reader
            # Frame reader expects just the filename, it will look in the videos directory
            video_source = {
                'source_type': 'file',
                'source_path': filename,  # Just the filename, not full path
                'fps': int(fps),
                'resolution': [1920, 1080],  # Default resolution
                'session_id': file_id
            }

            # Send to frame reader service
            response = proxy_request(
                'frame_reader',
                '/start',
                method='POST',
                json=video_source
            )
            
            if response.status_code == 200:
                result = response.json()
                return jsonify({
                    'success': True,
                    'message': 'Video uploaded and processing started',
                    'data': {
                        'video_id': file_id,
                        'original_filename': original_filename,
                        'file_size': file_size,
                        'processing_status': result.get('status', 'started')
                    }
                })
            else:
                # Clean up uploaded file if processing failed
                if os.path.exists(filepath):
                    os.remove(filepath)
                
                return jsonify({
                    'success': False,
                    'error': 'Failed to start video processing',
                    'details': response.text
                }), 500
        
        except Exception as e:
            # Clean up uploaded file if processing failed
            if os.path.exists(filepath):
                os.remove(filepath)
            
            logger.error(f"Error starting video processing: {e}")
            return jsonify({
                'success': False,
                'error': 'Failed to start video processing',
                'details': str(e)
            }), 500
    
    except Exception as e:
        logger.error(f"Error uploading video: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/api/videos/<video_id>/status', methods=['GET'])
def get_video_status(video_id):
    """Get processing status of a video"""
    try:
        # Query frame reader for general status (frame reader doesn't have per-video status)
        response = proxy_request('frame_reader', '/status')

        if response.status_code == 200:
            status_data = response.json()
            # Add video_id to the response
            status_data['video_id'] = video_id
            return jsonify({
                'success': True,
                'data': status_data
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Unable to get processing status'
            }), 500

    except Exception as e:
        logger.error(f"Error getting video status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/videos/<video_id>/results', methods=['GET'])
def get_video_results(video_id):
    """Get processing results for a video"""
    try:
        # Query database service for results
        response = proxy_request('database', f'/violations/video/{video_id}')
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({
                'success': False,
                'error': 'No results found for this video'
            }), 404
    
    except Exception as e:
        logger.error(f"Error getting video results: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Proxy endpoints for other services
@app.route('/api/rois', methods=['GET', 'POST'])
@app.route('/api/rois/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_roi_manager(path=''):
    """Proxy requests to ROI Manager service"""
    try:
        endpoint = f"/rois/{path}" if path else "/rois"
        response = proxy_request(
            'roi_manager',
            endpoint,
            method=request.method,
            json=request.get_json() if request.is_json else None,
            params=request.args
        )
        
        return jsonify(response.json()), response.status_code
    
    except Exception as e:
        logger.error(f"Error proxying to ROI manager: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/violations', methods=['GET'])
@app.route('/api/violations/<path:path>', methods=['GET'])
def proxy_database_violations(path=''):
    """Proxy violation requests to Database service"""
    try:
        endpoint = f"/violations/{path}" if path else "/violations"
        response = proxy_request(
            'database',
            endpoint,
            method=request.method,
            params=request.args
        )
        
        return jsonify(response.json()), response.status_code
    
    except Exception as e:
        logger.error(f"Error proxying to database: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/system/status', methods=['GET'])
def system_status():
    """Get overall system status"""
    try:
        status = {
            'timestamp': datetime.now().isoformat(),
            'services': {}
        }
        
        for service_name, service_url in SERVICES.items():
            try:
                response = requests.get(f"{service_url}/health", timeout=5)
                status['services'][service_name] = {
                    'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                    'url': service_url,
                    'response_time': response.elapsed.total_seconds()
                }
            except Exception as e:
                status['services'][service_name] = {
                    'status': 'unhealthy',
                    'url': service_url,
                    'error': str(e)
                }
        
        # Calculate overall health
        healthy_services = sum(1 for s in status['services'].values() if s['status'] == 'healthy')
        total_services = len(status['services'])
        
        status['overall'] = {
            'status': 'healthy' if healthy_services == total_services else 'degraded',
            'healthy_services': healthy_services,
            'total_services': total_services,
            'health_percentage': (healthy_services / total_services) * 100
        }
        
        return jsonify(status)
    
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    logger.info(f"🚀 Starting API Gateway Service on port {PORT}")
    logger.info(f"📁 Upload folder: {UPLOAD_FOLDER}")
    logger.info(f"🔗 Configured services: {list(SERVICES.keys())}")
    
    try:
        app.run(host='0.0.0.0', port=PORT, debug=False)
    except Exception as e:
        logger.error(f"Failed to start API Gateway Service: {e}")
        raise
