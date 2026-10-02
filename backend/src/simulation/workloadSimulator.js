/**
 * Workload Execution Simulator
 * Simulates compute workload execution on recommended cloud placement,
 * measuring runtime, CPU/RAM utilization, and calculating SCI energy & carbon.
 */

const crypto = require('crypto');
const { calculateEnergyConsumption, calculateSimulatedCarbon, captureTelemetrySnapshot } = require('./metricsEngine');

/**
 * Execute a controlled safe micro-compute burst
 */
function executeComputeBurst(iterations = 40000) {
  let hash = 'seed';
  for (let i = 0; i < iterations; i++) {
    hash = crypto.createHash('sha256').update(hash + i).digest('hex');
  }
  return hash.substring(0, 8);
}

/**
 * Sleep helper for simulation stage pacing
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulate workload execution on chosen cloud placement
 * @param {Object} job - Workload specification
 * @param {Object} placement - Cloud placement candidate
 * @param {Object} options - Simulation options (e.g. stageDelayMs)
 * @returns {Promise<Object>} Simulation results with telemetry snapshots
 */
async function simulateWorkloadExecution(job, placement, options = {}) {
  const stageDelayMs = options.stageDelayMs !== undefined ? options.stageDelayMs : 300;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const vCpu = job.cpu || 2;
  const memoryGb = job.memory || 4;
  const durationHours = job.duration || 1;
  const cloud = placement.cloud || 'AWS';
  const region = placement.region || 'ap-south-1';
  const baseLatency = placement.baseLatencyMs || 25;
  const hourlyPrice = placement.cost?.hourlyPrice || (placement.cost?.totalCost ? placement.cost.totalCost / durationHours : 0.05);

  const STAGES = [
    { name: 'Provisioning & Isolation', progress: 20 },
    { name: 'Storage & Memory Mounting', progress: 40 },
    { name: 'Compute Kernel Execution', progress: 60 },
    { name: 'Network & SLA Health Check', progress: 80 },
    { name: 'GSF Carbon & Cost Reconciliation', progress: 100 }
  ];

  const telemetrySnapshots = [];
  let totalCpu = 0;
  let peakCpu = 0;
  let totalMemory = 0;
  let peakMemory = 0;

  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];

    // Run compute burst during compute phase
    if (i === 2) {
      executeComputeBurst(60000);
    }

    if (stageDelayMs > 0) {
      await delay(stageDelayMs);
    }

    const snapshot = captureTelemetrySnapshot(vCpu, memoryGb, i, STAGES.length);
    totalCpu += snapshot.cpuUtilizationPercent;
    peakCpu = Math.max(peakCpu, snapshot.cpuUtilizationPercent);
    totalMemory += snapshot.memoryUsedMb;
    peakMemory = Math.max(peakMemory, snapshot.memoryUsedMb);

    // Energy at this stage
    const energy = calculateEnergyConsumption({
      cloud,
      vCpu,
      cpuUtilizationPercent: snapshot.cpuUtilizationPercent,
      durationHours: durationHours * (stage.progress / 100)
    });

    // Carbon at this stage
    const carbon = calculateSimulatedCarbon({
      energyKwh: energy.totalEnergyKwh,
      region
    });

    // Jittered latency observation
    const observedLatency = Math.round(baseLatency + (Math.random() * 4 - 2));
    const slaCompliant = !job.max_latency || observedLatency <= job.max_latency;

    telemetrySnapshots.push({
      stage: stage.name,
      progress: stage.progress,
      cpuUtilizationPercent: snapshot.cpuUtilizationPercent,
      memoryUsedMb: snapshot.memoryUsedMb,
      powerWatts: energy.totalPowerWatts,
      cumulativeEnergyKwh: energy.totalEnergyKwh,
      cumulativeCarbonKg: carbon.emissionsKg,
      observedLatencyMs: observedLatency,
      slaStatus: slaCompliant ? 'PASSED' : 'VIOLATED',
      timestamp: snapshot.timestamp
    });
  }

  const completedAt = new Date().toISOString();
  const executionWallClockSec = Math.round(((Date.now() - startTime) / 1000) * 100) / 100;
  const avgCpu = Math.round((totalCpu / STAGES.length) * 10) / 10;
  const avgMemory = Math.round((totalMemory / STAGES.length) * 10) / 10;

  // Final GSF SCI Energy & Carbon
  const finalEnergy = calculateEnergyConsumption({
    cloud,
    vCpu,
    cpuUtilizationPercent: avgCpu,
    durationHours
  });

  const finalCarbon = calculateSimulatedCarbon({
    energyKwh: finalEnergy.totalEnergyKwh,
    region
  });

  const finalCost = Math.round(hourlyPrice * durationHours * 10000) / 10000;
  const finalLatency = telemetrySnapshots[telemetrySnapshots.length - 1].observedLatencyMs;
  const slaPassed = !job.max_latency || finalLatency <= job.max_latency;

  return {
    jobId: job.job_id,
    workloadName: job.workload_name || 'Compute Workload',
    cloud,
    service: placement.service || 'Virtual Machine',
    region,
    instanceType: placement.instanceType || 'Compute Instance',
    status: 'completed',
    executionTimeSeconds: executionWallClockSec,
    projectedDurationHours: durationHours,
    averageCpu: avgCpu,
    peakCpu: Math.round(peakCpu * 10) / 10,
    averageMemoryMb: avgMemory,
    peakMemoryMb: peakMemory,
    totalEnergyKwh: finalEnergy.totalEnergyKwh,
    pueFactor: finalEnergy.pue,
    estimatedCost: finalCost,
    estimatedCarbonKg: finalCarbon.emissionsKg,
    gridCarbonIntensity: finalCarbon.gridCarbonIntensity,
    observedLatencyMs: finalLatency,
    slaStatus: slaPassed ? 'PASSED' : 'VIOLATED',
    telemetrySnapshots,
    startedAt,
    completedAt
  };
}

module.exports = {
  simulateWorkloadExecution
};
