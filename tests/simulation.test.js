/**
 * Phase 5 Unit Tests: Workload Simulation & Real-Time Telemetry
 */

const assert = require('assert');
const path = require('path');
try {
  require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
} catch (e) {
  // dotenv optional in test
}

const {
  calculateEnergyConsumption,
  calculateSimulatedCarbon,
  captureTelemetrySnapshot
} = require('../backend/src/simulation/metricsEngine');

const { simulateWorkloadExecution } = require('../backend/src/simulation/workloadSimulator');
const {
  runAndPersistSimulation,
  getSimulationsByJobId,
  getSimulationById
} = require('../backend/src/services/simulationService');
const { createAndEvaluateJob } = require('../backend/src/services/jobService');

async function runSimulationTests() {
  console.log('\n🧪 Starting Phase 5 Workload Simulation & Telemetry Tests...\n');

  // --- 1. Metrics Engine Tests ---
  console.log('--- Testing Metrics Engine ---');

  // Test Energy Consumption
  const energyResult = calculateEnergyConsumption({
    cloud: 'AWS',
    vCpu: 4,
    cpuUtilizationPercent: 75,
    durationHours: 10
  });

  assert(energyResult.pue === 1.15, 'AWS PUE should default to 1.15');
  assert(energyResult.totalPowerWatts > 0, 'Total power watts must be greater than 0');
  assert(energyResult.totalEnergyKwh > 0, 'Total energy kWh must be greater than 0');
  console.log(`  ✅ PASS: calculateEnergyConsumption computes PUE (${energyResult.pue}), Power (${energyResult.totalPowerWatts}W), Energy (${energyResult.totalEnergyKwh} kWh)`);

  // Test Carbon Calculation
  const carbonResult = calculateSimulatedCarbon({
    energyKwh: energyResult.totalEnergyKwh,
    region: 'ap-south-1'
  });

  assert(carbonResult.gridCarbonIntensity === 708.2, 'India grid intensity should be 708.2 g/kWh');
  assert(carbonResult.emissionsGrams > 0, 'Emissions in grams must be > 0');
  assert(carbonResult.emissionsKg > 0, 'Emissions in kg must be > 0');
  console.log(`  ✅ PASS: calculateSimulatedCarbon calculates emissions (${carbonResult.emissionsKg} kg CO2eq) using verified CEA grid factor`);

  // Test Telemetry Snapshot
  const snapshot = captureTelemetrySnapshot(4, 16, 2, 5);
  assert(snapshot.cpuUtilizationPercent > 0 && snapshot.cpuUtilizationPercent <= 100, 'CPU percent must be bounded 0-100');
  assert(snapshot.memoryUsedMb > 0, 'Memory used must be > 0');
  assert(snapshot.heapUsedMb > 0, 'Heap used must be > 0');
  console.log(`  ✅ PASS: captureTelemetrySnapshot captures system CPU (${snapshot.cpuUtilizationPercent}%) and memory (${snapshot.memoryUsedMb} MB)`);

  // --- 2. Workload Simulator Tests ---
  console.log('\n--- Testing Workload Simulator ---');
  const testJob = {
    job_id: 'sim-test-' + Date.now(),
    workload_name: 'Simulation Test Kernel',
    cpu: 2,
    memory: 4,
    duration: 5,
    max_latency: 50,
    target_region: 'ap-south-1'
  };

  const testPlacement = {
    cloud: 'AWS',
    service: 'EC2',
    instanceType: 't3.medium',
    region: 'ap-south-1',
    cost: { hourlyPrice: 0.0464, totalCost: 0.232 },
    carbon: { totalEmissionsKg: 0.05 },
    baseLatencyMs: 18
  };

  const simResult = await simulateWorkloadExecution(testJob, testPlacement, { stageDelayMs: 20 });
  assert(simResult.status === 'completed', 'Simulation status must be completed');
  assert(simResult.telemetrySnapshots.length === 5, 'Must have 5 telemetry snapshots');
  assert(simResult.averageCpu > 0, 'Average CPU must be > 0');
  assert(simResult.averageMemoryMb > 0, 'Average Memory must be > 0');
  assert(simResult.totalEnergyKwh > 0, 'Total energy must be > 0');
  assert(simResult.slaStatus === 'PASSED', 'SLA status must be PASSED (18ms < 50ms)');
  console.log(`  ✅ PASS: simulateWorkloadExecution executed 5 stages, collected telemetry, and verified SLA`);

  // --- 3. SQLite Persistence & Service Tests ---
  console.log('\n--- Testing Simulation Persistence ---');
  // First register the job in SQLite so foreign key constraint is satisfied
  const registeredJob = await createAndEvaluateJob({
    workloadName: 'Simulation DB Job',
    cpu: 2,
    memory: 4,
    duration: 2,
    optimizationMode: 'Cost Optimized',
    dataResidency: 'India',
    targetRegion: 'ap-south-1'
  });

  const persistedSim = await runAndPersistSimulation(registeredJob.job.job_id, null, { stageDelayMs: 20 });
  assert(persistedSim.simulationId, 'Persisted simulation must have a generated row ID');
  assert(persistedSim.status === 'completed', 'Simulation status must be completed');
  console.log(`  ✅ PASS: runAndPersistSimulation persisted simulation #${persistedSim.simulationId} to SQLite`);

  const jobSims = getSimulationsByJobId(registeredJob.job.job_id);
  assert(jobSims.length >= 1, 'Should find at least 1 simulation for job');
  console.log(`  ✅ PASS: getSimulationsByJobId retrieved ${jobSims.length} record(s)`);

  const singleSim = getSimulationById(persistedSim.simulationId);
  assert(singleSim.id === persistedSim.simulationId, 'getSimulationById returned correct row');
  console.log(`  ✅ PASS: getSimulationById verified simulation record integrity`);

  console.log('\n=============================================');
  console.log('Phase 5 Test Results: 7/7 passed');
  console.log('=============================================\n');
}

runSimulationTests().catch(err => {
  console.error('❌ Phase 5 Test Failed:', err);
  process.exit(1);
});
