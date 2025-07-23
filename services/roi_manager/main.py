#!/usr/bin/env python3
"""
ROI Manager Service - Port 8004
Manages Region of Interest (ROI) zones for pizza store violation detection
"""

import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
ROI_DB_PATH = os.path.join(os.path.dirname(__file__), 'roi_database.db')
PORT = int(os.environ.get('ROI_MANAGER_PORT', 8004))

class ROIManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the ROI database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS rois (
                        id TEXT PRIMARY KEY,
                        name TEXT UNIQUE NOT NULL,
                        type TEXT NOT NULL,
                        coordinates TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                ''')
                conn.commit()
                logger.info(f"ROI database initialized at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def save_roi(self, roi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a new ROI to the database"""
        try:
            roi_id = str(uuid.uuid4())
            name = roi_data.get('name', f'ROI_{roi_id[:8]}')
            roi_type = roi_data.get('type', 'polygon')
            coordinates = json.dumps(roi_data.get('coordinates', []))
            created_at = datetime.now().isoformat()
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO rois (id, name, type, coordinates, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (roi_id, name, roi_type, coordinates, created_at, created_at))
                conn.commit()
            
            logger.info(f"ROI saved: {name} ({roi_type})")
            return {
                'id': roi_id,
                'name': name,
                'type': roi_type,
                'coordinates': roi_data.get('coordinates', []),
                'created_at': created_at,
                'updated_at': created_at
            }
        except sqlite3.IntegrityError:
            raise ValueError(f"ROI with name '{name}' already exists")
        except Exception as e:
            logger.error(f"Failed to save ROI: {e}")
            raise
    
    def get_all_rois(self) -> List[Dict[str, Any]]:
        """Get all ROIs from the database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id, name, type, coordinates, created_at, updated_at FROM rois')
                rows = cursor.fetchall()
            
            rois = []
            for row in rows:
                roi = {
                    'id': row[0],
                    'name': row[1],
                    'type': row[2],
                    'coordinates': json.loads(row[3]),
                    'created_at': row[4],
                    'updated_at': row[5]
                }
                rois.append(roi)
            
            logger.info(f"Retrieved {len(rois)} ROIs")
            return rois
        except Exception as e:
            logger.error(f"Failed to get ROIs: {e}")
            raise
    
    def get_roi_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a specific ROI by name"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id, name, type, coordinates, created_at, updated_at FROM rois WHERE name = ?', (name,))
                row = cursor.fetchone()
            
            if row:
                return {
                    'id': row[0],
                    'name': row[1],
                    'type': row[2],
                    'coordinates': json.loads(row[3]),
                    'created_at': row[4],
                    'updated_at': row[5]
                }
            return None
        except Exception as e:
            logger.error(f"Failed to get ROI {name}: {e}")
            raise
    
    def delete_roi(self, name: str) -> bool:
        """Delete an ROI by name"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM rois WHERE name = ?', (name,))
                deleted = cursor.rowcount > 0
                conn.commit()
            
            if deleted:
                logger.info(f"ROI deleted: {name}")
            else:
                logger.warning(f"ROI not found for deletion: {name}")
            
            return deleted
        except Exception as e:
            logger.error(f"Failed to delete ROI {name}: {e}")
            raise
    
    def clear_all_rois(self) -> int:
        """Clear all ROIs from the database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT COUNT(*) FROM rois')
                count = cursor.fetchone()[0]
                cursor.execute('DELETE FROM rois')
                conn.commit()
            
            logger.info(f"Cleared {count} ROIs")
            return count
        except Exception as e:
            logger.error(f"Failed to clear ROIs: {e}")
            raise

# Initialize ROI Manager
roi_manager = ROIManager(ROI_DB_PATH)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'roi_manager',
        'port': PORT,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/rois', methods=['GET'])
def get_rois():
    """Get all ROIs"""
    try:
        rois = roi_manager.get_all_rois()
        return jsonify({
            'success': True,
            'data': rois,
            'count': len(rois)
        })
    except Exception as e:
        logger.error(f"Error getting ROIs: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/rois', methods=['POST'])
def create_roi():
    """Create a new ROI"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate required fields
        if 'name' not in data or 'coordinates' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: name, coordinates'
            }), 400
        
        roi = roi_manager.save_roi(data)
        return jsonify({
            'success': True,
            'data': roi,
            'message': f'ROI "{roi["name"]}" created successfully'
        }), 201
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 409
    except Exception as e:
        logger.error(f"Error creating ROI: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/rois/<name>', methods=['GET'])
def get_roi(name):
    """Get a specific ROI by name"""
    try:
        roi = roi_manager.get_roi_by_name(name)
        if roi:
            return jsonify({
                'success': True,
                'data': roi
            })
        else:
            return jsonify({
                'success': False,
                'error': f'ROI "{name}" not found'
            }), 404
    except Exception as e:
        logger.error(f"Error getting ROI {name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/rois/<name>', methods=['DELETE'])
def delete_roi(name):
    """Delete a specific ROI by name"""
    try:
        deleted = roi_manager.delete_roi(name)
        if deleted:
            return jsonify({
                'success': True,
                'message': f'ROI "{name}" deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': f'ROI "{name}" not found'
            }), 404
    except Exception as e:
        logger.error(f"Error deleting ROI {name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/rois/clear', methods=['DELETE'])
def clear_all_rois():
    """Clear all ROIs"""
    try:
        count = roi_manager.clear_all_rois()
        return jsonify({
            'success': True,
            'message': f'Cleared {count} ROIs',
            'count': count
        })
    except Exception as e:
        logger.error(f"Error clearing ROIs: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    logger.info(f"🚀 Starting ROI Manager Service on port {PORT}")
    logger.info(f"📁 Database path: {ROI_DB_PATH}")
    
    try:
        app.run(host='0.0.0.0', port=PORT, debug=False)
    except Exception as e:
        logger.error(f"Failed to start ROI Manager Service: {e}")
        raise
