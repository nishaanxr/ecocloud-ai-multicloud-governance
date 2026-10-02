/**
 * Deterministic Baseline Service
 * Provides the mathematical benchmark decision engine.
 * Serves as:
 * 1. Immediate fallback if Gemini is offline or unconfigured.
 * 2. Benchmark for comparative analytics evaluation against the Agentic AI.
 */

const { db } = require('../database/database');

/**
 * Compute the deterministic baseline recommendation for a set of feasible options
 * @param {Object} job - Workload record
 * @param {Array<Object>} feasibleOptions - Options passing all hard constraints
 * @returns {Object} Baseline placement recommendation
 */
function computeBaselineDecision(job, feasibleOptions) {
  if (!feasibleOptions || feasibleOptions.length === 0) {
    return {
      success: false,
      reason: 'No feasible cloud candidates satisfied the mandatory hard constraints.',
      recommendation: null
    };
  }

  const mode = (job.optimization_mode || 'Cost Optimized').trim();
  let ranked = [...feasibleOptions];
  let decisionReasoning = '';

  if (mode === 'Cost Optimized') {
    // Sort strictly by total estimated cost (ascending)
    ranked.sort((a, b) => a.cost.totalCost - b.cost.totalCost);
    const best = ranked[0];
    decisionReasoning = `Baseline Cost-Optimization selected ${best.cloud} ${best.instanceType} (${best.region}) with the lowest total estimated cost of $${best.cost.totalCost.toFixed(2)} USD for ${job.duration} hours.`;
  } else if (mode === 'Carbon Optimized') {
    // Sort strictly by total emissions in kg (ascending)
    ranked.sort((a, b) => a.carbon.totalEmissionsKg - b.carbon.totalEmissionsKg);
    const best = ranked[0];
    decisionReasoning = `Baseline Carbon-Optimization selected ${best.cloud} ${best.instanceType} (${best.region}) with the lowest total emissions of ${best.carbon.totalEmissionsKg.toFixed(3)} kg CO2eq (grid factor: ${best.carbonIntensity} gCO2eq/kWh).`;
  } else if (mode === 'Performance Optimized') {
    // Sort by network latency (ascending), tie-break by vCPU (descending)
    ranked.sort((a, b) => {
      if (a.baseLatencyMs !== b.baseLatencyMs) {
        return a.baseLatencyMs - b.baseLatencyMs;
      }
      return b.vCpu - a.vCpu;
    });
    const best = ranked[0];
    decisionReasoning = `Baseline Performance-Optimization selected ${best.cloud} ${best.instanceType} (${best.region}) with lowest network latency (~${best.baseLatencyMs} ms) and ${best.vCpu} vCPUs.`;
  } else {
    // Balanced Mode: Multi-Objective Min-Max Normalization
    // Score = 0.45 * normCost + 0.35 * normCarbon + 0.20 * normLatency
    const minCost = Math.min(...ranked.map(o => o.cost.totalCost));
    const maxCost = Math.max(...ranked.map(o => o.cost.totalCost)) || minCost + 1;

    const minCarbon = Math.min(...ranked.map(o => o.carbon.totalEmissionsKg));
    const maxCarbon = Math.max(...ranked.map(o => o.carbon.totalEmissionsKg)) || minCarbon + 1;

    const minLat = Math.min(...ranked.map(o => o.baseLatencyMs));
    const maxLat = Math.max(...ranked.map(o => o.baseLatencyMs)) || minLat + 1;

    ranked.forEach(opt => {
      const normCost = (opt.cost.totalCost - minCost) / (maxCost - minCost || 1);
      const normCarbon = (opt.carbon.totalEmissionsKg - minCarbon) / (maxCarbon - minCarbon || 1);
      const normLat = (opt.baseLatencyMs - minLat) / (maxLat - minLat || 1);
      opt.balancedScore = (0.45 * normCost) + (0.35 * normCarbon) + (0.20 * normLat);
    });

    ranked.sort((a, b) => a.balancedScore - b.balancedScore);
    const best = ranked[0];
    decisionReasoning = `Baseline Balanced Multi-Objective scoring selected ${best.cloud} ${best.instanceType} (${best.region}) with optimal Pareto trade-off (cost: $${best.cost.totalCost.toFixed(2)}, carbon: ${best.carbon.totalEmissionsKg.toFixed(3)} kg, latency: ~${best.baseLatencyMs} ms).`;
  }

  const recommendation = ranked[0];

  // Persist decision to SQLite if the job is persisted in the database
  try {
    const jobExists = db.prepare('SELECT 1 FROM jobs WHERE job_id = ?').get(job.job_id);
    if (jobExists) {
      const insertDecisionStmt = db.prepare(`
        INSERT INTO decisions (
          job_id, cloud, service, region, estimated_cost, carbon_intensity,
          estimated_carbon, latency, decision_source, reasoning, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      insertDecisionStmt.run(
        job.job_id,
        recommendation.cloud,
        recommendation.service,
        recommendation.region,
        recommendation.cost.totalCost,
        recommendation.carbonIntensity,
        recommendation.carbon.totalEmissionsKg,
        recommendation.baseLatencyMs,
        'deterministic-baseline',
        decisionReasoning
      );
    }
  } catch (err) {
    console.error('[BaselineService] Failed to record decision in SQLite:', err.message);
  }

  return {
    success: true,
    optimizationMode: mode,
    decisionSource: 'deterministic-baseline',
    recommendation,
    reasoning: decisionReasoning,
    topRanked: ranked.slice(0, 5)
  };
}

module.exports = {
  computeBaselineDecision
};
