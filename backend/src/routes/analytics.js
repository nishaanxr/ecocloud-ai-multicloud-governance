/**
 * Analytics Routes
 * Exposes endpoints for comparative governance statistics and historical trends.
 */

const express = require('express');
const router = express.Router();
const { getAnalyticsSummary } = require('../services/analyticsService');

/**
 * GET /api/analytics/summary
 * Returns high-level governance KPI summary, cloud distributions, and recent decisions
 */
router.get('/summary', (req, res) => {
  try {
    const summary = getAnalyticsSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error('[AnalyticsRoute] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
