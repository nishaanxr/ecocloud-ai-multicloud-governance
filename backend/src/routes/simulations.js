/**
 * Workload Simulation Routes
 * Exposes endpoints to trigger local workload simulations and query execution telemetry.
 */

const express = require('express');
const router = express.Router();
const { runAndPersistSimulation, getSimulationsByJobId, getSimulationById } = require('../services/simulationService');

/**
 * POST /api/simulations/run
 * Trigger workload execution simulation
 */
router.post('/run', async (req, res) => {
  try {
    const { jobId, placement, options } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required to run a simulation.' });
    }

    const simulation = await runAndPersistSimulation(jobId, placement, options);
    res.status(201).json({
      success: true,
      simulation
    });
  } catch (err) {
    console.error('[SimulationRoute] Execution error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/simulations/job/:jobId
 * Retrieve all simulations for a given job
 */
router.get('/job/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const simulations = getSimulationsByJobId(jobId);
    res.json({
      success: true,
      jobId,
      count: simulations.length,
      simulations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/simulations/:id
 * Retrieve simulation by ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const simulation = getSimulationById(id);
    if (!simulation) {
      return res.status(404).json({ success: false, error: `Simulation #${id} not found.` });
    }
    res.json({ success: true, simulation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
