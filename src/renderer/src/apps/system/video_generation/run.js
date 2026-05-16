var mode = context.input.mode || 'generate';

var params = {
  prompt: context.input.prompt,
  mode: mode,
  provider: context.input.model || undefined,
};

// Settings shared by generation modes
if (mode !== 'edit') {
  params.duration = Number(context.input.durationSeconds) || 8;
}
if (mode !== 'extend' && mode !== 'edit') {
  params.aspectRatio = context.input.aspectRatio;
  params.resolution = context.input.resolution;
}

// Mode-specific inputs
if (mode === 'image_to_video' && context.input.startImage) {
  params.startImage = context.input.startImage;
}
if (mode === 'interpolate') {
  if (context.input.startImage) params.startImage = context.input.startImage;
  if (context.input.endImage) params.endImage = context.input.endImage;
}
if ((mode === 'extend' || mode === 'edit') && context.input.sourceVideo) {
  params.sourceVideo = context.input.sourceVideo;
}

// Reference images (generate + image_to_video)
if (context.input.referenceImages) {
  params.images = context.input.referenceImages;
}

await ai.video(params);
