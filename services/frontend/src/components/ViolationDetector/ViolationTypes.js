/**
 * Violation Types Configuration
 * Defines all violation types with their visual and behavioral properties
 */

export const violationTypes = {
  HAND_IN_INGREDIENT_NO_SCOOPER: {
    severity: 'high',
    color: '#FF3333',
    icon: '🚨',
    title: 'Hand Contact Without Scooper',
    description: 'Hand detected in ingredient area without scooper present',
    priority: 1,
    alertSound: true,
    requiresImmedateAction: true,
    category: 'hygiene'
  },
  CROSS_CONTAMINATION: {
    severity: 'high', 
    color: '#FF6B35',
    icon: '⚠️',
    title: 'Cross Contamination Risk',
    description: 'Hand moved between different ingredient areas without cleaning',
    priority: 2,
    alertSound: true,
    requiresImmedateAction: true,
    category: 'hygiene'
  },
  IMPROPER_TOOL_USE: {
    severity: 'medium',
    color: '#FFD23F',
    icon: '🥄',
    title: 'Improper Tool Usage',
    description: 'Scooper used incorrectly or in wrong area',
    priority: 3,
    alertSound: false,
    requiresImmedateAction: false,
    category: 'procedure'
  },
  EXTENDED_CONTACT: {
    severity: 'medium',
    color: '#FF8C42',
    icon: '⏱️',
    title: 'Extended Hand Contact',
    description: 'Hand in ingredient area for extended period',
    priority: 4,
    alertSound: false,
    requiresImmedateAction: false,
    category: 'procedure'
  }
};

/**
 * Get violation type configuration by key
 * @param {string} violationType - The violation type key
 * @returns {object} Violation type configuration
 */
export const getViolationType = (violationType) => {
  return violationTypes[violationType] || null;
};

/**
 * Get all available violation type keys
 * @returns {string[]} Array of violation type keys
 */
export const getViolationTypeKeys = () => {
  return Object.keys(violationTypes);
};

/**
 * Get violation types by severity level
 * @param {string} severity - Severity level ('high', 'medium', 'low')
 * @returns {object} Violation types with the specified severity
 */
export const getViolationTypesBySeverity = (severity) => {
  return Object.fromEntries(
    Object.entries(violationTypes).filter(([key, config]) => config.severity === severity)
  );
};

/**
 * Get violation types by category
 * @param {string} category - Category ('hygiene', 'procedure', 'safety')
 * @returns {object} Violation types in the specified category
 */
export const getViolationTypesByCategory = (category) => {
  return Object.fromEntries(
    Object.entries(violationTypes).filter(([key, config]) => config.category === category)
  );
};

/**
 * Get high priority violation types
 * @returns {object} High priority violation types
 */
export const getHighPriorityViolationTypes = () => {
  return Object.fromEntries(
    Object.entries(violationTypes).filter(([key, config]) => config.priority <= 2)
  );
};

/**
 * Get violation types that require immediate action
 * @returns {object} Violation types requiring immediate action
 */
export const getImmediateActionViolationTypes = () => {
  return Object.fromEntries(
    Object.entries(violationTypes).filter(([key, config]) => config.requiresImmedateAction)
  );
};

/**
 * Get violation types that should trigger alert sounds
 * @returns {object} Violation types with alert sounds
 */
export const getAlertSoundViolationTypes = () => {
  return Object.fromEntries(
    Object.entries(violationTypes).filter(([key, config]) => config.alertSound)
  );
};

/**
 * Create a new violation object
 * @param {string} type - Violation type key
 * @param {object} data - Additional violation data
 * @returns {object} Complete violation object
 */
export const createViolation = (type, data) => {
  const config = violationTypes[type];
  if (!config) {
    throw new Error(`Unknown violation type: ${type}`);
  }

  return {
    id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    severity: config.severity,
    confidence: data.confidence || 0.8,
    description: config.description,
    title: config.title,
    icon: config.icon,
    color: config.color,
    priority: config.priority,
    category: config.category,
    requiresImmedateAction: config.requiresImmedateAction,
    alertSound: config.alertSound,
    details: data,
    resolved: false,
    acknowledgedBy: null,
    acknowledgedAt: null
  };
};

/**
 * Get violation severity color
 * @param {string} severity - Severity level
 * @returns {string} Color code for the severity
 */
export const getSeverityColor = (severity) => {
  const colors = {
    'high': '#FF3333',
    'medium': '#FFD23F',
    'low': '#2ED573'
  };
  return colors[severity] || colors['medium'];
};

/**
 * Get violation category icon
 * @param {string} category - Category name
 * @returns {string} Icon for the category
 */
export const getCategoryIcon = (category) => {
  const icons = {
    'hygiene': '🧼',
    'procedure': '📋',
    'safety': '🛡️'
  };
  return icons[category] || '⚠️';
};

/**
 * Validate violation data
 * @param {object} violation - Violation object to validate
 * @returns {object} Validation result { isValid, errors }
 */
export const validateViolation = (violation) => {
  const errors = [];

  if (!violation.type || !violationTypes[violation.type]) {
    errors.push('Invalid or missing violation type');
  }

  if (!violation.confidence || violation.confidence < 0 || violation.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }

  if (!violation.timestamp) {
    errors.push('Missing timestamp');
  }

  if (!violation.details || typeof violation.details !== 'object') {
    errors.push('Missing or invalid violation details');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export default violationTypes;
