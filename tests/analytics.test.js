/**
 * Phase 6 Unit Tests: Portfolio Analytics & Historical Governance
 */

const assert = require('assert');
const { getAnalyticsSummary } = require('../backend/src/services/analyticsService');

function runAnalyticsTests() {
  console.log('\n🧪 Starting Phase 6 Analytics & Portfolio Verification Tests...\n');

  const summary = getAnalyticsSummary();

  assert(summary.overview !== undefined, 'Overview object must be present');
  assert(typeof summary.overview.totalWorkloadsGoverned === 'number', 'totalWorkloadsGoverned must be a number');
  assert(typeof summary.overview.totalDecisionsRecorded === 'number', 'totalDecisionsRecorded must be a number');
  assert(typeof summary.overview.cumulativeEstimatedCostUsd === 'number', 'cumulativeEstimatedCostUsd must be a number');
  assert(typeof summary.overview.cumulativeCarbonKg === 'number', 'cumulativeCarbonKg must be a number');
  assert(summary.overview.slaComplianceRatePercent === 100, 'SLA compliance must be 100%');
  console.log(`  ✅ PASS: getAnalyticsSummary returns valid overview KPIs (${summary.overview.totalWorkloadsGoverned} workloads, $${summary.overview.cumulativeEstimatedCostUsd} spend)`);

  assert(summary.cloudDistribution !== undefined, 'cloudDistribution must be present');
  assert(summary.cloudDistribution.counts.AWS !== undefined, 'AWS count must exist');
  assert(summary.cloudDistribution.counts.Azure !== undefined, 'Azure count must exist');
  assert(summary.cloudDistribution.counts.GCP !== undefined, 'GCP count must exist');
  console.log(`  ✅ PASS: Cloud distribution breakdown computed across AWS, Azure, and GCP`);

  assert(Array.isArray(summary.recentDecisions), 'recentDecisions must be an array');
  assert(Array.isArray(summary.recentSimulations), 'recentSimulations must be an array');
  console.log(`  ✅ PASS: Historical decisions ledger (${summary.recentDecisions.length}) and simulations (${summary.recentSimulations.length}) retrieved`);

  console.log('\n=============================================');
  console.log('Phase 6 Test Results: 3/3 passed');
  console.log('=============================================\n');
}

try {
  runAnalyticsTests();
} catch (err) {
  console.error('❌ Phase 6 Test Failed:', err);
  process.exit(1);
}
