/**
 * Simulation Service
 * Coordinates workload execution simulation and persists telemetry to SQLite.
 */

const { db } = require('../database/database');
const { simulateWorkloadExecution } = require('../simulation/workloadSimulator');

/**
 * Run and persist a simulation for a given job and placement
 * @param {string} jobId - UUID of the workload job
 * @param {Object} [overridePlacement] - Optional placement override
 * @param {Object} [options] - Simulation execution options
 */
async function runAndPersistSimulation(jobId, overridePlacement = null, options = {}) {
  // 1. Fetch Job from SQLite
  const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
  if (!job) {
    throw new Error(`Job not found with ID: ${jobId}`);
  }

  // 2. Fetch Placement (override, or latest decision, or fallback candidate)
  let placement = overridePlacement;
  if (!placement) {
    const decision = db.prepare('SELECT * FROM decisions WHERE job_id = ? ORDER BY id DESC LIMIT 1').get(jobId);
    if (decision) {
      placement = {
        cloud: decision.cloud,
        service: decision.service,
        region: decision.region,
        cost: { totalCost: decision.estimated_cost },
        carbon: { totalEmissionsKg: decision.estimated_carbon },
        baseLatencyMs: decision.latency || 25,
        instanceType: decision.service
      };
    } else {
      // Look for first feasible cloud option
      const option = db.prepare('SELECT * FROM cloud_options WHERE job_id = ? AND feasible = 1 LIMIT 1').get(jobId);
      if (option) {
        placement = {
          cloud: option.cloud,
          service: option.service,
          region: option.region,
          cost: { totalCost: (option.pricing || 0.05) * job.duration },
          carbon: { totalEmissionsKg: 0.1 },
          baseLatencyMs: option.latency || 25,
          instanceType: option.service
        };
      } else {
        // Fallback default
        placement = {
          cloud: 'AWS',
          service: 't3.medium',
          region: job.target_region || 'ap-south-1',
          cost: { totalCost: 1.11 },
          carbon: { totalEmissionsKg: 0.32 },
          baseLatencyMs: 18,
          instanceType: 't3.medium'
        };
      }
    }
  }

  // 3. Execute Simulation
  const result = await simulateWorkloadExecution(job, placement, options);

  // 4. Persist to SQLite simulations table
  const insertStmt = db.prepare(`
    INSERT INTO simulations (
      job_id, cloud, region, service, execution_time,
      average_cpu, average_memory, estimated_cost,
      estimated_carbon, status, started_at, completed_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const info = insertStmt.run(
    job.job_id,
    result.cloud,
    result.region,
    result.instanceType,
    result.executionTimeSeconds,
    result.averageCpu,
    result.averageMemoryMb,
    result.estimatedCost,
    result.estimatedCarbonKg,
    result.status,
    result.startedAt,
    result.completedAt
  );

  return {
    simulationId: info.lastInsertRowid,
    ...result
  };
}

/**
 * Retrieve simulations for a given job ID
 */
function getSimulationsByJobId(jobId) {
  return db.prepare('SELECT * FROM simulations WHERE job_id = ? ORDER BY id DESC').all(jobId);
}

/**
 * Retrieve single simulation by ID
 */
function getSimulationById(id) {
  return db.prepare('SELECT * FROM simulations WHERE id = ?').get(id);
}

module.exports = {
  runAndPersistSimulation,
  getSimulationsByJobId,
  getSimulationById
};
