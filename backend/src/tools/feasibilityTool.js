/**
 * Deterministic Feasibility and Hard-Constraint Tool
 * Enforces non-negotiable boundaries:
 * 1. CPU capacity >= required
 * 2. Memory (RAM) >= required
 * 3. Total Estimated Cost <= max_cost (if specified)
 * 4. Network Latency <= max_latency (if specified)
 * 5. Data Residency boundary compliance (if specified)
 * 6. Target Region compliance (if specified)
 */

/**
 * Check if a candidate cloud option satisfies all mandatory hard constraints
 * @param {Object} candidate - Normalized cloud option (vCpu, memoryGb, baseLatencyMs, dataResidency, region)
 * @param {Object} job - Workload specifications (cpu, memory, max_cost, max_latency, data_residency, target_region)
 * @param {number} estimatedTotalCost - Calculated total cost for workload duration
 * @returns {Object} Feasibility evaluation result
 */
function checkFeasibility(candidate, job, estimatedTotalCost) {
  const violations = [];

  // 1. CPU Requirement (Mandatory)
  const cpuSatisfied = candidate.vCpu >= job.cpu;
  if (!cpuSatisfied) {
    violations.push(`CPU capacity insufficient: candidate offers ${candidate.vCpu} vCPU, job requires ${job.cpu} vCPU.`);
  }

  // 2. Memory Requirement (Mandatory)
  const memorySatisfied = candidate.memoryGb >= job.memory;
  if (!memorySatisfied) {
    violations.push(`Memory capacity insufficient: candidate offers ${candidate.memoryGb} GiB, job requires ${job.memory} GiB.`);
  }

  // 3. Maximum Budget (Hard constraint if set)
  let budgetSatisfied = true;
  if (typeof job.max_cost === 'number' && job.max_cost > 0) {
    budgetSatisfied = estimatedTotalCost <= job.max_cost;
    if (!budgetSatisfied) {
      violations.push(`Cost exceeds maximum budget: estimated $${estimatedTotalCost.toFixed(2)}, budget limit $${job.max_cost.toFixed(2)}.`);
    }
  }

  // 4. Maximum Latency (Hard constraint if set)
  let latencySatisfied = true;
  if (typeof job.max_latency === 'number' && job.max_latency > 0) {
    latencySatisfied = candidate.baseLatencyMs <= job.max_latency;
    if (!latencySatisfied) {
      violations.push(`Latency exceeds threshold: estimated ~${candidate.baseLatencyMs} ms, maximum acceptable is ${job.max_latency} ms.`);
    }
  }

  // 5. Data Residency (Hard constraint if set and not 'Any')
  let residencySatisfied = true;
  if (job.data_residency && job.data_residency.trim().toLowerCase() !== 'any') {
    const candidateResidency = (candidate.dataResidency || '').toLowerCase().trim();
    const reqResidency = job.data_residency.toLowerCase().trim();
    residencySatisfied = candidateResidency === reqResidency;
    if (!residencySatisfied) {
      violations.push(`Data residency mismatch: candidate located in ${candidate.dataResidency}, required: ${job.data_residency}.`);
    }
  }

  // 6. Target Region (if explicitly constrained by job)
  let regionSatisfied = true;
  if (job.target_region && job.target_region.trim().toLowerCase() !== 'any') {
    const reqRegion = job.target_region.toLowerCase().trim();
    regionSatisfied = candidate.region.toLowerCase().trim() === reqRegion;
    if (!regionSatisfied) {
      violations.push(`Region mismatch: candidate in ${candidate.region}, required: ${job.target_region}.`);
    }
  }

  const isFeasible = violations.length === 0;

  return {
    feasible: isFeasible,
    violations,
    summary: isFeasible ? 'All hard constraints satisfied' : violations.join(' | '),
    checks: {
      cpu: cpuSatisfied,
      memory: memorySatisfied,
      budget: budgetSatisfied,
      latency: latencySatisfied,
      dataResidency: residencySatisfied,
      region: regionSatisfied
    }
  };
}

module.exports = {
  checkFeasibility
};
