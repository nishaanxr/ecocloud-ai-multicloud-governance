/**
 * Carbon Intensity Provider
 * Retrieves grid carbon intensity (gCO2eq/kWh) across multi-cloud regions.
 * Supports live real-time querying via Electricity Maps API if ELECTRICITY_MAPS_API_KEY is configured.
 * Transparent fallback to Cloud Carbon Footprint (CCF) / CEA & EPA eGRID reference dataset.
 */

const { findRegionByProviderCode, REGIONS_CONFIG } = require('../config/regions');

// In-memory cache for carbon intensity (TTL: 30 minutes)
const carbonCache = new Map();
const CARBON_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Get carbon intensity for a specific cloud and region
 * @param {string} cloud 'AWS' | 'Azure' | 'GCP'
 * @param {string} region Provider region code
 * @returns {Promise<Object>} Carbon intensity data with provenance
 */
async function getCarbonIntensity(cloud, region) {
  const normCloud = (cloud || 'AWS').toLowerCase();
  const normRegion = (region || '').toLowerCase();

  const lookup = findRegionByProviderCode(normCloud, normRegion);
  const geo = lookup ? lookup.geo : REGIONS_CONFIG.india;
  const provConfig = lookup ? lookup.providerConfig : { regionCode: normRegion };
  const zone = provConfig.electricityMapsZone || 'IN-WE';

  const cacheKey = `${normCloud}_${normRegion}_${zone}`;
  const cached = carbonCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CARBON_CACHE_TTL_MS)) {
    return cached.data;
  }

  // Attempt live query if Electricity Maps API key is configured
  const apiKey = process.env.ELECTRICITY_MAPS_API_KEY;
  if (apiKey) {
    try {
      const url = `https://api.electricitymaps.com/v3/carbon-intensity/latest?zone=${zone}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        headers: { 'auth-token': apiKey },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const liveIntensity = json.carbonIntensity;
        if (typeof liveIntensity === 'number') {
          const liveData = {
            cloud: cloud.toUpperCase(),
            region: provConfig.regionCode,
            location: provConfig.locationName || geo.name,
            dataResidency: geo.dataResidency,
            gridZone: zone,
            carbonIntensity: liveIntensity,
            unit: 'gCO2eq/kWh',
            source: 'Electricity Maps API (Real-Time Grid Carbon)',
            status: 'live',
            fetchedAt: new Date().toISOString()
          };
          carbonCache.set(cacheKey, { timestamp: Date.now(), data: liveData });
          return liveData;
        }
      }
    } catch (err) {
      console.warn(`[Carbon Provider] Live query to Electricity Maps failed: ${err.message}. Using CCF reference benchmark.`);
    }
  }

  // Reference Benchmark from Cloud Carbon Footprint (CCF) & CEA / EPA eGRID methodology
  const benchmarkData = {
    cloud: cloud.toUpperCase(),
    region: provConfig.regionCode,
    location: provConfig.locationName || geo.name,
    dataResidency: geo.dataResidency,
    gridZone: zone,
    carbonIntensity: geo.gridCarbonIntensity,
    unit: 'gCO2eq/kWh',
    source: 'Cloud Carbon Footprint (CCF) Grid Emission Factor / CEA Baseline & EPA eGRID (2024)',
    status: 'reference-benchmark',
    fetchedAt: new Date().toISOString()
  };

  carbonCache.set(cacheKey, { timestamp: Date.now(), data: benchmarkData });
  return benchmarkData;
}

module.exports = {
  getCarbonIntensity
};
