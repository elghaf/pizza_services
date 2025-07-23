#!/usr/bin/env python3
"""
Enhanced Violation Detection Configuration
Fine-tuned parameters for detecting hand-food contact without scooper
"""

# Temporal Analysis Settings
TEMPORAL_WINDOW_SECONDS = 5  # Look back 5 seconds for scooper presence
RECENT_FRAMES_CHECK = 5      # Check last 5 frames for scooper
SCOOPER_MEMORY_FACTOR = 1.5  # Allow 50% larger proximity in recent frames

# Hand-Food Contact Detection
ROI_DEPTH_THRESHOLD = 0.3    # Hand must be 30% deep into ROI to count as "touching"
INTERACTION_MOVEMENT_MIN = 1 # Minimum direction changes for interaction
ACTIVE_MOVEMENT_MIN = 10     # Minimum movement to be considered "active"

# Scooper Proximity Settings  
SCOOPER_PROXIMITY_CURRENT = 100.0   # Pixels for current frame
SCOOPER_PROXIMITY_RECENT = 150.0    # Pixels for recent frames (more lenient)

# Violation Confidence Thresholds
HIGH_CONFIDENCE_THRESHOLD = 0.8     # Clear violation
MEDIUM_CONFIDENCE_THRESHOLD = 0.5   # Likely violation
LOW_CONFIDENCE_THRESHOLD = 0.3      # Possible violation

# Movement Pattern Analysis
GRABBING_MOVEMENT_MIN = 15          # Minimum movement for grabbing action
CLEANING_DIRECTION_CHANGES = 3      # Direction changes indicating cleaning
IDLE_MOVEMENT_MAX = 5               # Maximum movement for idle state

# Professional Settings
VIOLATION_COOLDOWN_SECONDS = 3.0    # Prevent duplicate violations
SPATIAL_DEDUPLICATION_THRESHOLD = 50 # Pixels for spatial deduplication
CONTINUOUS_VIOLATION_WINDOW = 60    # Seconds to prevent spam

# Enhanced Detection Features
ENABLE_TEMPORAL_SCOOPER_CHECK = True    # Check recent frames for scooper
ENABLE_FOOD_CONTACT_ANALYSIS = True     # Analyze hand-food contact depth
ENABLE_MOVEMENT_CLASSIFICATION = True   # Classify hand movements
ENABLE_WORKER_ASSOCIATION = True       # Associate hands with workers

# Logging and Debug
DETAILED_VIOLATION_LOGGING = True      # Log detailed violation analysis
MOVEMENT_PATTERN_LOGGING = True        # Log movement patterns
SCOOPER_DETECTION_LOGGING = True       # Log scooper detection details

def get_enhanced_config():
    """Get enhanced detection configuration"""
    return {
        'temporal': {
            'window_seconds': TEMPORAL_WINDOW_SECONDS,
            'recent_frames_check': RECENT_FRAMES_CHECK,
            'scooper_memory_factor': SCOOPER_MEMORY_FACTOR
        },
        'contact_detection': {
            'roi_depth_threshold': ROI_DEPTH_THRESHOLD,
            'interaction_movement_min': INTERACTION_MOVEMENT_MIN,
            'active_movement_min': ACTIVE_MOVEMENT_MIN
        },
        'proximity': {
            'scooper_current': SCOOPER_PROXIMITY_CURRENT,
            'scooper_recent': SCOOPER_PROXIMITY_RECENT
        },
        'confidence': {
            'high': HIGH_CONFIDENCE_THRESHOLD,
            'medium': MEDIUM_CONFIDENCE_THRESHOLD,
            'low': LOW_CONFIDENCE_THRESHOLD
        },
        'movement': {
            'grabbing_min': GRABBING_MOVEMENT_MIN,
            'cleaning_changes': CLEANING_DIRECTION_CHANGES,
            'idle_max': IDLE_MOVEMENT_MAX
        },
        'professional': {
            'cooldown_seconds': VIOLATION_COOLDOWN_SECONDS,
            'spatial_threshold': SPATIAL_DEDUPLICATION_THRESHOLD,
            'continuous_window': CONTINUOUS_VIOLATION_WINDOW
        },
        'features': {
            'temporal_scooper_check': ENABLE_TEMPORAL_SCOOPER_CHECK,
            'food_contact_analysis': ENABLE_FOOD_CONTACT_ANALYSIS,
            'movement_classification': ENABLE_MOVEMENT_CLASSIFICATION,
            'worker_association': ENABLE_WORKER_ASSOCIATION
        },
        'logging': {
            'detailed_violations': DETAILED_VIOLATION_LOGGING,
            'movement_patterns': MOVEMENT_PATTERN_LOGGING,
            'scooper_detection': SCOOPER_DETECTION_LOGGING
        }
    }

# Quick configuration presets
STRICT_MODE = {
    'roi_depth_threshold': 0.5,      # Must be deep in ROI
    'scooper_proximity_current': 80,  # Closer scooper required
    'violation_cooldown': 1.0        # Less cooldown (more sensitive)
}

LENIENT_MODE = {
    'roi_depth_threshold': 0.2,      # Edge contact counts
    'scooper_proximity_current': 150, # Further scooper allowed
    'violation_cooldown': 5.0        # More cooldown (less sensitive)
}

BALANCED_MODE = {
    'roi_depth_threshold': 0.3,      # Moderate depth required
    'scooper_proximity_current': 100, # Standard proximity
    'violation_cooldown': 3.0        # Standard cooldown
}
