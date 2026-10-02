/**
 * Deterministic Cost Calculation Tool
 * Computes exact estimated compute and storage costs based on official hourly rates and workload duration.
 */

// Standard enterprise storage baseline: AWS gp3 / Azure Standard SSD / GCP pd-balanced (~$0.08 per GB-month)
const DEFAULT_STORAGE_GB_MONTH_RATE = 0.08;
const HOURS_PER_MONTH = 730;

/**
 * Calculate estimated total cost for a workload
 * @param {number} hourlyPrice - Cloud provider hourly compute price in USD
 * @param {number} durationHours - Expected workload duration in hours
 * @param {number} storageGb - Attached persistent disk in GB (optional)
 * @param {number} storageRatePerGbMonth - Storage rate per GB-month (optional)
 * @returns {Object} Deterministic breakdown of costs
 */
function calculateEstimatedCost(hourlyPrice, durationHours, storageGb = 0, storageRatePerGbMonth = DEFAULT_STORAGE_GB_MONTH_RATE) {
  if (typeof hourlyPrice !== 'number' || hourlyPrice < 0) {
    throw new Error(`Invalid hourly price: ${hourlyPrice}`);
  }
  if (typeof durationHours !== 'number' || durationHours <= 0) {
    throw new Error(`Invalid duration: ${durationHours}`);
  }

  const computeCost = hourlyPrice * durationHours;
  const storageCost = (storageGb * storageRatePerGbMonth * (durationHours / HOURS_PER_MONTH));
  const totalCost = computeCost + storageCost;

  return {
    hourlyComputePrice: parseFloat(hourlyPrice.toFixed(4)),
    durationHours,
    computeCost: parseFloat(computeCost.toFixed(4)),
    storageCost: parseFloat(storageCost.toFixed(4)),
    totalCost: parseFloat(totalCost.toFixed(4)),
    currency: 'USD'
  };
}

module.exports = {
  calculateEstimatedCost,
  DEFAULT_STORAGE_GB_MONTH_RATE
};
