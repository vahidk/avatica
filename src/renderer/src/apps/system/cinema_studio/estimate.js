// Text cost (1 LLM call for video prompt)
var textProviderId = 'gemini-3.1-pro';
var textProvider = context.pricing.providers[textProviderId];
var textRates = textProvider.pricing.token;
var textCost = ((context.pricing.heuristics.tokenInputEstimate / 1000000) * textRates.inputPer1M +
  (context.pricing.heuristics.tokenOutputEstimate / 1000000) * textRates.outputPer1M) * context.pricing.usdToCredits;

// Video cost
var providerId = context.input.model || context.pricing.capabilityDefaults['video/generate'];
var provider = context.pricing.providers[providerId];
var defaults = (provider.capabilities['video/generate'] || {}).defaults || {};
var duration = Number(context.input.durationSeconds) || defaults.durationSeconds || 8;
var resolution = context.input.resolution || defaults.resolution || '1080p';
var defaultResolution = defaults.resolution || '1080p';
var rate = provider.pricing.video.perSecond[resolution] || provider.pricing.video.perSecond[defaultResolution] || 0;
var videoCost = rate * duration * context.pricing.usdToCredits;

return textCost + videoCost;
