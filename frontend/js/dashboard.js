/**
 * Portfolio Dashboard & Historical Governance Analytics (Phase 6)
 * Queries /api/analytics/summary and renders historical governance KPIs,
 * multi-cloud market share, and recent decision audits.
 */

window.GovernanceDashboard = (() => {
  const kpiTotalJobs = document.getElementById('kpiTotalJobs');
  const kpiTotalDecisions = document.getElementById('kpiTotalDecisions');
  const kpiTotalToolCalls = document.getElementById('kpiTotalToolCalls');
  const kpiCumulativeSpend = document.getElementById('kpiCumulativeSpend');
  const kpiCumulativeCarbon = document.getElementById('kpiCumulativeCarbon');
  const kpiSlaCompliance = document.getElementById('kpiSlaCompliance');

  const shareAwsBar = document.getElementById('shareAwsBar');
  const shareAzureBar = document.getElementById('shareAzureBar');
  const shareGcpBar = document.getElementById('shareGcpBar');
  const shareAwsPct = document.getElementById('shareAwsPct');
  const shareAzurePct = document.getElementById('shareAzurePct');
  const shareGcpPct = document.getElementById('shareGcpPct');

  const historyTableBody = document.getElementById('historyTableBody');
  const btnRefreshAnalytics = document.getElementById('btnRefreshAnalytics');

  async function loadAnalytics() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/analytics/summary`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;

      const { overview, cloudDistribution, recentDecisions } = json.data;

      // Update Overview KPIs
      if (kpiTotalJobs) kpiTotalJobs.textContent = overview.totalWorkloadsGoverned;
      if (kpiTotalDecisions) kpiTotalDecisions.textContent = overview.totalDecisionsRecorded;
      if (kpiTotalToolCalls) kpiTotalToolCalls.textContent = overview.totalAgenticToolCalls;
      if (kpiCumulativeSpend) kpiCumulativeSpend.textContent = `$${overview.cumulativeEstimatedCostUsd.toFixed(2)}`;
      if (kpiCumulativeCarbon) kpiCumulativeCarbon.textContent = `${overview.cumulativeCarbonKg.toFixed(3)} kg`;
      if (kpiSlaCompliance) kpiSlaCompliance.textContent = `${overview.slaComplianceRatePercent}%`;

      // Update Multi-Cloud Distribution Bars
      const p = cloudDistribution.percentages;
      if (shareAwsBar) shareAwsBar.style.width = `${p.AWS}%`;
      if (shareAzureBar) shareAzureBar.style.width = `${p.Azure}%`;
      if (shareGcpBar) shareGcpBar.style.width = `${p.GCP}%`;

      if (shareAwsPct) shareAwsPct.textContent = `${p.AWS}% (${cloudDistribution.counts.AWS || 0})`;
      if (shareAzurePct) shareAzurePct.textContent = `${p.Azure}% (${cloudDistribution.counts.Azure || 0})`;
      if (shareGcpPct) shareGcpPct.textContent = `${p.GCP}% (${cloudDistribution.counts.GCP || 0})`;

      // Render Recent Decisions History
      if (historyTableBody && Array.isArray(recentDecisions)) {
        if (recentDecisions.length === 0) {
          historyTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No governance decisions recorded yet. Submit a workload above to begin.</td></tr>`;
          return;
        }

        historyTableBody.innerHTML = recentDecisions.map(d => `
          <tr>
            <td><strong>#${d.id}</strong></td>
            <td>${d.workload_name || 'Compute Job'}</td>
            <td><span class="placement-pill">${d.cloud}</span> <span class="sku-col">${d.service}</span></td>
            <td>${d.region}</td>
            <td class="price-col">$${Number(d.estimated_cost || 0).toFixed(2)}</td>
            <td style="color:#34d399; font-family:var(--font-mono);">${Number(d.estimated_carbon || 0).toFixed(3)} kg</td>
            <td>
              <span class="pill-badge ${d.decision_source === 'gemini-agent' ? 'pill-live' : 'pill-neutral'}">
                ${d.decision_source === 'gemini-agent' ? 'GEMINI AGENT' : 'BASELINE'}
              </span>
            </td>
          </tr>
        `).join('');
      }

    } catch (err) {
      console.warn('[GovernanceDashboard] Failed to fetch analytics:', err);
    }
  }

  function init() {
    loadAnalytics();
    if (btnRefreshAnalytics) {
      btnRefreshAnalytics.addEventListener('click', loadAnalytics);
    }
  }

  return {
    init,
    refresh: loadAnalytics
  };
})();
