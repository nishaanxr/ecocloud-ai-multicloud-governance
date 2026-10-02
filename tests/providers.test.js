/**
 * Automated Test Suite for Phase 2: Providers and Carbon Data
 * Verifies that AWS, Azure, GCP adapters and Carbon provider adhere to the data rules.
 */

const assert = require('assert');
const { getAwsComputePricing } = require('../backend/src/providers/aws');
const { getAzureComputePricing } = require('../backend/src/providers/azure');
const { getGcpComputePricing } = require('../backend/src/providers/gcp');
const { getCarbonIntensity } = require('../backend/src/carbon/carbonProvider');
const { REGIONS_CONFIG } = require('../backend/src/config/regions');

async function runTests() {
  console.log('🧪 Starting Phase 2 Provider & Carbon Verification Tests...\n');
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

  // 1. Regions Config Test
  test('REGIONS_CONFIG defines 4 target geographies', () => {
    const keys = Object.keys(REGIONS_CONFIG);
    assert.strictEqual(keys.length, 4, 'Should define exactly 4 regions');
    assert.ok(keys.includes('india'));
    assert.ok(keys.includes('us_east'));
    assert.ok(keys.includes('europe_west'));
    assert.ok(keys.includes('southeast_asia'));
  });

  // 2. Azure Provider Test
  console.log('\n--- Testing Azure Provider ---');
  const azureCentralIndia = await getAzureComputePricing('centralindia');
  test('Azure provider returns instances for centralindia', () => {
    assert.ok(Array.isArray(azureCentralIndia));
    assert.ok(azureCentralIndia.length > 0, 'Should return at least 1 instance');
  });

  test('Azure instance contains required fields and valid provenance', () => {
    const item = azureCentralIndia[0];
    assert.strictEqual(item.cloud, 'Azure');
    assert.strictEqual(item.service, 'Virtual Machines');
    assert.ok(item.instanceType);
    assert.ok(typeof item.vCpu === 'number' && item.vCpu > 0);
    assert.ok(typeof item.memoryGb === 'number' && item.memoryGb > 0);
    assert.ok(typeof item.hourlyPrice === 'number' && item.hourlyPrice > 0);
    assert.ok(item.source, 'Source must be specified');
    assert.ok(['live', 'reference-benchmark'].includes(item.status), 'Status must be live or reference-benchmark');
    assert.ok(item.fetchedAt, 'fetchedAt must be present');
    assert.strictEqual(item.dataResidency, 'India');
  });

  // 3. AWS Provider Test
  console.log('\n--- Testing AWS Provider ---');
  const awsMumbai = await getAwsComputePricing('ap-south-1');
  test('AWS provider returns instances for ap-south-1', () => {
    assert.ok(Array.isArray(awsMumbai));
    assert.strictEqual(awsMumbai.length, 11);
  });

  test('AWS instance contains required fields and valid provenance', () => {
    const item = awsMumbai[0];
    assert.strictEqual(item.cloud, 'AWS');
    assert.strictEqual(item.service, 'EC2');
    assert.ok(item.instanceType);
    assert.ok(typeof item.vCpu === 'number');
    assert.ok(typeof item.memoryGb === 'number');
    assert.ok(typeof item.hourlyPrice === 'number' && item.hourlyPrice > 0);
    assert.ok(item.source);
    assert.strictEqual(item.status, 'reference-benchmark');
    assert.ok(item.fetchedAt);
  });

  // 4. GCP Provider Test
  console.log('\n--- Testing GCP Provider ---');
  const gcpMumbai = await getGcpComputePricing('asia-south1');
  test('GCP provider returns instances for asia-south1', () => {
    assert.ok(Array.isArray(gcpMumbai));
    assert.strictEqual(gcpMumbai.length, 11);
  });

  test('GCP instance contains required fields and valid provenance', () => {
    const item = gcpMumbai[0];
    assert.strictEqual(item.cloud, 'GCP');
    assert.strictEqual(item.service, 'Compute Engine');
    assert.ok(item.instanceType);
    assert.ok(typeof item.vCpu === 'number');
    assert.ok(typeof item.memoryGb === 'number');
    assert.ok(typeof item.hourlyPrice === 'number' && item.hourlyPrice > 0);
    assert.ok(item.source);
    assert.ok(item.fetchedAt);
  });

  // 5. Carbon Intensity Provider Test
  console.log('\n--- Testing Carbon Intensity Provider ---');
  const carbonIndia = await getCarbonIntensity('AWS', 'ap-south-1');
  test('Carbon provider returns accurate emission factor for India (708.2 gCO2eq/kWh)', () => {
    assert.strictEqual(carbonIndia.carbonIntensity, 708.2);
    assert.strictEqual(carbonIndia.unit, 'gCO2eq/kWh');
    assert.strictEqual(carbonIndia.dataResidency, 'India');
    assert.ok(carbonIndia.source);
    assert.ok(carbonIndia.fetchedAt);
  });

  const carbonUSEast = await getCarbonIntensity('Azure', 'eastus');
  test('Carbon provider returns accurate emission factor for US East (379 gCO2eq/kWh)', () => {
    assert.strictEqual(carbonUSEast.carbonIntensity, 379.0);
    assert.strictEqual(carbonUSEast.dataResidency, 'United States');
  });

  console.log(`\n=============================================`);
  console.log(`Test Results: ${passed}/${total} passed`);
  console.log(`=============================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
