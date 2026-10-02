/**
 * Job Service
 * Handles workload submission, data retrieval, deterministic calculation of costs & carbon,
 * hard constraint filtering, and SQLite database persistence.
 */

const { db } = require('../database/database');
const { getCloudPricing } = require('../tools/pricingTool');
const { getCarbonIntensity } = require('../carbon/carbonProvider');
const { calculateEstimatedCost } = require('../tools/costTool');
const { calculateEstimatedCarbon } = require('../tools/carbonCalculationTool');
const { checkFeasibility } = require('../tools/feasibilityTool');
const { REGIONS_CONFIG, findRegionByProviderCode } = require('../config/regions');

/**
 * Create and evaluate a workload job
 * @param {Object} jobInput - User-specified requirements
 * @returns {Promise<Object>} Evaluated job with feasible and infeasible options
 */
async function createAndEvaluateJob(jobInput) {
  // Validate and parse inputs
  const workloadName = (jobInput.workload_name || 'Standard Compute Workload').trim();
  const cpu = parseFloat(jobInput.cpu) || 2;
  const memory = parseFloat(jobInput.memory) || 4;
  const storage = parseFloat(jobInput.storage) || 20;
  const duration = parseFloat(jobInput.duration) || 24; // Default 24 hours
  const maxCost = jobInput.max_cost ? parseFloat(jobInput.max_cost) : null;
  const maxLatency = jobInput.max_latency ? parseFloat(jobInput.max_latency) : null;
  const dataResidency = (jobInput.data_residency || 'Any').trim();
  const priority = (jobInput.priority || 'Normal').trim();
  const optimizationMode = (jobInput.optimization_mode || 'Cost Optimized').trim();
  const targetRegion = jobInput.target_region || 'Any';

  // Providers selected (default: AWS, Azure, GCP)
  const selectedClouds = Array.isArray(jobInput.clouds) && jobInput.clouds.length > 0 
    ? jobInput.clouds.map(c => c.toUpperCase())
    : ['AWS', 'AZURE', 'GCP'];

  // Geographic areas to evaluate (e.g. ['india'], or all)
  const targetGeoKeys = jobInput.geo_keys && Array.isArray(jobInput.geo_keys) && jobInput.geo_keys.length > 0
    ? jobInput.geo_keys
    : Object.keys(REGIONS_CONFIG);

  // Generate unique job ID
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Persist Job to SQLite
  const insertJobStmt = db.prepare(`
    INSERT INTO jobs (
      job_id, workload_name, cpu, memory, storage, duration,
      max_cost, max_latency, data_residency, priority, optimization_mode, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  insertJobStmt.run(
    jobId, workloadName, cpu, memory, storage, duration,
    maxCost, maxLatency, dataResidency, priority, optimizationMode
  );

  const jobRecord = {
    job_id: jobId,
    workload_name: workloadName,
    cpu,
    memory,
    storage,
    duration,
    max_cost: maxCost,
    max_latency: maxLatency,
    data_residency: dataResidency,
    priority,
    optimization_mode: optimizationMode,
    target_region: targetRegion
  };

  // 2. Gather candidate instances from selected clouds across target regions
  const candidateInstances = [];
  for (const geoKey of targetGeoKeys) {
    const geo = REGIONS_CONFIG[geoKey];
    if (!geo) continue;

    for (const cloud of selectedClouds) {
      let regionCode = '';
      if (cloud === 'AWS' && geo.providers.aws) regionCode = geo.providers.aws.regionCode;
      if (cloud === 'AZURE' && geo.providers.azure) regionCode = geo.providers.azure.regionCode;
      if (cloud === 'GCP' && geo.providers.gcp) regionCode = geo.providers.gcp.regionCode;

      if (regionCode) {
        try {
          const instances = await getCloudPricing(cloud, regionCode);
          candidateInstances.push(...instances);
        } catch (err) {
          console.error(`[JobService] Error retrieving ${cloud} in ${regionCode}:`, err.message);
        }
      }
    }
  }

  // 3. Deterministic calculation & Hard Constraint Evaluation
  const evaluatedOptions = [];
  const insertOptionStmt = db.prepare(`
    INSERT INTO cloud_options (
      job_id, cloud, service, region, pricing, carbon_intensity,
      latency, feasible, source, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((options) => {
    for (const opt of options) {
      insertOptionStmt.run(
        jobId,
        opt.cloud,
        opt.service,
        opt.region,
        opt.hourlyPrice,
        opt.carbonIntensity,
        opt.baseLatencyMs,
        opt.feasible ? 1 : 0,
        opt.source,
        opt.fetchedAt
      );
    }
  });

  // Evaluate each candidate
  for (const candidate of candidateInstances) {
    // A. Carbon intensity for this candidate's cloud and region
    const carbonData = await getCarbonIntensity(candidate.cloud, candidate.region);
    const carbonIntensity = carbonData.carbonIntensity || 500;

    // B. Calculate Cost
    const costBreakdown = calculateEstimatedCost(candidate.hourlyPrice, duration, storage);

    // C. Calculate Carbon Emissions
    const carbonBreakdown = calculateEstimatedCarbon(candidate.vCpu, candidate.memoryGb, duration, carbonIntensity);

    // D. Evaluate Hard Constraints
    const feasibilityResult = checkFeasibility(candidate, jobRecord, costBreakdown.totalCost);

    const evaluated = {
      ...candidate,
      carbonIntensity,
      cost: costBreakdown,
      carbon: carbonBreakdown,
      feasible: feasibilityResult.feasible,
      violations: feasibilityResult.violations,
      feasibilitySummary: feasibilityResult.summary,
      checks: feasibilityResult.checks
    };

    evaluatedOptions.push(evaluated);
  }

  // Save all options to SQLite within a single transaction
  insertMany(evaluatedOptions);

  const feasibleOptions = evaluatedOptions.filter(o => o.feasible);
  const infeasibleOptions = evaluatedOptions.filter(o => !o.feasible);

  return {
    job: jobRecord,
    totalEvaluated: evaluatedOptions.length,
    feasibleCount: feasibleOptions.length,
    infeasibleCount: infeasibleOptions.length,
    feasibleOptions,
    infeasibleOptions
  };
}

/**
 * Retrieve a job and its evaluated cloud options from SQLite
 * @param {string} jobId 
 */
function getJobById(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
  if (!job) return null;

  const options = db.prepare('SELECT * FROM cloud_options WHERE job_id = ?').all(jobId);
  return {
    job,
    options
  };
}

/**
 * List recent jobs
 * @param {number} limit 
 */
function listJobs(limit = 20) {
  return db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ?').all(limit);
}

module.exports = {
  createAndEvaluateJob,
  getJobById,
  listJobs
};
