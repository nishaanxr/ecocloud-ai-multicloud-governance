/**
 * Automated Test Suite for Phase 3: Deterministic Hard Constraints & Normalization
 * Tests costTool, carbonCalculationTool, feasibilityTool, baselineService, and jobService.
 */

const assert = require('assert');
const { calculateEstimatedCost } = require('../backend/src/tools/costTool');
const { calculateEstimatedCarbon } = require('../backend/src/tools/carbonCalculationTool');
const { checkFeasibility } = require('../backend/src/tools/feasibilityTool');
const { computeBaselineDecision } = require('../backend/src/services/baselineService');
const { createAndEvaluateJob, getJobById } = require('../backend/src/services/jobService');

async function runTests() {
  console.log('🧪 Starting Phase 3 Hard Constraints & Normalization Tests...\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name}\n     ${e.message}`);
    }
  }

  // 1. Cost Tool Tests
  console.log('--- Testing Deterministic Cost Tool ---');
  test('calculateEstimatedCost computes correct compute and storage costs', () => {
    // 0.10/hr * 100 hrs = $10.00 compute. 50GB storage * 0.08 * (100 / 730) = $0.5479
    const cost = calculateEstimatedCost(0.10, 100, 50);
    assert.strictEqual(cost.computeCost, 10.00);
    assert.strictEqual(cost.storageCost, 0.5479);
    assert.strictEqual(cost.totalCost, 10.5479);
    assert.strictEqual(cost.currency, 'USD');
  });

  // 2. Carbon Calculation Tool Tests
  console.log('\n--- Testing Deterministic Carbon Calculation Tool ---');
  test('calculateEstimatedCarbon calculates energy and emissions accurately', () => {
    // 4 vCPU, 16GB RAM, 24 hours, 708.2 gCO2eq/kWh
    const carbon = calculateEstimatedCarbon(4, 16, 24, 708.2, 0.70);
    assert.ok(carbon.powerWatts > 0, 'Power should be positive');
    assert.ok(carbon.energyKwh > 0, 'Energy should be positive');
    assert.ok(carbon.totalEmissionsGrams > 0, 'Emissions in grams should be positive');
    assert.ok(carbon.totalEmissionsKg > 0, 'Emissions in kg should be positive');
    assert.strictEqual(carbon.carbonIntensity, 708.2);
  });

  // 3. Feasibility Tool Tests (Hard Constraints)
  console.log('\n--- Testing Deterministic Hard Constraint Tool ---');
  const baseJob = {
    cpu: 4,
    memory: 16,
    max_cost: 25.0,
    max_latency: 50,
    data_residency: 'India'
  };

  test('Candidate meeting all constraints is marked FEASIBLE', () => {
    const candidate = {
      vCpu: 4,
      memoryGb: 16,
      baseLatencyMs: 20,
      dataResidency: 'India',
      region: 'ap-south-1'
    };
    const res = checkFeasibility(candidate, baseJob, 20.0);
    assert.strictEqual(res.feasible, true);
    assert.strictEqual(res.violations.length, 0);
  });

  test('Candidate with insufficient CPU is marked INFEASIBLE', () => {
    const candidate = {
      vCpu: 2, // Needs 4
      memoryGb: 16,
      baseLatencyMs: 20,
      dataResidency: 'India',
      region: 'ap-south-1'
    };
    const res = checkFeasibility(candidate, baseJob, 20.0);
    assert.strictEqual(res.feasible, false);
    assert.ok(res.violations.some(v => v.includes('CPU capacity insufficient')));
  });

  test('Candidate with insufficient RAM is marked INFEASIBLE', () => {
    const candidate = {
      vCpu: 4,
      memoryGb: 8, // Needs 16
      baseLatencyMs: 20,
      dataResidency: 'India',
      region: 'ap-south-1'
    };
    const res = checkFeasibility(candidate, baseJob, 20.0);
    assert.strictEqual(res.feasible, false);
    assert.ok(res.violations.some(v => v.includes('Memory capacity insufficient')));
  });

  test('Candidate exceeding maximum budget is marked INFEASIBLE', () => {
    const candidate = {
      vCpu: 4,
      memoryGb: 16,
      baseLatencyMs: 20,
      dataResidency: 'India',
      region: 'ap-south-1'
    };
    const res = checkFeasibility(candidate, baseJob, 35.0); // Budget is $25.0
    assert.strictEqual(res.feasible, false);
    assert.ok(res.violations.some(v => v.includes('Cost exceeds maximum budget')));
  });

  test('Candidate violating data residency boundary is marked INFEASIBLE', () => {
    const candidate = {
      vCpu: 4,
      memoryGb: 16,
      baseLatencyMs: 20,
      dataResidency: 'United States', // Job requires India
      region: 'us-east-1'
    };
    const res = checkFeasibility(candidate, baseJob, 20.0);
    assert.strictEqual(res.feasible, false);
    assert.ok(res.violations.some(v => v.includes('Data residency mismatch')));
  });

  // 4. Baseline Decision Service Tests
  console.log('\n--- Testing Deterministic Baseline Service ---');
  const dummyFeasible = [
    {
      cloud: 'AWS',
      service: 'EC2',
      instanceType: 't3.xlarge',
      region: 'ap-south-1',
      vCpu: 4,
      memoryGb: 16,
      baseLatencyMs: 18,
      carbonIntensity: 708.2,
      cost: { totalCost: 15.0 },
      carbon: { totalEmissionsKg: 2.5 }
    },
    {
      cloud: 'Azure',
      service: 'Virtual Machines',
      instanceType: 'Standard_D4s_v5',
      region: 'centralindia',
      vCpu: 4,
      memoryGb: 16,
      baseLatencyMs: 18,
      carbonIntensity: 708.2,
      cost: { totalCost: 12.0 }, // Cheaper
      carbon: { totalEmissionsKg: 2.6 }
    },
    {
      cloud: 'GCP',
      service: 'Compute Engine',
      instanceType: 'europe-vm',
      region: 'europe-west1',
      vCpu: 4,
      memoryGb: 16,
      baseLatencyMs: 140,
      carbonIntensity: 316.4,
      cost: { totalCost: 14.0 },
      carbon: { totalEmissionsKg: 1.1 } // Lowest Carbon
    }
  ];

  test('Baseline Cost Optimization selects candidate with lowest cost', () => {
    const dec = computeBaselineDecision({ optimization_mode: 'Cost Optimized', duration: 24, job_id: 'test_job' }, dummyFeasible);
    assert.strictEqual(dec.success, true);
    assert.strictEqual(dec.recommendation.cloud, 'Azure');
    assert.strictEqual(dec.recommendation.cost.totalCost, 12.0);
  });

  test('Baseline Carbon Optimization selects candidate with lowest carbon', () => {
    const dec = computeBaselineDecision({ optimization_mode: 'Carbon Optimized', duration: 24, job_id: 'test_job' }, dummyFeasible);
    assert.strictEqual(dec.success, true);
    assert.strictEqual(dec.recommendation.cloud, 'GCP');
    assert.strictEqual(dec.recommendation.carbon.totalEmissionsKg, 1.1);
  });

  // 5. Job Service End-to-End Test
  console.log('\n--- Testing Job Service & SQLite Persistence ---');
  const jobResult = await createAndEvaluateJob({
    workload_name: 'Automated CI/CD Test Pipeline',
    cpu: 2,
    memory: 8,
    duration: 12,
    max_cost: 10.0,
    data_residency: 'India',
    optimization_mode: 'Cost Optimized',
    geo_keys: ['india']
  });

  test('JobService evaluates candidates and persists to SQLite', () => {
    assert.ok(jobResult.job.job_id);
    assert.ok(jobResult.totalEvaluated > 0);
    assert.ok(jobResult.feasibleCount > 0);
    assert.ok(jobResult.infeasibleCount >= 0);

    const retrieved = getJobById(jobResult.job.job_id);
    assert.ok(retrieved.job);
    assert.strictEqual(retrieved.job.job_id, jobResult.job.job_id);
    assert.strictEqual(retrieved.options.length, jobResult.totalEvaluated);
  });

  console.log(`\n=============================================`);
  console.log(`Phase 3 Test Results: ${passed}/${total} passed`);
  console.log(`=============================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
