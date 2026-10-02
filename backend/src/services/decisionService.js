/**
 * Decision Service
 * Coordinates the Gemini Agent evaluation and Deterministic Baseline,
 * saves decisions and tool execution trajectories into SQLite,
 * and computes comparative analytics between AI and Baseline.
 */

const { db } = require('../database/database');
const { runGovernanceAgent } = require('../agent/geminiAgent');
const { computeBaselineDecision } = require('./baselineService');
const { getJobById } = require('./jobService');

/**
 * Evaluate workload through Gemini Agent and Baseline Engine
 * @param {Object} job - Workload specifications
 * @param {Array<Object>} feasibleCandidates - Filtered candidates satisfying hard constraints
 * @returns {Promise<Object>} Full evaluation package with comparative metrics
 */
async function evaluateAndPersistDecision(job, feasibleCandidates = []) {
  // 1. Run Deterministic Baseline Decision
  const baselineResult = computeBaselineDecision(job, feasibleCandidates);

  // 2. Run Gemini Agentic Orchestrator
  const agentResult = await runGovernanceAgent(job, feasibleCandidates);

  // 3. Persist Agent Decision to SQLite
  let decisionId = null;
  const rec = agentResult.recommendation;

  if (rec) {
    try {
      const insertDecisionStmt = db.prepare(`
        INSERT INTO decisions (
          job_id, cloud, service, region, estimated_cost, carbon_intensity,
          estimated_carbon, latency, decision_source, reasoning, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const result = insertDecisionStmt.run(
        job.job_id,
        rec.cloud,
        rec.service || 'Compute',
        rec.region,
        rec.cost ? (rec.cost.totalCost || 0) : 0,
        rec.carbonIntensity || 500,
        rec.carbon ? (rec.carbon.totalEmissionsKg || 0) : 0,
        rec.baseLatencyMs || 50,
        agentResult.decisionSource || 'gemini-agent',
        rec.explanation || agentResult.reasoning || ''
      );

      decisionId = result.lastInsertRowid;

      // 4. Persist each tool call from Gemini's trajectory into tool_calls table
      if (agentResult.toolCalls && agentResult.toolCalls.length > 0 && decisionId) {
        const insertToolCallStmt = db.prepare(`
          INSERT INTO tool_calls (
            decision_id, tool_name, input, output, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `);

        const insertManyToolCalls = db.transaction((calls) => {
          for (const call of calls) {
            insertToolCallStmt.run(
              decisionId,
              call.tool_name,
              typeof call.input === 'string' ? call.input : JSON.stringify(call.input),
              typeof call.output === 'string' ? call.output : JSON.stringify(call.output),
              call.created_at || new Date().toISOString()
            );
          }
        });

        insertManyToolCalls(agentResult.toolCalls);
        console.log(`[DecisionService] Persisted ${agentResult.toolCalls.length} tool calls for decision #${decisionId}.`);
      }
    } catch (err) {
      console.error('[DecisionService] Failed to persist decision or tool calls:', err.message);
    }
  }

  // 5. Compute Comparative Analysis between Agent and Baseline
  let comparativeAnalysis = null;
  if (rec && baselineResult.recommendation) {
    const baseRec = baselineResult.recommendation;
    const costDiff = rec.cost.totalCost - baseRec.cost.totalCost;
    const carbonDiff = rec.carbon.totalEmissionsKg - baseRec.carbon.totalEmissionsKg;
    const latencyDiff = rec.baseLatencyMs - baseRec.baseLatencyMs;
    const isIdentical = rec.cloud === baseRec.cloud && rec.instanceType === baseRec.instanceType;

    comparativeAnalysis = {
      isIdentical,
      agentChoice: `${rec.cloud} ${rec.instanceType} (${rec.region})`,
      baselineChoice: `${baseRec.cloud} ${baseRec.instanceType} (${baseRec.region})`,
      costDeltaUsd: parseFloat(costDiff.toFixed(2)),
      carbonDeltaKg: parseFloat(carbonDiff.toFixed(3)),
      latencyDeltaMs: parseFloat(latencyDiff.toFixed(1)),
      summary: isIdentical
        ? 'Gemini Agent and Deterministic Baseline converged on the identical optimal placement.'
        : `Gemini opted for a different trade-off profile (Δ Cost: ${costDiff >= 0 ? '+' : ''}$${costDiff.toFixed(2)}, Δ Carbon: ${carbonDiff >= 0 ? '+' : ''}${carbonDiff.toFixed(3)} kg).`
    };
  }

  return {
    decisionId,
    jobId: job.job_id,
    agentDecision: agentResult,
    baselineDecision: baselineResult,
    comparativeAnalysis,
    toolCallsCount: (agentResult.toolCalls || []).length
  };
}

/**
 * Retrieve a decision and all its recorded tool calls from SQLite
 * @param {number} decisionId 
 */
function getDecisionById(decisionId) {
  const decision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
  if (!decision) return null;

  const toolCalls = db.prepare('SELECT * FROM tool_calls WHERE decision_id = ? ORDER BY id ASC').all(decisionId);
  return {
    decision,
    toolCalls
  };
}

/**
 * Retrieve all decisions associated with a job
 * @param {string} jobId 
 */
function getDecisionsByJobId(jobId) {
  return db.prepare('SELECT * FROM decisions WHERE job_id = ? ORDER BY id DESC').all(jobId);
}

module.exports = {
  evaluateAndPersistDecision,
  getDecisionById,
  getDecisionsByJobId
};
