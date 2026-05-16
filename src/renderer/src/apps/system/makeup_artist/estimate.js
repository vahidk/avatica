const providerId = context.input.model || context.pricing.capabilityDefaults['image/generate'];
const provider = context.pricing.providers[providerId];

let perImageCredits;
if (provider.pricing.type === 'per_image') {
  perImageCredits = provider.pricing.perImage * context.pricing.usdToCredits;
} else {
  const rates = provider.pricing.token;
  const imgSize = context.input.imageSize || '1K';
  const outputTokens = context.pricing.imageOutputTokens[imgSize] || context.pricing.imageOutputTokens['1K'] || 1117;
  perImageCredits = ((context.pricing.heuristics.tokenInputEstimate / 1_000_000) * rates.inputPer1M +
    (outputTokens / 1_000_000) * rates.imageOutputPer1M) * context.pricing.usdToCredits;
}

const views = String(context.input.views || 'front')
  .split(',')
  .map(part => part.trim())
  .filter(Boolean);
const imageCount = Math.max(1, views.length);

return imageCount * perImageCredits;
