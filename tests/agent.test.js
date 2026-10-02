/**
 * Automated Test Suite for Phase 4: Gemini Agentic Orchestrator & Tool Registry
 * Verifies tool declarations, tool execution, fallback mechanics, and SQLite persistence.
 */

const assert = require('assert');
const { toolDeclarations, executeTool } = require('../backend/src/agent/toolRegistry');
const { runGovernanceAgent } = require('../backend/src/agent/geminiAgent');
const { evaluateAndPersistDecision, getDecisionById } = require('../backend/src/services/decisionService');
const { createAndEvaluateJob } = require('../backend/src/services/jobService');

async function runTests() {
  console.log('🧪 Starting Phase 4 Agent & Tool Calling Tests...\n');
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

  // 1. Tool Registry Declarations Test
  console.log('--- Testing Tool Declarations ---');
  test('Tool registry declares all 5 mandatory tools for Gemini', () => {
    assert.strictEqual(toolDeclarations.length, 5);
    const names = toolDeclarations.map(t => t.name);
    assert.ok(names.includes('getCloudPricing'));
    assert.ok(names.includes('getCarbonIntensity'));
    assert.ok(names.includes('calculateEstimatedCost'));
    assert.ok(names.includes('calculateEstimatedCarbon'));
    assert.ok(names.includes('checkFeasibility'));
  });

  test('Tool declarations contain valid JSON schemas with required properties', () => {
    for (const tool of toolDeclarations) {
      assert.ok(tool.name, 'Tool must have a name');
      assert.ok(tool.description, 'Tool must have a description');
      assert.ok(tool.parametersJsonSchema, 'Tool must have parametersJsonSchema');
      assert.strictEqual(tool.parametersJsonSchema.type, 'object');
      assert.ok(Array.isArray(tool.parametersJsonSchema.required));
    }
  });

  // 2. Tool Execution Tests
  console.log('\n--- Testing Tool Execution Handlers ---');
  test('executeTool(getCloudPricing) returns instance options', async () => {
    const res = await executeTool('getCloudPricing', { cloud: 'AWS', region: 'ap-south-1' });
    assert.strictEqual(res.cloud, 'AWS');
    assert.strictEqual(res.region, 'ap-south-1');
    assert.ok(res.instanceCount > 0);
    assert.ok(Array.isArray(res.instances));
  });

  test('executeTool(getCarbonIntensity) returns emission factors', async () => {
    const res = await executeTool('getCarbonIntensity', { cloud: 'AWS', region: 'ap-south-1' });
    assert.strictEqual(res.carbonIntensity, 708.2);
    assert.strictEqual(res.dataResidency, 'India');
  });

  test('executeTool(calculateEstimatedCost) returns exact deterministic cost', async () => {
    const res = await executeTool('calculateEstimatedCost', {
      hourlyPrice: 0.20,
      durationHours: 50,
      storageGb: 100
    });
    // 0.20 * 50 = $10.00 compute. 100 * 0.08 * (50/730) = $0.5479 storage
    assert.strictEqual(res.computeCost, 10.00);
    assert.strictEqual(res.storageCost, 0.5479);
    assert.strictEqual(res.totalCost, 10.5479);
  });

  test('executeTool(calculateEstimatedCarbon) returns exact energy and emissions', async () => {
    const res = await executeTool('calculateEstimatedCarbon', {
      vCpu: 4,
      memoryGb: 16,
      durationHours: 24,
      carbonIntensity: 708.2
    });
    assert.ok(res.energyKwh > 0);
    assert.ok(res.totalEmissionsKg > 0);
    assert.strictEqual(res.carbonIntensity, 708.2);
  });

  test('executeTool(checkFeasibility) enforces hard constraints correctly', async () => {
    const mockJob = { cpu: 4, memory: 16, max_cost: 20.0, data_residency: 'India' };
    
    // Passing candidate
    const passCandidate = { vCpu: 4, memoryGb: 16, baseLatencyMs: 20, dataResidency: 'India', region: 'ap-south-1', estimatedTotalCost: 15.0 };
    const passRes = await executeTool('checkFeasibility', passCandidate, { job: mockJob });
    assert.strictEqual(passRes.feasible, true);

    // Failing candidate (insufficient RAM)
    const failCandidate = { vCpu: 4, memoryGb: 8, baseLatencyMs: 20, dataResidency: 'India', region: 'ap-south-1', estimatedTotalCost: 15.0 };
    const failRes = await executeTool('checkFeasibility', failCandidate, { job: mockJob });
    assert.strictEqual(failRes.feasible, false);
    assert.ok(failRes.violations.some(v => v.includes('Memory capacity insufficient')));
  });

  // 3. Fallback Mechanics Test
  console.log('\n--- Testing Gemini Agent Fallback Mechanics ---');
  test('runGovernanceAgent falls back to deterministic baseline when API key is missing', async () => {
    const dummyJob = {
      job_id: 'test_agent_fallback',
      cpu: 2,
      memory: 8,
      duration: 12,
      optimization_mode: 'Cost Optimized'
    };
    const dummyCandidates = [
      {
        cloud: 'AWS',
        instanceType: 't3.large',
        service: 'EC2',
        region: 'ap-south-1',
        vCpu: 2,
        memoryGb: 8,
        cost: { totalCost: 1.50 },
        carbon: { totalEmissionsKg: 0.20 },
        baseLatencyMs: 20
      }
    ];

    const result = await runGovernanceAgent(dummyJob, dummyCandidates);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.decisionSource, 'fallback-deterministic');
    assert.ok(result.recommendation);
    assert.strictEqual(result.recommendation.cloud, 'AWS');
  });

  // 4. Decision Service & SQLite Persistence Test
  console.log('\n--- Testing Decision Service SQLite Persistence ---');
  const evaluation = await createAndEvaluateJob({
    workload_name: 'Phase 4 Automated Verification Job',
    cpu: 2,
    memory: 8,
    duration: 10,
    max_cost: 15.0,
    data_residency: 'India',
    optimization_mode: 'Cost Optimized',
    geo_keys: ['india']
  });

  const decisionPackage = await evaluateAndPersistDecision(evaluation.job, evaluation.feasibleOptions);
  
  test('DecisionService persists decision to SQLite with valid ID', () => {
    assert.ok(decisionPackage.decisionId, 'Should return a valid decisionId');
    assert.strictEqual(decisionPackage.jobId, evaluation.job.job_id);
    assert.ok(decisionPackage.agentDecision);
    assert.ok(decisionPackage.baselineDecision);
    assert.ok(decisionPackage.comparativeAnalysis);

    const retrieved = getDecisionById(decisionPackage.decisionId);
    assert.ok(retrieved.decision);
    assert.strictEqual(retrieved.decision.id, decisionPackage.decisionId);
    assert.strictEqual(retrieved.decision.job_id, evaluation.job.job_id);
  });

  console.log(`\n=============================================`);
  console.log(`Phase 4 Test Results: ${passed}/${total} passed`);
  console.log(`=============================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Phase 4 Test execution failed:', err);
  process.exit(1);
});
