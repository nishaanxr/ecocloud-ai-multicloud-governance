const express = require('express');
const router = express.Router();

const { evaluateAndPersistDecision, getDecisionById, getDecisionsByJobId } = require('../services/decisionService');
const { createAndEvaluateJob, getJobById } = require('../services/jobService');

/**
 * POST /api/decisions/evaluate
 * Trigger the Gemini Agentic evaluation and Deterministic Baseline for a workload.
 * Accepts either { jobId } or full workload parameters.
 */
router.post('/evaluate', async (req, res, next) => {
  try {
    let job;
    let feasibleCandidates = [];

    if (req.body.jobId) {
      // 1. Fetch existing job and options from SQLite
      const existing = getJobById(req.body.jobId);
      if (!existing) {
        return res.status(404).json({ error: 'Not Found', message: `Job ${req.body.jobId} does not exist.` });
      }
      job = existing.job;
      // Re-map feasible candidates with cost/carbon objects
      feasibleCandidates = (existing.options || []).filter(o => o.feasible === 1).map(o => ({
        ...o,
        cost: { totalCost: (o.pricing || 0.1) * (job.duration || 24) },
        carbon: { totalEmissionsKg: ((o.carbon_intensity || 500) * 0.05 * (job.duration || 24)) / 1000 },
        baseLatencyMs: o.latency || 50
      }));
    } else {
      // 2. Create job and evaluate hard constraints first
      const evaluation = await createAndEvaluateJob(req.body);
      job = evaluation.job;
      feasibleCandidates = evaluation.feasibleOptions;
    }

    // 3. Run Gemini Agent & Baseline evaluation and persist decisions & tool calls
    const result = await evaluateAndPersistDecision(job, feasibleCandidates);

    res.status(201).json({
      status: 'ok',
      jobId: job.job_id,
      decisionId: result.decisionId,
      agentDecision: result.agentDecision,
      baselineDecision: result.baselineDecision,
      comparativeAnalysis: result.comparativeAnalysis,
      toolCallsCount: result.toolCallsCount
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/decisions/:id
 * Retrieve a decision and all its recorded tool calls
 */
router.get('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = getDecisionById(id);
    if (!data) {
      return res.status(404).json({ error: 'Not Found', message: `Decision #${id} was not found.` });
    }

    res.json({
      status: 'ok',
      data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/decisions/job/:jobId
 * Retrieve all decisions for a given job
 */
router.get('/job/:jobId', (req, res, next) => {
  try {
    const decisions = getDecisionsByJobId(req.params.jobId);
    res.json({
      status: 'ok',
      count: decisions.length,
      decisions
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
