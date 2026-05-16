// Text cost (2 LLM calls: prompt composition + name/description generation)
var textProviderId = context.pricing.capabilityDefaults['text/generate'];
var textProvider = context.pricing.providers[textProviderId];
var textRates = textProvider.pricing.token;
var singleTextCost = ((context.pricing.heuristics.tokenInputEstimate / 1000000) * textRates.inputPer1M +
  (context.pricing.heuristics.tokenOutputEstimate / 1000000) * textRates.outputPer1M) * context.pricing.usdToCredits;
var textCost = singleTextCost * 2;

// Image cost (first frame)
var imageProviderId = context.input.model || context.pricing.capabilityDefaults['image/generate'];
var imageProvider = context.pricing.providers[imageProviderId];

var imageCost;
if (imageProvider.pricing.type === 'per_image') {
  imageCost = imageProvider.pricing.perImage * context.pricing.usdToCredits;
} else {
  var rates = imageProvider.pricing.token;
  var imgSize = context.input.imageSize || '1K';
  var outputTokens = context.pricing.imageOutputTokens[imgSize] || context.pricing.imageOutputTokens['1K'];
  imageCost = ((context.pricing.heuristics.tokenInputEstimate / 1000000) * rates.inputPer1M +
    (outputTokens / 1000000) * rates.imageOutputPer1M) * context.pricing.usdToCredits;
}

return textCost + imageCost;
