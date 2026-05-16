// One text call (chunking) + N video calls (image_to_video)
var chunkSize = Number(context.input.chunkSize || 8);
var words = (context.input.prompt || '').split(/\s+/).filter(Boolean).length;

// Rough speaking rate: 2.5 words per second
var estimatedSeconds = Math.max(chunkSize, words / 2.5);
var numChunks = Math.max(1, Math.ceil(estimatedSeconds / chunkSize));

// Video cost per chunk
var modelId = context.input.model || 'veo-3.1-lite';
var videoProvider = context.pricing.providers[modelId];
var resolution = context.input.resolution || '720p';
var perSecondRate = videoProvider.pricing.video.perSecond[resolution] || videoProvider.pricing.video.perSecond[Object.keys(videoProvider.pricing.video.perSecond)[0]];
var videoCostUsd = numChunks * chunkSize * perSecondRate;

// Text cost for chunking (small)
var textProvider = context.pricing.providers['gemini-3.1-flash-lite'] || context.pricing.providers['gemini-3.1-pro'];
var textRates = textProvider.pricing.token;
var textCostUsd = ((2000 / 1000000) * textRates.inputPer1M) + ((1500 / 1000000) * textRates.outputPer1M);

return (videoCostUsd + textCostUsd) * context.pricing.usdToCredits;
