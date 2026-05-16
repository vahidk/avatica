var mode = context.input.mode || 'generate';
var capabilityMap = {
  generate: 'video/generate',
  image_to_video: 'video/image_to_video',
  interpolate: 'video/interpolate',
  extend: 'video/extend',
};
var capability = capabilityMap[mode] || 'video/generate';

var providerId = context.input.model || context.pricing.capabilityDefaults[capability] || context.pricing.capabilityDefaults['video/generate'];
var provider = context.pricing.providers[providerId];
var defaults = (provider.capabilities[capability] || {}).defaults || {};

var duration = Number(context.input.durationSeconds) || defaults.durationSeconds || 8;
var resolution = context.input.resolution || defaults.resolution || '1080p';
var defaultResolution = defaults.resolution || '1080p';
var rate = provider.pricing.video.perSecond[resolution] || provider.pricing.video.perSecond[defaultResolution] || 0;

return rate * duration * context.pricing.usdToCredits;
