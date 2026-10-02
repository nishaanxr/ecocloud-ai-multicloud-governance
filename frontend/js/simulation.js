/**
 * Workload Execution Simulator (Phase 5)
 * Controls real-time execution simulation, telemetry meter updates,
 * and post-execution SLA/carbon verification against predicted values.
 */

window.WorkloadSimulator = (() => {
  let currentJobId = null;
  let currentPlacement = null;
  let activeSimulation = null;

  // DOM Elements
  const simCard = document.getElementById('simulationSection');
  const btnRunSim = document.getElementById('btnRunSimulation');
  const simStatusBadge = document.getElementById('simStatusBadge');
  const simTargetPlacement = document.getElementById('simTargetPlacement');
  const simProgressContainer = document.getElementById('simProgressContainer');
  const simProgressBar = document.getElementById('simProgressBar');
  const simProgressPercent = document.getElementById('simProgressPercent');
  const simStageLabel = document.getElementById('simStageLabel');
  
  // Telemetry elements
  const simCpuVal = document.getElementById('simCpuVal');
  const simCpuBar = document.getElementById('simCpuBar');
  const simMemVal = document.getElementById('simMemVal');
  const simMemBar = document.getElementById('simMemBar');
  const simPowerVal = document.getElementById('simPowerVal');
  const simEnergyVal = document.getElementById('simEnergyVal');
  const simCarbonVal = document.getElementById('simCarbonVal');
  const simLatencyVal = document.getElementById('simLatencyVal');
  const simSlaBadge = document.getElementById('simSlaBadge');
  
  // Post-Execution Comparison Elements
  const simVerificationPanel = document.getElementById('simVerificationPanel');
  const simVerifJobId = document.getElementById('simVerifJobId');
  const simVerifCloud = document.getElementById('simVerifCloud');
  const simVerifInstance = document.getElementById('simVerifInstance');
  const simVerifDuration = document.getElementById('simVerifDuration');
  const simVerifEstCost = document.getElementById('simVerifEstCost');
  const simVerifSimCost = document.getElementById('simVerifSimCost');
  const simVerifEstCarbon = document.getElementById('simVerifEstCarbon');
  const simVerifSimCarbon = document.getElementById('simVerifSimCarbon');
  const simVerifSlaStatus = document.getElementById('simVerifSlaStatus');
  const simVerifDbRecord = document.getElementById('simVerifDbRecord');
  const simStagesList = document.getElementById('simStagesList');

  const STAGES = [
    { name: '1. Virtual Hardware Sandbox & CPU Isolation', progress: 20 },
    { name: '2. Persistent Disk Mounting & RAM Allocation', progress: 40 },
    { name: '3. Heavy Compute Kernel & SHA-256 Stress Burst', progress: 60 },
    { name: '4. Network Round-Trip Latency & SLA Probing', progress: 80 },
    { name: '5. GSF SCI Energy Accounting & SQLite Ledger Sync', progress: 100 }
  ];

  /**
   * Set target workload context for simulation
   */
  function setTarget(jobId, placement) {
    currentJobId = jobId;
    currentPlacement = placement;

    if (simCard) {
      simCard.style.display = 'block';
    }

    if (simTargetPlacement && placement) {
      simTargetPlacement.innerHTML = `
        <span class="placement-pill">${placement.cloud || 'AWS'}</span>
        <span class="placement-sku">${placement.instanceType || placement.service || 'Selected SKU'}</span>
        <span class="placement-region">${placement.region || 'ap-south-1'}</span>
      `;
    }

    if (btnRunSim) {
      btnRunSim.disabled = false;
      btnRunSim.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Execute Workload Simulation
      `;
    }
  }

  /**
   * Animate stages and run simulation backend API call
   */
  async function runSimulation() {
    if (!currentJobId) {
      alert('Please evaluate a workload placement before running a simulation.');
      return;
    }

    btnRunSim.disabled = true;
    btnRunSim.innerHTML = `
      <span class="spinner" style="display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:6px; vertical-align:middle;"></span>
      <span style="vertical-align:middle;">Simulating Workload Execution...</span>
    `;

    if (simStatusBadge) {
      simStatusBadge.className = 'pill-badge pill-active-pulse';
      simStatusBadge.textContent = 'RUNNING SIMULATION';
    }

    if (simVerificationPanel) {
      simVerificationPanel.style.display = 'none';
    }

    try {
      // 1. Kick off backend simulation
      const fetchPromise = fetch(`${API_BASE_URL}/api/simulations/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: currentJobId,
          placement: currentPlacement,
          options: { stageDelayMs: 450 }
        })
      }).then(r => r.json());

      // 2. Animate front-end progressive telemetry stages
      for (let i = 0; i < STAGES.length; i++) {
        const stage = STAGES[i];
        if (simProgressBar) simProgressBar.style.width = `${stage.progress}%`;
        if (simProgressPercent) simProgressPercent.textContent = `${stage.progress}%`;
        if (simStageLabel) simStageLabel.textContent = stage.name;

        // Progressive meter readings
        const simCpu = i === 2 ? (82 + Math.floor(Math.random() * 12)) : (22 + i * 14);
        const simMem = Math.round(1024 * (i + 1) * 0.8);
        const simWatts = Math.round((2 * (15 + 40 * (simCpu / 100)) * 1.15) * 10) / 10;
        const simEnergy = Math.round((simWatts * 0.05 * (i + 1)) * 1000) / 10000;
        const simCarbon = Math.round(simEnergy * 708.2 * 10) / 10;
        const simLat = 18 + Math.floor(Math.random() * 3);

        updateTelemetryMeters({
          cpu: simCpu,
          mem: simMem,
          power: simWatts,
          energy: simEnergy,
          carbon: simCarbon,
          latency: simLat,
          sla: 'PASSED'
        });

        await new Promise(r => setTimeout(r, 450));
      }

      // 3. Await backend result
      const resp = await fetchPromise;
      if (!resp.success) {
        throw new Error(resp.error || 'Simulation failed on backend.');
      }

      const sim = resp.simulation;
      activeSimulation = sim;

      // 4. Update Final Telemetry and Render Verification Panel
      renderVerificationSummary(sim);

      if (simStatusBadge) {
        simStatusBadge.className = 'pill-badge pill-live';
        simStatusBadge.textContent = 'EXECUTION COMPLETED';
      }

      btnRunSim.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Re-Run Workload Simulation
      `;
      btnRunSim.disabled = false;

    } catch (err) {
      console.error('[Simulator] Run error:', err);
      alert(`Simulation error: ${err.message}`);
      if (simStatusBadge) {
        simStatusBadge.className = 'pill-badge pill-neutral';
        simStatusBadge.textContent = 'SIMULATION FAILED';
      }
      btnRunSim.disabled = false;
      btnRunSim.textContent = 'Retry Workload Simulation';
    }
  }

  function updateTelemetryMeters(data) {
    if (simCpuVal) simCpuVal.textContent = `${data.cpu}%`;
    if (simCpuBar) simCpuBar.style.width = `${Math.min(data.cpu, 100)}%`;
    if (simMemVal) simMemVal.textContent = `${data.mem} MB`;
    if (simMemBar) simMemBar.style.width = `${Math.min((data.mem / 8192) * 100, 100)}%`;
    if (simPowerVal) simPowerVal.textContent = `${data.power} W`;
    if (simEnergyVal) simEnergyVal.textContent = `${data.energy} kWh`;
    if (simCarbonVal) simCarbonVal.textContent = `${data.carbon} gCO₂eq`;
    if (simLatencyVal) simLatencyVal.textContent = `${data.latency} ms`;
    if (simSlaBadge) {
      simSlaBadge.textContent = data.sla;
      simSlaBadge.className = data.sla === 'PASSED' ? 'pill-badge pill-live' : 'pill-badge pill-neutral';
    }
  }

  function renderVerificationSummary(sim) {
    if (!simVerificationPanel) return;
    simVerificationPanel.style.display = 'block';

    if (simVerifJobId) simVerifJobId.textContent = sim.jobId;
    if (simVerifCloud) simVerifCloud.textContent = `${sim.cloud} (${sim.region})`;
    if (simVerifInstance) simVerifInstance.textContent = sim.instanceType;
    if (simVerifDuration) simVerifDuration.textContent = `${sim.projectedDurationHours} hrs (Simulated in ${sim.executionTimeSeconds}s)`;
    if (simVerifEstCost) simVerifEstCost.textContent = `$${(currentPlacement?.cost?.totalCost || sim.estimatedCost).toFixed(2)}`;
    if (simVerifSimCost) simVerifSimCost.textContent = `$${sim.estimatedCost.toFixed(2)}`;
    if (simVerifEstCarbon) simVerifEstCarbon.textContent = `${(currentPlacement?.carbon?.totalEmissionsKg || sim.estimatedCarbonKg).toFixed(4)} kg`;
    if (simVerifSimCarbon) simVerifSimCarbon.textContent = `${sim.estimatedCarbonKg.toFixed(4)} kg`;
    if (simVerifSlaStatus) {
      simVerifSlaStatus.textContent = `${sim.slaStatus} (${sim.observedLatencyMs} ms)`;
      simVerifSlaStatus.className = sim.slaStatus === 'PASSED' ? 'status-pass' : 'status-fail';
    }
    if (simVerifDbRecord) {
      simVerifDbRecord.textContent = `Persisted in SQLite simulations table: Row #${sim.simulationId}`;
    }

    // Render 5 Staged Telemetry Snapshots
    if (simStagesList && Array.isArray(sim.telemetrySnapshots)) {
      simStagesList.innerHTML = sim.telemetrySnapshots.map(snap => `
        <div class="sim-stage-row">
          <div class="stage-info">
            <span class="stage-num">${snap.progress}%</span>
            <span class="stage-title">${snap.stage}</span>
          </div>
          <div class="stage-metrics">
            <span>CPU: <strong>${snap.cpuUtilizationPercent}%</strong></span>
            <span>RAM: <strong>${snap.memoryUsedMb} MB</strong></span>
            <span>Power: <strong>${snap.powerWatts} W</strong></span>
            <span>CO₂: <strong>${snap.cumulativeCarbonKg} kg</strong></span>
            <span class="badge-mini ${snap.slaStatus === 'PASSED' ? 'pass' : 'fail'}">${snap.slaStatus}</span>
          </div>
        </div>
      `).join('');
    }

    simVerificationPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Initialize event listeners
  function init() {
    if (btnRunSim) {
      btnRunSim.addEventListener('click', runSimulation);
    }
  }

  return {
    init,
    setTarget,
    runSimulation
  };
})();
