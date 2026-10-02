/**
 * Centralized Region and Geographic Mapping Configuration
 * Defines regions across AWS, Azure, and GCP with data residency,
 * base latency expectations (from Indian client base), and grid identifiers.
 */

const REGIONS_CONFIG = {
  india: {
    id: 'india',
    name: 'India (South Asia)',
    country: 'IN',
    dataResidency: 'India',
    baseLatencyMs: 18, // Avg round-trip latency within India
    providers: {
      aws: {
        regionCode: 'ap-south-1',
        locationName: 'Asia Pacific (Mumbai)',
        electricityMapsZone: 'IN-WE' // Western India Grid
      },
      azure: {
        regionCode: 'centralindia',
        locationName: 'Central India (Pune)',
        armRegionName: 'centralindia',
        electricityMapsZone: 'IN-WE'
      },
      gcp: {
        regionCode: 'asia-south1',
        locationName: 'Mumbai, India',
        electricityMapsZone: 'IN-WE'
      }
    },
    // Reference grid emission factor in gCO2eq/kWh from CEA CO2 Baseline Database
    gridCarbonIntensity: 708.2
  },

  us_east: {
    id: 'us_east',
    name: 'US East (North America)',
    country: 'US',
    dataResidency: 'United States',
    baseLatencyMs: 195, // Transatlantic/Pacific from India
    providers: {
      aws: {
        regionCode: 'us-east-1',
        locationName: 'US East (N. Virginia)',
        electricityMapsZone: 'US-PJM'
      },
      azure: {
        regionCode: 'eastus',
        locationName: 'East US (Virginia)',
        armRegionName: 'eastus',
        electricityMapsZone: 'US-PJM'
      },
      gcp: {
        regionCode: 'us-east1',
        locationName: 'South Carolina, USA',
        electricityMapsZone: 'US-SC'
      }
    },
    // Reference grid emission factor in gCO2eq/kWh from EPA eGRID (SRVC/PJM)
    gridCarbonIntensity: 379.0
  },

  europe_west: {
    id: 'europe_west',
    name: 'Europe West (EU)',
    country: 'EU',
    dataResidency: 'European Union',
    baseLatencyMs: 135,
    providers: {
      aws: {
        regionCode: 'eu-west-1',
        locationName: 'Europe (Ireland)',
        electricityMapsZone: 'IE'
      },
      azure: {
        regionCode: 'westeurope',
        locationName: 'West Europe (Netherlands)',
        armRegionName: 'westeurope',
        electricityMapsZone: 'NL'
      },
      gcp: {
        regionCode: 'europe-west1',
        locationName: 'Belgium, Europe',
        electricityMapsZone: 'BE'
      }
    },
    // Reference grid emission factor in gCO2eq/kWh from EEA / SEAI
    gridCarbonIntensity: 316.4
  },

  southeast_asia: {
    id: 'southeast_asia',
    name: 'Southeast Asia (Singapore)',
    country: 'SG',
    dataResidency: 'Singapore',
    baseLatencyMs: 65,
    providers: {
      aws: {
        regionCode: 'ap-southeast-1',
        locationName: 'Asia Pacific (Singapore)',
        electricityMapsZone: 'SG'
      },
      azure: {
        regionCode: 'southeastasia',
        locationName: 'Southeast Asia (Singapore)',
        armRegionName: 'southeastasia',
        electricityMapsZone: 'SG'
      },
      gcp: {
        regionCode: 'asia-southeast1',
        locationName: 'Jurong West, Singapore',
        electricityMapsZone: 'SG'
      }
    },
    // Reference grid emission factor in gCO2eq/kWh from EMA Singapore
    gridCarbonIntensity: 408.0
  }
};

/**
 * Helper to find geographic configuration by provider code
 */
function findRegionByProviderCode(cloud, regionCode) {
  const normalizedCloud = cloud.toLowerCase();
  const normalizedCode = regionCode.toLowerCase();

  for (const geo of Object.values(REGIONS_CONFIG)) {
    const prov = geo.providers[normalizedCloud];
    if (prov && prov.regionCode.toLowerCase() === normalizedCode) {
      return { geo, providerConfig: prov };
    }
  }
  return null;
}

module.exports = {
  REGIONS_CONFIG,
  findRegionByProviderCode
};
