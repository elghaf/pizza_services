/**
 * Zone Types Configuration for ROI Zone Manager
 * Defines all available zone types with their visual and behavioral properties
 */

export const zoneTypes = {
  sauce_area: {
    name: 'Sauce Area',
    color: '#FF6B35',
    fillColor: 'rgba(255, 107, 53, 0.2)',
    requiresScooper: true,
    icon: '🍅',
    description: 'Sauce dispensing and handling area',
    preferredShape: 'polygon' // Sauce areas work better with polygons
  },
  cheese_area: {
    name: 'Cheese Area',
    color: '#FFD23F',
    fillColor: 'rgba(255, 210, 63, 0.2)',
    requiresScooper: true,
    icon: '🧀',
    description: 'Cheese container and handling area',
    preferredShape: 'rectangle' // Cheese containers are usually rectangular
  },
  meat_area: {
    name: 'Meat/Protein Area',
    color: '#FF4757',
    fillColor: 'rgba(255, 71, 87, 0.2)',
    requiresScooper: true,
    icon: '🥓',
    description: 'Meat and protein ingredient area'
  },
  vegetable_area: {
    name: 'Vegetable Area',
    color: '#2ED573',
    fillColor: 'rgba(46, 213, 115, 0.2)',
    requiresScooper: true,
    icon: '🥬',
    description: 'Vegetable and fresh ingredient area'
  },
  prep_surface: {
    name: 'Prep Surface',
    color: '#5352ED',
    fillColor: 'rgba(83, 82, 237, 0.2)',
    requiresScooper: false,
    icon: '🍕',
    description: 'Pizza preparation surface (no scooper required)'
  },
  cleaning_area: {
    name: 'Cleaning Area',
    color: '#00D2D3',
    fillColor: 'rgba(0, 210, 211, 0.2)',
    requiresScooper: false,
    icon: '🧽',
    description: 'Cleaning and sanitization area'
  }
};

/**
 * Get zone type configuration by key
 * @param {string} zoneTypeKey - The zone type key
 * @returns {object} Zone type configuration
 */
export const getZoneType = (zoneTypeKey) => {
  return zoneTypes[zoneTypeKey] || null;
};

/**
 * Get all available zone type keys
 * @returns {string[]} Array of zone type keys
 */
export const getZoneTypeKeys = () => {
  return Object.keys(zoneTypes);
};

/**
 * Get zone types that require scooper
 * @returns {object} Zone types that require scooper
 */
export const getScoopeRequiredZoneTypes = () => {
  return Object.fromEntries(
    Object.entries(zoneTypes).filter(([key, config]) => config.requiresScooper)
  );
};

/**
 * Get zone types by preferred shape
 * @param {string} shape - The preferred shape ('polygon' or 'rectangle')
 * @returns {object} Zone types with the specified preferred shape
 */
export const getZoneTypesByShape = (shape) => {
  return Object.fromEntries(
    Object.entries(zoneTypes).filter(([key, config]) => config.preferredShape === shape)
  );
};

export default zoneTypes;
