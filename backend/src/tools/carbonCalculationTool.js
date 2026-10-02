/**
 * Deterministic Carbon Calculation Tool
 * Implements the standard Green Software Foundation / Cloud Carbon Footprint (CCF) energy model:
 * Total Power (W) = (P_base + (vCPU * P_cpu * util) + (RAM_GB * P_ram)) * PUE
 * Energy (kWh) = (Total Power * durationHours) / 1000
 * Carbon Emissions (gCO2eq) = Energy (kWh) * gridCarbonIntensity (gCO2eq/kWh)
 */

const P_BASE_WATTS = 10.0;     // Baseline server overhead (Watts)
const P_CPU_WATTS = 3.5;       // Power per vCPU at full load (Watts)
const P_RAM_WATTS = 0.38;      // Power per GiB RAM (Watts)
const HYPERSCALE_PUE = 1.15;   // Modern hyperscale datacenter Power Usage Effectiveness

/**
 * Calculate deterministic estimated energy and carbon emissions for a compute job
 * @param {number} vCpu - Number of vCPUs
 * @param {number} memoryGb - RAM in GiB
 * @param {number} durationHours - Expected duration in hours
 * @param {number} carbonIntensity - Regional grid emission factor in gCO2eq/kWh
 * @param {number} avgCpuUtilization - Estimated average utilization (0.1 to 1.0, default 0.70)
 * @returns {Object} Deterministic energy and carbon breakdown
 */
function calculateEstimatedCarbon(vCpu, memoryGb, durationHours, carbonIntensity, avgCpuUtilization = 0.70) {
  if (typeof vCpu !== 'number' || vCpu <= 0) {
    throw new Error(`Invalid vCPU count: ${vCpu}`);
  }
  if (typeof memoryGb !== 'number' || memoryGb <= 0) {
    throw new Error(`Invalid memory: ${memoryGb}`);
  }
  if (typeof durationHours !== 'number' || durationHours <= 0) {
    throw new Error(`Invalid duration: ${durationHours}`);
  }
  if (typeof carbonIntensity !== 'number' || carbonIntensity < 0) {
    throw new Error(`Invalid carbon intensity: ${carbonIntensity}`);
  }

  const util = Math.min(Math.max(avgCpuUtilization, 0.1), 1.0);

  // Power in Watts
  const cpuPower = vCpu * P_CPU_WATTS * util;
  const ramPower = memoryGb * P_RAM_WATTS;
  const totalPowerWatts = (P_BASE_WATTS + cpuPower + ramPower) * HYPERSCALE_PUE;

  // Energy in kWh
  const energyKwh = (totalPowerWatts * durationHours) / 1000.0;

  // Emissions in grams of CO2 equivalent
  const totalEmissionsGrams = energyKwh * carbonIntensity;
  const totalEmissionsKg = totalEmissionsGrams / 1000.0;

  return {
    powerWatts: parseFloat(totalPowerWatts.toFixed(2)),
    energyKwh: parseFloat(energyKwh.toFixed(4)),
    carbonIntensity,
    totalEmissionsGrams: parseFloat(totalEmissionsGrams.toFixed(2)),
    totalEmissionsKg: parseFloat(totalEmissionsKg.toFixed(4)),
    pue: HYPERSCALE_PUE,
    unit: 'gCO2eq'
  };
}

module.exports = {
  calculateEstimatedCarbon,
  HYPERSCALE_PUE
};
