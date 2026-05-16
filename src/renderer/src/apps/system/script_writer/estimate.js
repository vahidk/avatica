// Script writing uses ai.chat() across 4 turns
var providerId = context.input.model || 'gemini-3.1-pro';
var provider = context.pricing.providers[providerId];
var rates = provider.pricing.token;

// Turn 1: guide + concept → 3 creative directions (~3000 in, ~1000 out)
// Turn 2: pick direction + outline (~5000 in, ~1500 out)
// Turn 3: write full script from outline (~7000 in, ~4000 out)
// Turn 4: review (~11000 in, ~4000 out if revised)
var totalInput = 3000 + 5000 + 7000 + 11000;
var totalOutput = 1000 + 1500 + 4000 + 4000;

var inputCostUsd = (totalInput / 1000000) * rates.inputPer1M;
var outputCostUsd = (totalOutput / 1000000) * rates.outputPer1M;

return (inputCostUsd + outputCostUsd) * context.pricing.usdToCredits;
