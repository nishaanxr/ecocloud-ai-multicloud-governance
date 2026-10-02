/**
 * Tool Registry for Gemini Agent
 * Defines function declarations and execution handlers for native tool calling.
 */

const { getCloudPricing } = require('../tools/pricingTool');
const { fetchCarbonIntensity } = require('../tools/carbonTool');
const { calculateEstimatedCost } = require('../tools/costTool');
const { calculateEstimatedCarbon } = require('../tools/carbonCalculationTool');
const { checkFeasibility } = require('../tools/feasibilityTool');
const { REGIONS_CONFIG, findRegionByProviderCode } = require('../config/regions');

// 1. Tool Function Declarations for Gemini API
const toolDeclarations = [
  {
    name: 'getCloudPricing',
    description: 'Retrieve current compute VM instance types, vCPUs, RAM, and hourly pricing for a specified cloud provider and region.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        cloud: {
          type: 'string',
          description: 'The cloud provider: "AWS", "Azure", or "GCP"',
          enum: ['AWS', 'Azure', 'GCP']
        },
        region: {
          type: 'string',
          description: 'The regional identifier (e.g., "ap-south-1", "centralindia", "asia-south1", "us-east-1", "eastus", "us-east1")'
        }
      },
      required: ['cloud', 'region']
    }
  },
  {
    name: 'getCarbonIntensity',
    description: 'Retrieve verified regional grid carbon intensity in gCO2eq/kWh for a cloud provider and region.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        cloud: {
          type: 'string',
          description: 'The cloud provider: "AWS", "Azure", or "GCP"',
          enum: ['AWS', 'Azure', 'GCP']
        },
        region: {
          type: 'string',
          description: 'The regional identifier (e.g., "ap-south-1", "centralindia", "asia-south1", etc.)'
        }
      },
      required: ['cloud', 'region']
    }
  },
  {
    name: 'calculateEstimatedCost',
    description: 'Deterministically compute total compute and storage cost in USD for a given hourly price, workload duration, and storage volume.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        hourlyPrice: {
          type: 'number',
          description: 'The hourly instance rate in USD'
        },
        durationHours: {
          type: 'number',
          description: 'The runtime duration of the workload in hours'
        },
        storageGb: {
          type: 'number',
          description: 'The attached persistent disk storage in GB (optional)'
        }
      },
      required: ['hourlyPrice', 'durationHours']
    }
  },
  {
    name: 'calculateEstimatedCarbon',
    description: 'Deterministically compute estimated electrical energy (kWh) and total carbon emissions (kg CO2eq) using the Green Software Foundation energy model.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        vCpu: {
          type: 'number',
          description: 'Number of vCPUs'
        },
        memoryGb: {
          type: 'number',
          description: 'RAM memory in GiB'
        },
        durationHours: {
          type: 'number',
          description: 'Runtime duration in hours'
        },
        carbonIntensity: {
          type: 'number',
          description: 'Grid emission intensity in gCO2eq/kWh'
        }
      },
      required: ['vCpu', 'memoryGb', 'durationHours', 'carbonIntensity']
    }
  },
  {
    name: 'checkFeasibility',
    description: 'Deterministically verify whether a candidate cloud option satisfies all mandatory hard constraints (CPU, RAM, budget limit, latency SLA, data residency).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        cloud: { type: 'string', description: 'Candidate cloud provider' },
        instanceType: { type: 'string', description: 'Instance SKU name' },
        vCpu: { type: 'number', description: 'Candidate vCPUs' },
        memoryGb: { type: 'number', description: 'Candidate RAM in GiB' },
        region: { type: 'string', description: 'Candidate region' },
        baseLatencyMs: { type: 'number', description: 'Base network latency in ms' },
        dataResidency: { type: 'string', description: 'Candidate country location' },
        estimatedTotalCost: { type: 'number', description: 'Calculated total cost for duration' }
      },
      required: ['vCpu', 'memoryGb', 'estimatedTotalCost']
    }
  }
];

// 2. Tool Execution Map
const toolExecutors = {
  getCloudPricing: async (args, context) => {
    const cloud = (args.cloud || 'AWS').toUpperCase();
    const region = args.region || '';
    const instances = await getCloudPricing(cloud, region);
    return {
      cloud,
      region,
      instanceCount: instances.length,
      instances: instances.map(i => ({
        instanceType: i.instanceType,
        vCpu: i.vCpu,
        memoryGb: i.memoryGb,
        hourlyPrice: i.hourlyPrice,
        family: i.family,
        dataResidency: i.dataResidency,
        baseLatencyMs: i.baseLatencyMs,
        source: i.source,
        status: i.status
      }))
    };
  },

  getCarbonIntensity: async (args, context) => {
    const cloud = (args.cloud || 'AWS').toUpperCase();
    const region = args.region || '';
    const data = await fetchCarbonIntensity(cloud, region);
    return data;
  },

  calculateEstimatedCost: async (args, context) => {
    const hourlyPrice = parseFloat(args.hourlyPrice);
    const duration = parseFloat(args.durationHours || (context.job && context.job.duration) || 24);
    const storage = parseFloat(args.storageGb || (context.job && context.job.storage) || 0);
    return calculateEstimatedCost(hourlyPrice, duration, storage);
  },

  calculateEstimatedCarbon: async (args, context) => {
    const vCpu = parseFloat(args.vCpu);
    const memory = parseFloat(args.memoryGb);
    const duration = parseFloat(args.durationHours || (context.job && context.job.duration) || 24);
    const carbonIntensity = parseFloat(args.carbonIntensity);
    return calculateEstimatedCarbon(vCpu, memory, duration, carbonIntensity);
  },

  checkFeasibility: async (args, context) => {
    const job = context.job || {};
    const candidate = {
      vCpu: parseFloat(args.vCpu),
      memoryGb: parseFloat(args.memoryGb),
      baseLatencyMs: parseFloat(args.baseLatencyMs || 50),
      dataResidency: args.dataResidency || 'India',
      region: args.region || ''
    };
    const totalCost = parseFloat(args.estimatedTotalCost);
    return checkFeasibility(candidate, job, totalCost);
  }
};

/**
 * Execute a named tool with provided arguments and context
 */
async function executeTool(toolName, args, context = {}) {
  const executor = toolExecutors[toolName];
  if (!executor) {
    throw new Error(`Tool "${toolName}" is not registered in the Tool Registry.`);
  }
  return await executor(args, context);
}

module.exports = {
  toolDeclarations,
  toolExecutors,
  executeTool
};
