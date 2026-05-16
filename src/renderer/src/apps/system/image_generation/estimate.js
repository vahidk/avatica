var mode = context.input.mode || 'generate';
var capability = mode === 'edit' ? 'image/edit' : 'image/generate';

var providerId = context.input.model || context.pricing.capabilityDefaults[capability] || context.pricing.capabilityDefaults['image/generate'];
var provider = context.pricing.providers[providerId];

if (provider.pricing.type === 'per_image') {
  return provider.pricing.perImage * context.pricing.usdToCredits;
}

var rates = provider.pricing.token;
var imageSize = context.input.imageSize || '1K';
var outputTokens = context.pricing.imageOutputTokens[imageSize] || context.pricing.imageOutputTokens['1K'];
var inputCostUsd = (context.pricing.heuristics.tokenInputEstimate / 1_000_000) * rates.inputPer1M;
var outputCostUsd = (outputTokens / 1_000_000) * rates.imageOutputPer1M;

return (inputCostUsd + outputCostUsd) * context.pricing.usdToCredits;
