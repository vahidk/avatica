const providerId = context.input.model || context.pricing.capabilityDefaults['speech/generate'];
const provider = context.pricing.providers[providerId];
const rates = provider.pricing.token;
const inputCostUsd = (context.pricing.heuristics.tokenInputEstimate / 1_000_000) * rates.inputPer1M;
const outputCostUsd = (context.pricing.heuristics.tokenOutputEstimate / 1_000_000) * rates.outputPer1M;

return (inputCostUsd + outputCostUsd) * context.pricing.usdToCredits;
