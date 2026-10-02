const express = require('express');
const router = express.Router();

const { createAndEvaluateJob, getJobById, listJobs } = require('../services/jobService');
const { computeBaselineDecision } = require('../services/baselineService');

/**
 * POST /api/jobs
 * Submit a new workload requirement, evaluate candidates across clouds,
 * apply deterministic hard constraints, and compute baseline recommendation.
 */
router.post('/', async (req, res, next) => {
  try {
    const jobInput = req.body || {};

    // 1. Create job, retrieve candidates, compute deterministic costs/carbon, evaluate hard constraints
    const evaluation = await createAndEvaluateJob(jobInput);

    // 2. Compute baseline placement recommendation
    const baseline = computeBaselineDecision(evaluation.job, evaluation.feasibleOptions);

    res.status(201).json({
      status: 'ok',
      jobId: evaluation.job.job_id,
      job: evaluation.job,
      summary: {
        totalEvaluated: evaluation.totalEvaluated,
        feasibleCount: evaluation.feasibleCount,
        infeasibleCount: evaluation.infeasibleCount
      },
      baselineRecommendation: baseline,
      feasibleCandidates: evaluation.feasibleOptions,
      infeasibleCandidates: evaluation.infeasibleOptions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jobs
 * List recent jobs from SQLite
 */
router.get('/', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const jobs = listJobs(limit);
    res.json({
      status: 'ok',
      count: jobs.length,
      jobs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jobs/:jobId
 * Retrieve specific job and its evaluated cloud options
 */
router.get('/:jobId', (req, res, next) => {
  try {
    const data = getJobById(req.params.jobId);
    if (!data) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Job ${req.params.jobId} was not found.`
      });
    }

    res.json({
      status: 'ok',
      data
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
