/**
 * Metrics Engine for Workload Simulation
 * Implements Green Software Foundation SCI (Software Carbon Intensity) standard
 * and collects deterministic runtime and telemetry metrics.
 */

const os = require('os');
const { findRegionByProviderCode, REGIONS_CONFIG } = require('../config/regions');

// Data center Power Usage Effectiveness (PUE) reference standards
const CLOUD_PUE_STANDARDS = {
  AWS: 1.15,
  Azure: 1.18,
  GCP: 1.10
};

// Server core thermal power characteristics (TDP watts per core)
const BASE_WATTS_PER_CORE = 15; // Idle power per core
const MAX_WATTS_PER_CORE = 55;  // Dynamic power at 100% compute load

/**
 * Retrieve grid carbon intensity for a region
 */
function getGridIntensityForRegion(cloud, region) {
  const normCloud = (cloud || 'AWS').toLowerCase();
  const normRegion = (region || '').toLowerCase();
  const lookup = findRegionByProviderCode(normCloud, normRegion);
  if (lookup && lookup.geo && lookup.geo.gridCarbonIntensity) {
    return {
      carbonIntensity: lookup.geo.gridCarbonIntensity,
      location: lookup.geo.name,
      source: 'Cloud Carbon Footprint (CCF) Grid Emission Factor / CEA Baseline & EPA eGRID (2024)'
    };
  }
  for (const geo of Object.values(REGIONS_CONFIG)) {
    if (geo.dataResidency.toLowerCase() === normRegion || geo.name.toLowerCase().includes(normRegion)) {
      return {
        carbonIntensity: geo.gridCarbonIntensity,
        location: geo.name,
        source: 'Cloud Carbon Footprint (CCF) Grid Emission Factor'
      };
    }
  }
  return {
    carbonIntensity: REGIONS_CONFIG.india.gridCarbonIntensity,
    location: REGIONS_CONFIG.india.name,
    source: 'CEA Baseline Reference'
  };
}

/**
 * Calculate instantaneous and total energy consumption
 * Energy (kWh) = (vCpuCount * PUE * avgWattsPerCore * durationHours) / 1000
 */
function calculateEnergyConsumption({ cloud = 'AWS', vCpu = 2, cpuUtilizationPercent = 70, durationHours = 1 }) {
  const normCloud = (cloud || 'AWS').toUpperCase();
  const pue = CLOUD_PUE_STANDARDS[normCloud] || 1.15;
  const utilFraction = Math.min(Math.max(cpuUtilizationPercent / 100, 0.05), 1.0);
  
  // Power per core based on utilization curve
  const wattsPerCore = BASE_WATTS_PER_CORE + (MAX_WATTS_PER_CORE - BASE_WATTS_PER_CORE) * utilFraction;
  const totalPowerWatts = vCpu * wattsPerCore * pue;
  
  // Cumulative energy in kWh
  const totalEnergyKwh = (totalPowerWatts * durationHours) / 1000;

  return {
    pue,
    wattsPerCore: Math.round(wattsPerCore * 100) / 100,
    totalPowerWatts: Math.round(totalPowerWatts * 100) / 100,
    totalEnergyKwh: Math.round(totalEnergyKwh * 10000) / 10000
  };
}

/**
 * Calculate simulated carbon emissions using regional grid factor
 * Emissions (gCO2eq) = Energy (kWh) * Carbon Intensity (gCO2eq/kWh)
 */
function calculateSimulatedCarbon({ energyKwh, region, cloud = 'AWS' }) {
  const carbonFactor = getGridIntensityForRegion(cloud, region);
  const carbonIntensity = carbonFactor ? carbonFactor.carbonIntensity : 708.2;
  
  const emissionsGrams = energyKwh * carbonIntensity;
  const emissionsKg = emissionsGrams / 1000;

  return {
    gridCarbonIntensity: carbonIntensity,
    source: carbonFactor ? carbonFactor.source : 'Global Reference Benchmark',
    emissionsGrams: Math.round(emissionsGrams * 100) / 100,
    emissionsKg: Math.round(emissionsKg * 10000) / 10000
  };
}

/**
 * Measure system telemetry snapshot
 */
function captureTelemetrySnapshot(baseCpus, baseMemoryGb, stepIndex, totalSteps) {
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  
  // Simulated CPU utilization trajectory (peaks during compute cycle, tapers at finish)
  let simulatedCpuPercent;
  if (stepIndex === 0) {
    simulatedCpuPercent = 18; // initialization
  } else if (stepIndex === 1) {
    simulatedCpuPercent = 45; // staging
  } else if (stepIndex === 2 || stepIndex === 3) {
    simulatedCpuPercent = 82 + (Math.random() * 12 - 6); // heavy compute phase
  } else {
    simulatedCpuPercent = 28; // finalization & teardown
  }
  simulatedCpuPercent = Math.min(Math.max(Math.round(simulatedCpuPercent * 10) / 10, 5), 100);

  // Simulated memory allocation proportional to requested RAM
  const targetMemoryMb = baseMemoryGb * 1024;
  const simulatedMemoryMb = Math.round((targetMemoryMb * (0.35 + (stepIndex / totalSteps) * 0.55)) * 10) / 10;

  return {
    cpuUtilizationPercent: simulatedCpuPercent,
    memoryUsedMb: simulatedMemoryMb,
    heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
    hostCoreCount: cpus.length,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  CLOUD_PUE_STANDARDS,
  getGridIntensityForRegion,
  calculateEnergyConsumption,
  calculateSimulatedCarbon,
  captureTelemetrySnapshot
};
