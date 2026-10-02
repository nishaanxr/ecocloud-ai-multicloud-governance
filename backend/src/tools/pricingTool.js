/**
 * Pricing Retrieval Tool
 * Modular tool interface to fetch and normalize compute pricing across AWS, Azure, and GCP.
 * Used by deterministic services and registered for Gemini agent tool-calling.
 */

const { getAwsComputePricing } = require('../providers/aws');
const { getAzureComputePricing } = require('../providers/azure');
const { getGcpComputePricing } = require('../providers/gcp');

/**
 * Get cloud pricing for specified provider and region
 * @param {string} cloud - 'AWS' | 'Azure' | 'GCP'
 * @param {string} region - Region identifier
 * @returns {Promise<Array<Object>>} Normalized list of compute instance options
 */
async function getCloudPricing(cloud, region) {
  const normCloud = (cloud || '').toUpperCase().trim();

  if (normCloud === 'AWS') {
    return await getAwsComputePricing(region);
  } else if (normCloud === 'AZURE') {
    return await getAzureComputePricing(region);
  } else if (normCloud === 'GCP') {
    return await getGcpComputePricing(region);
  } else {
    throw new Error(`Unsupported cloud provider: ${cloud}. Supported providers are AWS, Azure, GCP.`);
  }
}

/**
 * Get compute candidates across multiple clouds and regions
 * @param {Array<string>} clouds - e.g. ['AWS', 'Azure', 'GCP']
 * @param {string} geoKey - e.g. 'india', 'us_east', etc.
 * @returns {Promise<Array<Object>>}
 */
async function getMultiCloudPricing(clouds = ['AWS', 'Azure', 'GCP'], geoKey = 'india') {
  const { REGIONS_CONFIG } = require('../config/regions');
  const geo = REGIONS_CONFIG[geoKey] || REGIONS_CONFIG.india;

  const tasks = [];
  for (const cloud of clouds) {
    const cUpper = cloud.toUpperCase().trim();
    let regionCode = '';
    if (cUpper === 'AWS') regionCode = geo.providers.aws.regionCode;
    if (cUpper === 'AZURE') regionCode = geo.providers.azure.regionCode;
    if (cUpper === 'GCP') regionCode = geo.providers.gcp.regionCode;

    if (regionCode) {
      tasks.push(getCloudPricing(cUpper, regionCode).catch(err => {
        console.error(`[PricingTool] Error fetching ${cUpper} in ${regionCode}:`, err.message);
        return [];
      }));
    }
  }

  const results = await Promise.all(tasks);
  return results.flat();
}

module.exports = {
  getCloudPricing,
  getMultiCloudPricing
};
