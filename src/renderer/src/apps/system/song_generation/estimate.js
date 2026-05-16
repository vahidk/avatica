const providerId = context.input.model || context.pricing.capabilityDefaults['audio/generate'];
const provider = context.pricing.providers[providerId];

if (provider.pricing.type === 'per_request') {
  return provider.pricing.perRequest * context.pricing.usdToCredits;
}

const rates = provider.pricing.token;
const duration = Number(context.input.duration) || 150;

// ~30 output tokens per second of audio (based on actual Lyria usage data)
const estimatedOutputTokens = Math.round(duration * 30);
const inputCostUsd = (context.pricing.heuristics.tokenInputEstimate / 1_000_000) * rates.inputPer1M;
const outputCostUsd = (estimatedOutputTokens / 1_000_000) * rates.outputPer1M;

return (inputCostUsd + outputCostUsd) * context.pricing.usdToCredits;
