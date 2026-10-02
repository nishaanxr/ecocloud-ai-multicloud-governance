document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Status Elements
  const statusDot = document.getElementById('statusDot');
  const systemStatusText = document.getElementById('systemStatusText');
  const apiLatencyVal = document.getElementById('apiLatencyVal');
  const dbStatus = document.getElementById('dbStatus');
  const uptimeValue = document.getElementById('uptimeValue');
  const phaseValue = document.getElementById('phaseValue');
  const apiResponse = document.getElementById('apiResponse');
  const refreshBtn = document.getElementById('refreshBtn');

  // Metrics Elements
  const regionSelect = document.getElementById('regionSelect');
  const tabButtons = document.querySelectorAll('.tab-item[data-cloud]');
  const metricRegion = document.getElementById('metricRegion');
  const metricResidency = document.getElementById('metricResidency');
  const metricLatency = document.getElementById('metricLatency');
  const metricCarbon = document.getElementById('metricCarbon');
  const metricGridZone = document.getElementById('metricGridZone');
  
  // Inventory Elements
  const provenanceSource = document.getElementById('provenanceSource');
  const provenanceStatusBadge = document.getElementById('provenanceStatusBadge');
  const instancesTableBody = document.getElementById('instancesTableBody');

  // Workload Form Elements
  const workloadForm = document.getElementById('workloadForm');
  const evaluateBtn = document.getElementById('evaluateBtn');
  const evaluationResults = document.getElementById('evaluationResults');
  const resTotalEvaluated = document.getElementById('resTotalEvaluated');
  const resFeasibleCount = document.getElementById('resFeasibleCount');
  const resInfeasibleCount = document.getElementById('resInfeasibleCount');
  const badgeFeasibleCount = document.getElementById('badgeFeasibleCount');
  const badgeInfeasibleCount = document.getElementById('badgeInfeasibleCount');
  const badgeTrajectoryCount = document.getElementById('badgeTrajectoryCount');
  
  // Decision Comparison Elements
  const agentWinner = document.getElementById('agentWinner');
  const agentCost = document.getElementById('agentCost');
  const agentCarbon = document.getElementById('agentCarbon');
  const agentLatency = document.getElementById('agentLatency');
  const agentRegion = document.getElementById('agentRegion');
  const agentReasoning = document.getElementById('agentReasoning');
  const agentSourceBadge = document.getElementById('agentSourceBadge');

  const recWinner = document.getElementById('recWinner');
  const recCost = document.getElementById('recCost');
  const recCarbon = document.getElementById('recCarbon');
  const recLatency = document.getElementById('recLatency');
  const recRegion = document.getElementById('recRegion');
  const recReasoning = document.getElementById('recReasoning');

  const deltaCost = document.getElementById('deltaCost');
  const deltaCarbon = document.getElementById('deltaCarbon');
  const deltaLatency = document.getElementById('deltaLatency');
  const deltaSummary = document.getElementById('deltaSummary');

  // Results Tabs
  const btnFeasibleTab = document.getElementById('btnFeasibleTab');
  const btnInfeasibleTab = document.getElementById('btnInfeasibleTab');
  const btnTrajectoryTab = document.getElementById('btnTrajectoryTab');
  const feasibleTableWrapper = document.getElementById('feasibleTableWrapper');
  const infeasibleTableWrapper = document.getElementById('infeasibleTableWrapper');
  const trajectoryWrapper = document.getElementById('trajectoryWrapper');
  const feasibleTableBody = document.getElementById('feasibleTableBody');
  const infeasibleTableBody = document.getElementById('infeasibleTableBody');
  const trajectoryList = document.getElementById('trajectoryList');

  let activeCloud = 'AZURE';
  let activeGeo = 'india';

  // Geographic code mapping for providers
  const GEO_REGION_MAPPING = {
    india: {
      AZURE: 'centralindia',
      AWS: 'ap-south-1',
      GCP: 'asia-south1'
    },
    us_east: {
      AZURE: 'eastus',
      AWS: 'us-east-1',
      GCP: 'us-east1'
    },
    europe_west: {
      AZURE: 'westeurope',
      AWS: 'eu-west-1',
      GCP: 'europe-west1'
    },
    southeast_asia: {
      AZURE: 'southeastasia',
      AWS: 'ap-southeast-1',
      GCP: 'asia-southeast1'
    }
  };

  /**
   * Health & Telemetry Poll
   */
  async function checkHealth() {
    const startTime = performance.now();
    try {
      const res = await fetch('/api/health');
      const elapsed = Math.round(performance.now() - startTime);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      statusDot.className = 'status-dot healthy';
      systemStatusText.textContent = 'Engine Operational';
      apiLatencyVal.textContent = `${elapsed} ms`;
      phaseValue.textContent = data.engineStatus || 'Autonomous Multi-Cloud Governance Engine (Production v1.0)';

      if (data.database && data.database.status === 'healthy') {
        dbStatus.textContent = 'Active (WAL)';
      } else {
        dbStatus.textContent = 'Degraded';
      }

      const uptimeSeconds = Math.floor(data.uptime || 0);
      uptimeValue.textContent = `Uptime: ${uptimeSeconds}s`;
      apiResponse.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      statusDot.className = 'status-dot error';
      systemStatusText.textContent = 'Engine Disconnected';
      apiLatencyVal.textContent = 'ERR';
      dbStatus.textContent = 'Unavailable';
      apiResponse.textContent = `Diagnostic Error:\n${err.message}`;
    }
  }

  /**
   * Load Provider Pricing and Carbon Inventory
   */
  async function loadProviderData() {
    instancesTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          Querying ${activeCloud} compute specifications and telemetry...
        </td>
      </tr>
    `;

    const providerRegion = GEO_REGION_MAPPING[activeGeo][activeCloud];

    try {
      const [pricingRes, carbonRes] = await Promise.all([
        fetch(`/api/providers/pricing?cloud=${activeCloud}&region=${providerRegion}`),
        fetch(`/api/providers/carbon?cloud=${activeCloud}&region=${providerRegion}`)
      ]);

      if (!pricingRes.ok || !carbonRes.ok) {
        throw new Error('Failed to retrieve cloud pricing or carbon data.');
      }

      const pricingData = await pricingRes.json();
      const carbonData = await carbonRes.json();

      const instances = pricingData.instances || [];
      const carbon = carbonData.data || {};
      const sample = instances[0] || {};

      // Update metric summary cards
      metricRegion.textContent = providerRegion;
      metricResidency.textContent = `Data Residency: ${sample.dataResidency || carbon.dataResidency || 'International'}`;
      metricLatency.textContent = sample.baseLatencyMs ? `~${sample.baseLatencyMs} ms` : '—';
      metricCarbon.textContent = carbon.carbonIntensity ? `${carbon.carbonIntensity}` : '—';
      metricGridZone.textContent = `Grid Zone: ${carbon.gridZone || 'Standard'} (gCO₂eq/kWh)`;

      // Update Provenance Tag
      provenanceSource.textContent = sample.source || 'Official Catalog';
      provenanceStatusBadge.innerHTML = sample.status === 'live'
        ? '<span class="pill-badge pill-live">LIVE REST API</span>'
        : '<span class="pill-badge pill-neutral">PUBLISHED BENCHMARK</span>';

      // Render Instances Table
      if (instances.length === 0) {
        instancesTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="table-empty">
              No active instances found for ${activeCloud} in ${providerRegion}.
            </td>
          </tr>
        `;
        return;
      }

      instancesTableBody.innerHTML = instances.map(inst => `
        <tr>
          <td class="sku-col">${inst.instanceType}</td>
          <td>${inst.vCpu} vCPU</td>
          <td>${inst.memoryGb} GiB</td>
          <td class="price-col">$${Number(inst.hourlyPrice).toFixed(4)} / hr</td>
          <td>${inst.family || 'Standard'}</td>
          <td>
            <span class="pill-badge ${inst.status === 'live' ? 'pill-live' : 'pill-neutral'}">
              ${inst.status === 'live' ? 'LIVE' : 'BENCHMARK'}
            </span>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      instancesTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty" style="color: var(--danger);">
            Telemetry fetch failed: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  /**
   * Workload Submission and Agentic Orchestration
   */
  workloadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    evaluateBtn.disabled = true;
    evaluateBtn.innerHTML = `
      <span class="status-dot healthy" style="animation: pulse 1s infinite;"></span>
      Orchestrating Gemini Agent & Enforcing Hard Constraints...
    `;

    // Gather selected clouds
    const selectedClouds = [];
    if (document.getElementById('chkAzure').checked) selectedClouds.push('AZURE');
    if (document.getElementById('chkAws').checked) selectedClouds.push('AWS');
    if (document.getElementById('chkGcp').checked) selectedClouds.push('GCP');

    if (selectedClouds.length === 0) {
      alert('Please select at least one cloud provider (AWS, Azure, or GCP).');
      evaluateBtn.disabled = false;
      evaluateBtn.textContent = 'Evaluate Placement & Enforce Hard Constraints';
      return;
    }

    const payload = {
      workload_name: document.getElementById('workloadName').value,
      cpu: parseFloat(document.getElementById('reqCpu').value),
      memory: parseFloat(document.getElementById('reqMemory').value),
      storage: parseFloat(document.getElementById('reqStorage').value),
      duration: parseFloat(document.getElementById('reqDuration').value),
      max_cost: document.getElementById('maxCost').value ? parseFloat(document.getElementById('maxCost').value) : null,
      max_latency: document.getElementById('maxLatency').value ? parseFloat(document.getElementById('maxLatency').value) : null,
      data_residency: document.getElementById('dataResidency').value,
      optimization_mode: document.getElementById('optimizationMode').value,
      clouds: selectedClouds,
      geo_keys: [activeGeo]
    };

    try {
      // Call /api/decisions/evaluate which runs Gemini Agent, tool calling, and baseline
      const res = await fetch('/api/decisions/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      // Display results section
      evaluationResults.style.display = 'block';

      // 1. Populate Gemini Agent Recommendation Card
      const agent = data.agentDecision;
      if (agent && agent.recommendation) {
        const aRec = agent.recommendation;
        if (agentWinner) agentWinner.textContent = `${aRec.cloud} — ${aRec.instanceType}`;
        if (agentCost) agentCost.textContent = `$${Number(aRec.cost?.totalCost || 0).toFixed(2)} USD`;
        if (agentCarbon) agentCarbon.textContent = `${Number(aRec.carbon?.totalEmissionsKg || 0).toFixed(3)} kg CO₂eq`;
        if (agentLatency) agentLatency.textContent = `~${aRec.baseLatencyMs} ms`;
        if (agentRegion) agentRegion.textContent = `${aRec.region} (${aRec.dataResidency || 'Residency Compliant'})`;
        if (agentReasoning) agentReasoning.textContent = aRec.explanation || aRec.tradeoffAnalysis || agent.reasoning;
        if (agentSourceBadge) {
          agentSourceBadge.textContent = agent.decisionSource === 'gemini-agent' ? 'GEMINI TOOL-CALLING' : 'SAFE BASELINE FALLBACK';
          agentSourceBadge.className = agent.decisionSource === 'gemini-agent' ? 'pill-badge pill-live' : 'pill-badge pill-neutral';
        }
      } else {
        if (agentWinner) agentWinner.textContent = 'No Placement Found';
        if (agentReasoning) agentReasoning.textContent = agent?.fallbackReason || 'No feasible placement could satisfy all hard constraints.';
      }

      // 2. Populate Deterministic Baseline Card
      const baseline = data.baselineDecision;
      if (baseline && baseline.recommendation) {
        const bRec = baseline.recommendation;
        if (recWinner) recWinner.textContent = `${bRec.cloud} — ${bRec.instanceType}`;
        if (recCost) recCost.textContent = `$${Number(bRec.cost?.totalCost || 0).toFixed(2)} USD`;
        if (recCarbon) recCarbon.textContent = `${Number(bRec.carbon?.totalEmissionsKg || 0).toFixed(3)} kg CO₂eq`;
        if (recLatency) recLatency.textContent = `~${bRec.baseLatencyMs} ms`;
        if (recRegion) recRegion.textContent = `${bRec.region} (${bRec.dataResidency || 'Standard'})`;
        if (recReasoning) recReasoning.textContent = baseline.reasoning;
      }

      // 3. Populate Comparative Delta Bar
      const comp = data.comparativeAnalysis;
      if (comp) {
        if (deltaCost) deltaCost.textContent = `${comp.costDeltaUsd >= 0 ? '+' : ''}$${comp.costDeltaUsd.toFixed(2)}`;
        if (deltaCarbon) deltaCarbon.textContent = `${comp.carbonDeltaKg >= 0 ? '+' : ''}${comp.carbonDeltaKg.toFixed(3)} kg`;
        if (deltaLatency) deltaLatency.textContent = `${comp.latencyDeltaMs >= 0 ? '+' : ''}${comp.latencyDeltaMs.toFixed(1)} ms`;
        if (deltaSummary) deltaSummary.textContent = comp.summary || 'Comparative evaluation complete.';
      }

      // 4. Update Tool Trajectory Tab
      const toolCalls = agent?.toolCalls || [];
      if (badgeTrajectoryCount) badgeTrajectoryCount.textContent = `${toolCalls.length} Calls`;

      if (trajectoryList) {
        if (toolCalls.length === 0) {
          trajectoryList.innerHTML = `
            <div style="text-align: center; color: var(--text-faint); padding: 2rem;">
              No direct function calls were recorded (Deterministic baseline executed as safe fallback).
            </div>
          `;
        } else {
          trajectoryList.innerHTML = toolCalls.map((tc, idx) => `
            <div class="trajectory-item">
              <div class="trajectory-header">
                <span class="tool-name-badge">#${idx + 1} ${tc.tool_name}()</span>
                <span class="tool-time">${tc.execution_time_ms ? `${tc.execution_time_ms} ms` : ''} • ${new Date(tc.created_at).toLocaleTimeString()}</span>
              </div>
              <div class="trajectory-body">
                <div>
                  <div style="font-size: 0.72rem; color: var(--text-faint); text-transform: uppercase; margin-bottom: 0.25rem;">Tool Input Arguments:</div>
                  <pre class="trajectory-code"><code>${typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input, null, 2)}</code></pre>
                </div>
                <div>
                  <div style="font-size: 0.72rem; color: var(--text-faint); text-transform: uppercase; margin-bottom: 0.25rem;">Tool Execution Result:</div>
                  <pre class="trajectory-code"><code>${typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output, null, 2)}</code></pre>
                </div>
              </div>
            </div>
          `).join('');
        }
      }

      // 5. Fetch Full Job Details (Feasible & Infeasible Candidates)
      const jobRes = await fetch(`/api/jobs/${data.jobId}`);
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        const options = jobData.data?.options || [];
        const feasibleOpts = options.filter(o => o.feasible === 1);
        const infeasibleOpts = options.filter(o => o.feasible === 0);

        if (resTotalEvaluated) resTotalEvaluated.textContent = options.length;
        if (resFeasibleCount) resFeasibleCount.textContent = feasibleOpts.length;
        if (resInfeasibleCount) resInfeasibleCount.textContent = infeasibleOpts.length;
        if (badgeFeasibleCount) badgeFeasibleCount.textContent = feasibleOpts.length;
        if (badgeInfeasibleCount) badgeInfeasibleCount.textContent = infeasibleOpts.length;

        // Render Feasible Table
        feasibleTableBody.innerHTML = feasibleOpts.map(item => `
          <tr>
            <td><strong>${item.cloud}</strong></td>
            <td class="sku-col">${item.service}</td>
            <td>${item.pricing ? `$${Number(item.pricing).toFixed(4)}/hr` : '—'}</td>
            <td class="price-col">$${Number(item.pricing * payload.duration).toFixed(2)}</td>
            <td style="color: #34d399; font-family: var(--font-mono);">${item.carbon_intensity} g/kWh</td>
            <td>~${item.latency || 50} ms</td>
            <td>${item.region}</td>
          </tr>
        `).join('');

        // Render Infeasible Table
        infeasibleTableBody.innerHTML = infeasibleOpts.map(item => `
          <tr>
            <td><strong>${item.cloud}</strong></td>
            <td class="sku-col">${item.service}</td>
            <td>$${Number(item.pricing || 0).toFixed(4)}/hr</td>
            <td><div class="violation-tag">Failed Policy Constraints (CPU/RAM/Budget/Residency)</div></td>
            <td>${item.region}</td>
          </tr>
        `).join('');
      }

      // 6. Set Target Placement for Phase 5 Workload Simulator
      if (window.WorkloadSimulator) {
        const winnerPlacement = agent?.recommendation || baseline?.recommendation || null;
        if (winnerPlacement) {
          window.WorkloadSimulator.setTarget(data.jobId, winnerPlacement);
        }
      }

      // 7. Refresh Portfolio Analytics
      if (window.GovernanceDashboard) {
        window.GovernanceDashboard.refresh();
      }

      // Smooth scroll to results
      evaluationResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      alert(`Workload evaluation error: ${err.message}`);
    } finally {
      evaluateBtn.disabled = false;
      evaluateBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Evaluate Placement & Enforce Hard Constraints
      `;
    }
  });

  // Result Tabs Switching (Feasible vs Infeasible vs Tool Trajectory)
  btnFeasibleTab.addEventListener('click', () => {
    btnFeasibleTab.classList.add('active');
    btnInfeasibleTab.classList.remove('active');
    btnTrajectoryTab.classList.remove('active');
    feasibleTableWrapper.style.display = 'block';
    infeasibleTableWrapper.style.display = 'none';
    trajectoryWrapper.style.display = 'none';
  });

  btnInfeasibleTab.addEventListener('click', () => {
    btnInfeasibleTab.classList.add('active');
    btnFeasibleTab.classList.remove('active');
    btnTrajectoryTab.classList.remove('active');
    infeasibleTableWrapper.style.display = 'block';
    feasibleTableWrapper.style.display = 'none';
    trajectoryWrapper.style.display = 'none';
  });

  btnTrajectoryTab.addEventListener('click', () => {
    btnTrajectoryTab.classList.add('active');
    btnFeasibleTab.classList.remove('active');
    btnInfeasibleTab.classList.remove('active');
    trajectoryWrapper.style.display = 'block';
    feasibleTableWrapper.style.display = 'none';
    infeasibleTableWrapper.style.display = 'none';
  });

  // Provider Tab Switching (Rate Inspector)
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCloud = btn.getAttribute('data-cloud');
      loadProviderData();
    });
  });

  // Region Selection Change
  regionSelect.addEventListener('change', (e) => {
    activeGeo = e.target.value;
    loadProviderData();
  });

  // Sync / Refresh Button
  refreshBtn.addEventListener('click', () => {
    checkHealth();
    loadProviderData();
  });

  // Initial Load
  checkHealth();
  loadProviderData();

  if (window.WorkloadSimulator) {
    window.WorkloadSimulator.init();
  }

  if (window.GovernanceDashboard) {
    window.GovernanceDashboard.init();
  }
});
