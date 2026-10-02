/**
 * Gemini Agentic Orchestrator
 * Uses Google Gemini with native function/tool calling to evaluate multi-cloud placement options.
 * Employs deterministic tools, records tool execution trajectories, and falls back to baseline if needed.
 */

const { GoogleGenAI } = require('@google/genai');
const { toolDeclarations, executeTool } = require('./toolRegistry');
const { SYSTEM_INSTRUCTION, buildUserPrompt } = require('./prompts');
const { computeBaselineDecision } = require('../services/baselineService');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_TURNS = 7; // Prevent runaway multi-turn loops

/**
 * Run the Gemini Governance Agent on a given workload
 * @param {Object} job - Workload requirements
 * @param {Array<Object>} feasibleCandidates - List of candidates passing hard constraints
 * @returns {Promise<Object>} Agent decision result, tool call audit trail, and reasoning
 */
async function runGovernanceAgent(job, feasibleCandidates = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. Safe Fallback Check if API Key is missing or empty
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    console.warn('[GeminiAgent] No valid GEMINI_API_KEY found in .env. Invoking deterministic baseline fallback.');
    const baseline = computeBaselineDecision(job, feasibleCandidates);
    return {
      success: true,
      decisionSource: 'fallback-deterministic',
      fallbackReason: 'GEMINI_API_KEY not configured in .env. Safe deterministic baseline executed.',
      recommendation: baseline.recommendation,
      reasoning: baseline.reasoning,
      toolCalls: []
    };
  }

  // 2. Initialize Google Gen AI client
  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = buildUserPrompt(job);

  const recordedToolCalls = [];
  const contents = [
    {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  ];

  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: toolDeclarations }],
    temperature: 0.2 // Low temperature for deterministic, factual reasoning
  };

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      console.log(`[GeminiAgent] Turn ${turn + 1}: Sending request to ${DEFAULT_MODEL}...`);
      
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents,
        config
      });

      const functionCalls = response.functionCalls;

      // A. If the model requests function calls, execute them
      if (functionCalls && functionCalls.length > 0) {
        console.log(`[GeminiAgent] Model requested ${functionCalls.length} tool call(s):`, functionCalls.map(fc => fc.name).join(', '));

        // Add the model's function calls to conversation history
        contents.push({
          role: 'model',
          parts: functionCalls.map(fc => ({ functionCall: fc }))
        });

        // Execute each tool and collect function responses
        const functionResponseParts = [];
        for (const fc of functionCalls) {
          const startTime = Date.now();
          let toolResult;
          try {
            toolResult = await executeTool(fc.name, fc.args || {}, { job });
          } catch (toolErr) {
            console.error(`[GeminiAgent] Error executing tool ${fc.name}:`, toolErr.message);
            toolResult = { error: toolErr.message };
          }

          // Record for SQLite audit log
          recordedToolCalls.push({
            tool_name: fc.name,
            input: JSON.stringify(fc.args || {}),
            output: JSON.stringify(toolResult),
            execution_time_ms: Date.now() - startTime,
            created_at: new Date().toISOString()
          });

          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: toolResult
            }
          });
        }

        // Add user turn containing function responses back to Gemini
        contents.push({
          role: 'user',
          parts: functionResponseParts
        });

      } else {
        // B. Model completed reasoning and provided final textual response
        const finalText = response.text || '';
        console.log('[GeminiAgent] Reasoning complete. Parsing final recommendation...');

        // Extract structured JSON block if present
        let parsed = null;
        const jsonMatch = finalText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            parsed = JSON.parse(jsonMatch[1]);
          } catch (e) {
            console.warn('[GeminiAgent] Could not parse embedded JSON from model response.');
          }
        }

        // Build normalized recommendation object
        let recommendation;
        if (parsed && parsed.recommended_cloud) {
          recommendation = {
            cloud: parsed.recommended_cloud,
            service: parsed.service || 'Compute',
            instanceType: parsed.instance_type || 'Selected Instance',
            region: parsed.region || (job.target_region || 'ap-south-1'),
            cost: { totalCost: parseFloat(parsed.estimated_cost) || 0 },
            carbon: { totalEmissionsKg: parseFloat(parsed.estimated_carbon) || 0 },
            baseLatencyMs: parseFloat(parsed.latency) || 50,
            tradeoffAnalysis: parsed.tradeoff_analysis || '',
            explanation: parsed.explanation || finalText
          };
        } else if (feasibleCandidates.length > 0) {
          // If JSON extraction failed, map to best feasible candidate as safety guarantee
          const fallbackCandidate = feasibleCandidates[0];
          recommendation = {
            cloud: fallbackCandidate.cloud,
            service: fallbackCandidate.service,
            instanceType: fallbackCandidate.instanceType,
            region: fallbackCandidate.region,
            cost: fallbackCandidate.cost,
            carbon: fallbackCandidate.carbon,
            baseLatencyMs: fallbackCandidate.baseLatencyMs,
            tradeoffAnalysis: 'Parsed from free-form agent trajectory.',
            explanation: finalText
          };
        } else {
          recommendation = null;
        }

        return {
          success: true,
          decisionSource: 'gemini-agent',
          recommendation,
          reasoning: finalText,
          toolCalls: recordedToolCalls
        };
      }
    }

    // If max turns reached without terminal text
    console.warn('[GeminiAgent] Max conversation turns reached. Fallback to baseline.');
    const baseline = computeBaselineDecision(job, feasibleCandidates);
    return {
      success: true,
      decisionSource: 'fallback-deterministic',
      fallbackReason: 'Agent reached maximum tool turns without concluding.',
      recommendation: baseline.recommendation,
      reasoning: baseline.reasoning,
      toolCalls: recordedToolCalls
    };

  } catch (error) {
    console.error('[GeminiAgent] Gemini API execution failed:', error.message);
    const baseline = computeBaselineDecision(job, feasibleCandidates);
    return {
      success: true,
      decisionSource: 'fallback-deterministic',
      fallbackReason: `Gemini API execution error: ${error.message}. Deterministic baseline executed safely.`,
      recommendation: baseline.recommendation,
      reasoning: baseline.reasoning,
      toolCalls: recordedToolCalls
    };
  }
}

module.exports = {
  runGovernanceAgent
};
