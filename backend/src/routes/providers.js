const express = require('express');
const router = express.Router();

const { REGIONS_CONFIG, findRegionByProviderCode } = require('../config/regions');
const { getAwsComputePricing } = require('../providers/aws');
const { getAzureComputePricing } = require('../providers/azure');
const { getGcpComputePricing } = require('../providers/gcp');
const { getCarbonIntensity } = require('../carbon/carbonProvider');

/**
 * GET /api/providers/regions
 * Returns all supported geographic regions and provider-specific mappings
 */
router.get('/regions', (req, res) => {
  res.json({
    status: 'ok',
    count: Object.keys(REGIONS_CONFIG).length,
    regions: REGIONS_CONFIG
  });
});

/**
 * GET /api/providers/pricing
 * Query pricing for a specific cloud and region
 * Params: ?cloud=AWS|Azure|GCP&region=ap-south-1|centralindia|asia-south1
 */
router.get('/pricing', async (req, res, next) => {
  try {
    const cloud = (req.query.cloud || 'AWS').toUpperCase();
    const region = req.query.region || '';

    let data = [];
    if (cloud === 'AWS') {
      data = await getAwsComputePricing(region);
    } else if (cloud === 'AZURE') {
      data = await getAzureComputePricing(region);
    } else if (cloud === 'GCP') {
      data = await getGcpComputePricing(region);
    } else {
      return res.status(400).json({
        error: 'Invalid Provider',
        message: `Supported cloud providers are AWS, Azure, and GCP. Received: ${cloud}`
      });
    }

    res.json({
      status: 'ok',
      cloud,
      region,
      count: data.length,
      instances: data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/providers/carbon
 * Query carbon intensity for a specific cloud and region
 * Params: ?cloud=AWS|Azure|GCP&region=ap-south-1
 */
router.get('/carbon', async (req, res, next) => {
  try {
    const cloud = (req.query.cloud || 'AWS').toUpperCase();
    const region = req.query.region || '';

    const carbonData = await getCarbonIntensity(cloud, region);
    res.json({
      status: 'ok',
      data: carbonData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/providers/summary
 * Multi-cloud summary snapshot for verification
 */
router.get('/summary', async (req, res, next) => {
  try {
    const geoKey = req.query.geo || 'india';
    const geo = REGIONS_CONFIG[geoKey] || REGIONS_CONFIG.india;

    const [awsPricing, azurePricing, gcpPricing, awsCarbon, azureCarbon, gcpCarbon] = await Promise.all([
      getAwsComputePricing(geo.providers.aws.regionCode),
      getAzureComputePricing(geo.providers.azure.regionCode),
      getGcpComputePricing(geo.providers.gcp.regionCode),
      getCarbonIntensity('AWS', geo.providers.aws.regionCode),
      getCarbonIntensity('Azure', geo.providers.azure.regionCode),
      getCarbonIntensity('GCP', geo.providers.gcp.regionCode)
    ]);

    res.json({
      status: 'ok',
      geographicArea: geo.name,
      country: geo.country,
      baseLatencyMs: geo.baseLatencyMs,
      providers: {
        aws: {
          region: geo.providers.aws.regionCode,
          instancesAvailable: awsPricing.length,
          sampleInstance: awsPricing[0] || null,
          carbon: awsCarbon
        },
        azure: {
          region: geo.providers.azure.regionCode,
          instancesAvailable: azurePricing.length,
          sampleInstance: azurePricing[0] || null,
          carbon: azureCarbon
        },
        gcp: {
          region: geo.providers.gcp.regionCode,
          instancesAvailable: gcpPricing.length,
          sampleInstance: gcpPricing[0] || null,
          carbon: gcpCarbon
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
