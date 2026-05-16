var mode = context.input.mode || 'generate';

var params = {
  prompt: context.input.prompt,
  mode: mode,
  aspectRatio: context.input.aspectRatio,
  imageSize: context.input.imageSize,
  provider: context.input.model || undefined,
};

if (mode === 'edit' && context.input.sourceImage) {
  params.sourceImage = context.input.sourceImage;
}

if (context.input.referenceImages) {
  params.images = context.input.referenceImages;
}

await ai.image(params);
