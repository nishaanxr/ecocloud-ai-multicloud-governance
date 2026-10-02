/**
 * Carbon Intensity Retrieval Tool
 * Modular tool interface to fetch verified grid carbon intensity.
 * Used by deterministic services and registered for Gemini agent tool-calling.
 */

const { getCarbonIntensity } = require('../carbon/carbonProvider');

/**
 * Get carbon intensity for a specific cloud and region
 * @param {string} cloud - 'AWS' | 'Azure' | 'GCP'
 * @param {string} region - Regional identifier
 * @returns {Promise<Object>} Carbon intensity data with provenance
 */
async function fetchCarbonIntensity(cloud, region) {
  return await getCarbonIntensity(cloud, region);
}

module.exports = {
  fetchCarbonIntensity
};
